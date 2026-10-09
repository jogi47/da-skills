// Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import worker from "../worker/worker.mjs";
import { runtime } from "../worker/runtime.mjs";
import { fakeD1 } from "./fake-d1.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = join(here, "..", "worker", "schema.sql");
const HOST = "https://docs.example.test";
const TOKEN = "t".repeat(64);

function setup() {
  const env = { DB: fakeD1(SCHEMA), ADMIN_TOKEN: TOKEN };
  const call = (path, init = {}) => worker.fetch(new Request(HOST + path, init), env);
  const admin = (path, method = "GET", body) => call("/_admin" + path, {
    method,
    headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const write = (path, method, body, extra = {}) => call(path, {
    method,
    headers: { "content-type": "application/json", "x-cfdocs": "1", "cf-connecting-ip": "203.0.113.9", ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { env, call, admin, write };
}

async function newPage(t, html = "<title>Demo</title><p>Hello</p>") {
  const r = await t.admin("/pages", "POST", { title: "Demo page", html });
  assert.equal(r.status, 200);
  return r.json();
}

test("admin requires the bearer token", async () => {
  const t = setup();
  assert.equal((await t.call("/_admin/pages")).status, 401);
  const wrong = await t.call("/_admin/pages", { headers: { authorization: "Bearer " + "x".repeat(64) } });
  assert.equal(wrong.status, 401);
  assert.equal((await t.admin("/pages")).status, 200);
});

test("admin refuses everything when no token is configured", async () => {
  const t = setup();
  t.env.ADMIN_TOKEN = "";
  const r = await t.call("/_admin/pages", { headers: { authorization: "Bearer " } });
  assert.equal(r.status, 401);
});

test("publish creates a uuid page and serves it with the runtime and safe headers", async () => {
  const t = setup();
  const page = await newPage(t);
  assert.match(page.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(page.url, `${HOST}/${page.id}`);
  assert.equal(page.version, 1);
  const r = await t.call("/" + page.id);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<script src="\/_\/rt\.js\?v=[0-9a-z]+"><\/script>/);
  assert.match(html, /window\.__CFDOCS__=\{"id":"[0-9a-f-]+","title":"Demo page","mode":"open","version":1\}/);
  assert.match(html, /<p>Hello<\/p>/);
  assert.equal(r.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.match(r.headers.get("content-security-policy"), /connect-src 'self'/);
  assert.equal(r.headers.get("cache-control"), "no-store");
});

test("boot data cannot break out of its script tag", async () => {
  const t = setup();
  const r = await t.admin("/pages", "POST", { title: "</script><script>alert(1)</script>", html: "<p>x</p>" });
  const page = await r.json();
  const html = await (await t.call("/" + page.id)).text();
  assert.ok(!html.includes("</script><script>alert(1)"));
  assert.ok(html.includes("\\u003c/script>"));
});

test("full documents keep their own markup and get the runtime in their head", async () => {
  const t = setup();
  const page = await newPage(t, "<!doctype html><html><head><title>Mine</title></head><body><p>own</p></body></html>");
  const html = await (await t.call("/" + page.id)).text();
  assert.match(html, /<head><meta charset="utf-8">.*<script src="\/_\/rt\.js\?v=[0-9a-z]+"><\/script><title>Mine<\/title>/s);
  assert.equal((html.match(/<!doctype/gi) || []).length, 1);
});

test("unknown, malformed and archived pages are 404 with no listing at the root", async () => {
  const t = setup();
  assert.equal((await t.call("/")).status, 404);
  assert.equal((await t.call("/not-a-uuid")).status, 404);
  assert.equal((await t.call("/" + crypto.randomUUID())).status, 404);
  const page = await newPage(t);
  assert.equal((await t.admin("/pages/" + page.id, "PATCH", { archived: true })).status, 200);
  assert.equal((await t.call("/" + page.id)).status, 404);
  const gone = await t.call(`/${page.id}/api/c/answers`);
  assert.equal(gone.status, 404);
  assert.equal((await gone.json()).error, "gone");
  assert.equal((await t.admin("/pages/" + page.id, "PATCH", { archived: false })).status, 200);
  assert.equal((await t.call("/" + page.id)).status, 200);
  const robots = await (await t.call("/robots.txt")).text();
  assert.match(robots, /Disallow: \//);
});

test("visitors can save, read, merge and delete documents", async () => {
  const t = setup();
  const { id } = await newPage(t);
  let r = await t.write(`/${id}/api/d/decisions/item-1`, "PUT", { status: "agreed", note: "" });
  assert.equal(r.status, 200);
  r = await t.write(`/${id}/api/d/decisions/item-1`, "PATCH", { note: "fine", extra: { a: 1 } });
  assert.equal(r.status, 200);
  r = await t.call(`/${id}/api/d/decisions/item-1`);
  const one = await r.json();
  assert.deepEqual(one.data, { status: "agreed", note: "fine", extra: { a: 1 } });
  assert.equal(one.version, 2);
  r = await t.write(`/${id}/api/c/log`, "POST", { kind: "note" });
  const added = await r.json();
  assert.match(added.id, /^[0-9a-f]{20}$/);
  r = await t.call(`/${id}/api/c/decisions`);
  const list = await r.json();
  assert.equal(list.docs.length, 1);
  assert.equal(list.mode, "open");
  r = await t.write(`/${id}/api/d/decisions/item-1`, "DELETE");
  assert.equal(r.status, 200);
  assert.equal((await (await t.call(`/${id}/api/c/decisions`)).json()).docs.length, 0);
  // Nothing about the visitor is stored.
  const cols = t.env.DB.raw.prepare("PRAGMA table_info(records)").all().map(c => c.name);
  assert.deepEqual(cols.sort(), ["collection", "created_at", "data", "id", "page_id", "updated_at", "version"].sort());
  const hits = t.env.DB.raw.prepare("SELECT k FROM hits").all();
  assert.ok(hits.every(h => !h.k.includes("203.0.113.9")));
});

test("patching a missing document is a 404", async () => {
  const t = setup();
  const { id } = await newPage(t);
  const r = await t.write(`/${id}/api/d/decisions/nope`, "PATCH", { a: 1 });
  assert.equal(r.status, 404);
});

test("collection ETag changes on every write and answers 304 otherwise", async () => {
  const t = setup();
  const { id } = await newPage(t);
  const r1 = await t.call(`/${id}/api/c/decisions`);
  const etag = r1.headers.get("etag");
  assert.ok(etag);
  const r2 = await t.call(`/${id}/api/c/decisions`, { headers: { "if-none-match": etag } });
  assert.equal(r2.status, 304);
  await t.write(`/${id}/api/d/other/x`, "PUT", { a: 1 });
  const r3 = await t.call(`/${id}/api/c/decisions`, { headers: { "if-none-match": etag } });
  assert.equal(r3.status, 200);
  assert.notEqual(r3.headers.get("etag"), etag);
});

test("writes need the custom header, an object body and a sane size", async () => {
  const t = setup();
  const { id } = await newPage(t);
  let r = await t.call(`/${id}/api/d/decisions/a`, { method: "PUT", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(r.status, 403);
  r = await t.write(`/${id}/api/d/decisions/a`, "PUT", [1, 2]);
  assert.equal(r.status, 400);
  r = await t.call(`/${id}/api/d/decisions/a`, { method: "PUT", headers: { "x-cfdocs": "1" }, body: "not json" });
  assert.equal(r.status, 400);
  r = await t.write(`/${id}/api/d/decisions/a`, "PUT", { big: "x".repeat(70 * 1024) });
  assert.equal(r.status, 413);
  r = await t.write(`/${id}/api/d/bad%20name/a`, "PUT", { a: 1 });
  assert.equal(r.status, 400);
});

test("a locked page is read-only, and unlocking reopens it", async () => {
  const t = setup();
  const { id } = await newPage(t);
  await t.write(`/${id}/api/d/decisions/a`, "PUT", { a: 1 });
  await t.admin("/pages/" + id, "PATCH", { mode: "locked" });
  let r = await t.write(`/${id}/api/d/decisions/a`, "PUT", { a: 2 });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, "locked");
  r = await t.call(`/${id}/api/c/decisions`);
  const body = await r.json();
  assert.equal(body.mode, "locked");
  assert.deepEqual(body.docs[0].data, { a: 1 });
  await t.admin("/pages/" + id, "PATCH", { mode: "open" });
  assert.equal((await t.write(`/${id}/api/d/decisions/a`, "PUT", { a: 3 })).status, 200);
});

test("republishing keeps the uuid and the saved answers, and bumps the version", async () => {
  const t = setup();
  const { id } = await newPage(t);
  await t.write(`/${id}/api/d/decisions/a`, "PUT", { status: "agreed" });
  const r = await t.admin("/pages/" + id, "PUT", { title: "Demo v2", html: "<p>v2</p>" });
  const page = await r.json();
  assert.equal(page.id, id);
  assert.equal(page.version, 2);
  assert.equal(page.created, false);
  const list = await (await t.call(`/${id}/api/c/decisions`)).json();
  assert.equal(list.pageVersion, 2);
  assert.equal(list.docs.length, 1);
  assert.match(await (await t.call("/" + id)).text(), /<p>v2<\/p>/);
});

test("PUT with a new uuid creates the page at that address", async () => {
  const t = setup();
  const id = crypto.randomUUID();
  const r = await t.admin("/pages/" + id, "PUT", { title: "Fixed id", html: "<p>x</p>" });
  const page = await r.json();
  assert.equal(page.id, id);
  assert.equal(page.created, true);
  assert.equal((await t.admin("/pages/NOT-A-UUID", "PUT", { html: "<p>x</p>" })).status, 400);
});

test("admin can list pages, dump records and remove one record", async () => {
  const t = setup();
  const { id } = await newPage(t);
  await t.write(`/${id}/api/d/decisions/a`, "PUT", { status: "agreed" });
  await t.write(`/${id}/api/d/signoff/final`, "PUT", { outcome: "approved" });
  const list = await (await t.admin("/pages")).json();
  assert.equal(list.pages.length, 1);
  assert.equal(list.pages[0].records, 2);
  assert.ok(!("html" in list.pages[0]));
  const dump = await (await t.admin(`/pages/${id}/records`)).json();
  assert.equal(dump.records.length, 2);
  const only = await (await t.admin(`/pages/${id}/records?collection=signoff`)).json();
  assert.equal(only.records.length, 1);
  assert.equal((await t.admin(`/pages/${id}/records/decisions/a`, "DELETE")).status, 200);
  assert.equal((await (await t.admin(`/pages/${id}/records`)).json()).records.length, 1);
  const meta = await (await t.admin(`/pages/${id}?html=1`)).json();
  assert.match(meta.html, /Hello/);
});

test("writes are rate limited per client", async () => {
  const t = setup();
  const { id } = await newPage(t);
  let last;
  for (let i = 0; i < 120; i++) last = await t.write(`/${id}/api/d/n/x`, "PUT", { i }, { "cf-connecting-ip": "198.51.100.7" });
  assert.equal(last.status, 200);
  last = await t.write(`/${id}/api/d/n/x`, "PUT", { i: 122 }, { "cf-connecting-ip": "198.51.100.7" });
  assert.equal(last.status, 429);
  const other = await t.write(`/${id}/api/d/n/y`, "PUT", { i: 1 }, { "cf-connecting-ip": "198.51.100.8" });
  assert.equal(other.status, 200);
});

test("the runtime is served as a self-calling script, immutable only at its current version", async () => {
  const t = setup();
  const { id } = await newPage(t);
  const html = await (await t.call("/" + id)).text();
  const src = html.match(/<script src="(\/_\/rt\.js\?v=[0-9a-z]+)"><\/script>/)[1];
  const pinned = await t.call(src);
  assert.match(pinned.headers.get("cache-control"), /immutable/);
  assert.equal((await t.call("/_/rt.js?v=old")).headers.get("cache-control"), "no-cache");
  const r = await t.call("/_/rt.js");
  assert.equal(r.headers.get("cache-control"), "no-cache");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /javascript/);
  const body = await r.text();
  assert.match(body, /^\(function runtime\(\)/);
  new Function(body); // parses
});

test("runtime: read, write, live snapshot and lock event against the Worker", async () => {
  const t = setup();
  const { id } = await newPage(t);
  const events = [];
  const win = {
    __CFDOCS__: { id, title: "Demo page", mode: "open", version: 1 },
    dispatchEvent(ev) { events.push(ev); return true; },
  };
  const savedWindow = globalThis.window, savedFetch = globalThis.fetch;
  let off = () => {};
  globalThis.window = win;
  globalThis.fetch = (url, init = {}) => {
    const headers = { ...(init.headers || {}), "cf-connecting-ip": "192.0.2.1" };
    return worker.fetch(new Request(HOST + url, { ...init, headers }), t.env);
  };
  try {
    const cf = runtime();
    assert.equal(cf.canWrite, true);
    const seen = [];
    off = cf.db.collection("decisions").orderBy("rank").onSnapshot(s => seen.push(s.docs.map(d => d.id)));
    await new Promise(r => setTimeout(r, 30));
    assert.deepEqual(seen.at(-1), []);
    await cf.db.doc("decisions/b").set({ rank: 2 });
    await cf.db.collection("decisions").doc("a").set({ rank: 1 });
    await new Promise(r => setTimeout(r, 30));
    assert.deepEqual(seen.at(-1), ["a", "b"]);
    const snap = await cf.db.doc("decisions/a").get();
    assert.equal(snap.exists, true);
    assert.deepEqual(snap.data(), { rank: 1 });
    assert.equal(typeof snap.meta.at, "number");
    const missing = await cf.db.doc("decisions/zzz").get();
    assert.equal(missing.exists, false);
    const ref = await cf.db.collection("log").add({ kind: "x" });
    assert.match(ref.id, /^[0-9a-f]{20}$/);
    const filtered = await cf.db.collection("decisions").where("rank", ">", 1).get();
    assert.deepEqual(filtered.docs.map(d => d.id), ["b"]);
    assert.throws(() => cf.db.doc("decisions/bad id"), e => e.code === "invalid");
    assert.throws(() => cf.db.doc("too/many/parts"), e => e.code === "invalid");
    await t.admin("/pages/" + id, "PATCH", { mode: "locked" });
    await assert.rejects(cf.db.doc("decisions/a").set({ rank: 9 }), e => e.code === "locked");
    assert.equal(cf.canWrite, false);
    assert.ok(events.some(e => e.type === "cfdocs:mode" && e.detail.mode === "locked"));
  } finally {
    off();
    globalThis.window = savedWindow;
    globalThis.fetch = savedFetch;
  }
});

test("runtime: an archived page stops polling, tells listeners once and fires cfdocs:gone", async () => {
  const t = setup();
  const { id } = await newPage(t);
  const events = [];
  let fetches = 0;
  const savedWindow = globalThis.window, savedFetch = globalThis.fetch;
  globalThis.window = {
    __CFDOCS__: { id, title: "Demo page", mode: "open", version: 1 },
    dispatchEvent(ev) { events.push(ev.type); return true; },
  };
  globalThis.fetch = (url, init = {}) => {
    fetches++;
    const headers = { ...(init.headers || {}), "cf-connecting-ip": "192.0.2.2" };
    return worker.fetch(new Request(HOST + url, { ...init, headers }), t.env);
  };
  try {
    const cf = runtime();
    const errors = [];
    cf.db.collection("decisions").onSnapshot(() => {}, e => errors.push(e.code));
    cf.db.doc("signoff/final").onSnapshot(() => {}, e => errors.push(e.code));
    await new Promise(r => setTimeout(r, 30));
    await t.admin("/pages/" + id, "PATCH", { archived: true });
    await assert.rejects(cf.db.doc("decisions/a").set({ a: 1 }), e => e.code === "gone");
    assert.deepEqual(errors.sort(), ["gone", "gone"]);
    assert.deepEqual(events.filter(e => e === "cfdocs:gone"), ["cfdocs:gone"]);
    const late = [];
    cf.db.collection("log").onSnapshot(() => {}, e => late.push(e.code));
    await new Promise(r => setTimeout(r, 30));
    assert.deepEqual(late, ["gone"]);
    const before = fetches;
    await new Promise(r => setTimeout(r, 4300)); // longer than one poll interval
    assert.equal(fetches, before, "no requests after the page is gone");
  } finally {
    globalThis.window = savedWindow;
    globalThis.fetch = savedFetch;
  }
});

test("the site icon is served as SVG, a 32 px PNG favicon and a 180 px apple-touch-icon, and linked from pages", async () => {
  const t = setup();
  const svg = await t.call("/_/icon.svg");
  assert.equal(svg.headers.get("content-type"), "image/svg+xml");
  assert.match(await svg.text(), /^<svg /);
  for (const [path, size] of [["/favicon.ico", 32], ["/apple-touch-icon.png", 180]]) {
    const r = await t.call(path);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "image/png");
    const b = new Uint8Array(await r.arrayBuffer());
    assert.deepEqual([...b.subarray(1, 4)].map(c => String.fromCharCode(c)).join(""), "PNG");
    const view = new DataView(b.buffer, b.byteOffset);
    assert.equal(view.getUint32(16), size, path + " width");
  }
  const { id } = await newPage(t);
  const html = await (await t.call("/" + id)).text();
  assert.match(html, /<link rel="icon" href="\/favicon\.ico" sizes="32x32">/);
  assert.match(html, /<link rel="icon" href="\/_\/icon\.svg" type="image\/svg\+xml">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png">/);
  assert.match(await (await t.call("/")).text(), /rel="icon"/);
});
