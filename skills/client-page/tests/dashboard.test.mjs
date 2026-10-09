// Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import worker from "../worker/worker.mjs";
import { extractDescription } from "../worker/dashboard.mjs";
import { fakeD1 } from "./fake-d1.mjs";
import { fakeR2 } from "./fake-r2.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = join(here, "..", "worker", "schema.sql");
const HOST = "https://docs.example.test";
const TOKEN = "t".repeat(64);
const TEAM = "myteam.cloudflareaccess.com";
const AUD = "a".repeat(64);
const OWNER = "owner@example.com";

const keys = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true, ["sign", "verify"]);
const otherKeys = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true, ["sign", "verify"]);
const jwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "k1", alg: "RS256", use: "sig" };

// Access serves its signing keys at https://<team>/cdn-cgi/access/certs; the Worker fetches them.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url) === `https://${TEAM}/cdn-cgi/access/certs`) return Response.json({ keys: [jwk] });
  return realFetch(url, init);
};

const b64url = bytes => Buffer.from(bytes).toString("base64url");
async function jwt(claims = {}, { kid = "k1", key = keys.privateKey } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", kid }));
  const payload = b64url(JSON.stringify({ aud: [AUD], iss: `https://${TEAM}`, email: OWNER, iat: now, nbf: now, exp: now + 600, ...claims }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(header + "." + payload));
  return header + "." + payload + "." + b64url(new Uint8Array(sig));
}

function setup(extraEnv = {}) {
  const env = { DB: fakeD1(SCHEMA), FILES: fakeR2(), ADMIN_TOKEN: TOKEN, ACCESS_TEAM: TEAM, ACCESS_AUD: AUD, ADMIN_EMAILS: `${OWNER}, second@example.com`, ...extraEnv };
  const call = (path, init = {}) => worker.fetch(new Request(HOST + path, init), env);
  const admin = (path, method = "GET", body) => call("/_admin" + path, {
    method, headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const dash = async (token) => call("/admin", token ? { headers: { "cf-access-jwt-assertion": token } } : {});
  const act = async (id, action, { token, origin = HOST, header = "1", method = "POST" } = {}) => {
    const headers = {};
    if (token) headers["cf-access-jwt-assertion"] = token;
    if (origin) headers.origin = origin;
    if (header) headers["x-cfdocs-admin"] = header;
    return call(`/admin/api/pages/${id}/${action}`, { method, headers });
  };
  const upload = (key, bytes) => call("/_admin/files/" + key, {
    method: "PUT", body: bytes, headers: { authorization: "Bearer " + TOKEN, "content-type": "image/png", "content-length": String(bytes.length) },
  });
  const answer = (id, doc) => call(`/${id}/api/d/decisions/${doc}`, { method: "PUT", headers: { "x-cfdocs": "1", "content-type": "application/json" }, body: JSON.stringify({ status: "agreed" }) });
  return { env, call, admin, dash, act, upload, answer };
}

test("extractDescription prefers meta description, then the lede, then the first paragraph", () => {
  assert.equal(extractDescription('<meta name="description" content="From meta"><p class="lede">Lede</p>'), "From meta");
  assert.equal(extractDescription('<p>First</p><p class="intro lede">The <b>lede</b> &amp; more</p>'), "The lede & more");
  assert.equal(extractDescription("<title>x</title><p>Just a paragraph.</p>"), "Just a paragraph.");
  assert.equal(extractDescription('<script>var s = "<p>not this</p>";</script><p>This one</p>'), "This one");
  assert.equal(extractDescription("<h1>No paragraphs</h1>"), "");
  const long = extractDescription("<p>" + "word ".repeat(80) + "</p>");
  assert.ok(long.length <= 220 && long.endsWith("…"));
});

test("publishing stores a description (given or derived) and pages carry it in their meta tags", async () => {
  const t = setup();
  let r = await t.admin("/pages", "POST", { title: "With lede", html: '<p class="lede">Read and approve the rules.</p>' });
  const derived = await r.json();
  assert.equal(derived.description, "Read and approve the rules.");
  r = await t.admin("/pages", "POST", { title: "Explicit", description: "Given text", html: "<p>Other</p>" });
  assert.equal((await r.json()).description, "Given text");
  const html = await (await t.call("/" + derived.id)).text();
  assert.match(html, /<meta name="description" content="Read and approve the rules\.">/);
  assert.match(html, /<meta property="og:description" content="Read and approve the rules\.">/);
  const list = await (await t.admin("/pages")).json();
  assert.deepEqual(list.pages.map(p => p.description).sort(), ["Given text", "Read and approve the rules."]);
  await t.admin("/pages/" + derived.id, "PATCH", { description: "Changed" });
  assert.equal((await (await t.admin("/pages/" + derived.id)).json()).description, "Changed");
});

test("the dashboard lists every page for the owner with a valid Access token", async () => {
  const t = setup();
  const a = await (await t.admin("/pages", "POST", { title: "Refund rules", html: '<p class="lede">Approve how refunds work.</p>' })).json();
  const b = await (await t.admin("/pages", "POST", { title: "Old survey", html: "<p>Done.</p>" })).json();
  await t.admin("/pages/" + b.id, "PATCH", { archived: true });
  await t.call(`/${a.id}/api/d/decisions/x`, { method: "PUT", headers: { "x-cfdocs": "1", "content-type": "application/json" }, body: "{}" });
  // A page saved before descriptions existed gets one the first time the dashboard is opened.
  t.env.DB.raw.prepare("UPDATE pages SET description = '' WHERE id = ?").run(a.id);

  const r = await t.dash(await jwt());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.match(r.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  const html = await r.text();
  assert.match(html, /Signed in as <b>owner@example\.com<\/b>/);
  assert.match(html, /Refund rules/);
  assert.match(html, /Approve how refunds work\./);
  assert.match(html, /Old survey/);
  assert.match(html, /data-status="archived"/);
  assert.match(html, /1 saved entry/);
  assert.match(html, new RegExp(`${HOST}/${a.id}`));
  const row = t.env.DB.raw.prepare("SELECT description FROM pages WHERE id = ?").get(a.id);
  assert.equal(row.description, "Approve how refunds work.");
});

test("the dashboard escapes page titles and descriptions", async () => {
  const t = setup();
  await t.admin("/pages", "POST", { title: '<img src=x onerror="alert(1)">', description: "<script>alert(2)</script>", html: "<p>x</p>" });
  const html = await (await t.dash(await jwt())).text();
  assert.ok(!html.includes('<img src=x onerror="alert(1)">'));
  assert.ok(!html.includes("<script>alert(2)</script>"));
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
});

test("the dashboard looks like any unknown page without a valid owner token", async () => {
  const t = setup();
  const now = Math.floor(Date.now() / 1000);
  // Change a character in the middle of the signature: the last base64url character partly carries
  // padding bits, so changing it can leave the signature bytes unchanged.
  const parts = (await jwt()).split(".");
  parts[2] = parts[2].slice(0, 40) + (parts[2][40] === "A" ? "B" : "A") + parts[2].slice(41);
  const tampered = parts.join(".");
  const forgedPayload = (await jwt()).split(".");
  forgedPayload[1] = Buffer.from(JSON.stringify({ aud: [AUD], iss: `https://${TEAM}`, email: OWNER, exp: now + 600 })).toString("base64url");
  const cases = {
    "no token": undefined,
    "garbage": "not.a.jwt",
    "tampered signature": tampered,
    "payload swapped under a real signature": forgedPayload.join("."),
    "signed by another key": await jwt({}, { key: otherKeys.privateKey }),
    "unknown key id": await jwt({}, { kid: "nope" }),
    "wrong audience": await jwt({ aud: ["b".repeat(64)] }),
    "wrong issuer": await jwt({ iss: "https://evil.cloudflareaccess.com" }),
    "expired": await jwt({ exp: now - 10 }),
    "email not allowed": await jwt({ email: "stranger@example.com" }),
  };
  for (const [name, token] of Object.entries(cases)) {
    const r = await t.dash(token);
    assert.equal(r.status, 404, name);
    assert.match(await r.text(), /This page isn't available/, name);
  }
  // A second listed email works, case-insensitively.
  assert.equal((await t.dash(await jwt({ email: "Second@Example.com" }))).status, 200);
});

test("the dashboard is off unless Access and an email allowlist are configured", async () => {
  for (const env of [{ ACCESS_AUD: "" }, { ACCESS_TEAM: "" }, { ADMIN_EMAILS: "" }, { ACCESS_TEAM: "evil.example.com" }]) {
    const t = setup(env);
    assert.equal((await t.dash(await jwt())).status, 404, JSON.stringify(env));
  }
});

test("the root sends a signed-in owner to the dashboard and shows everyone else the 404 page", async () => {
  const t = setup();
  const signedIn = await t.call("/", { headers: { cookie: "theme=dark; CF_Authorization=abc.def.ghi" } });
  assert.equal(signedIn.status, 302);
  assert.equal(signedIn.headers.get("location"), "/admin");
  assert.equal((await t.call("/")).status, 404);
  const off = setup({ ACCESS_AUD: "" });
  assert.equal((await off.call("/", { headers: { cookie: "CF_Authorization=abc" } })).status, 404);
});

test("dashboard Delete removes the page, its answers and files only it uses, and keeps shared files", async () => {
  const t = setup();
  const img = new Uint8Array([1, 2, 3]);
  await t.upload("aaaaaaaaaaaa/only.png", img);
  await t.upload("bbbbbbbbbbbb/shared.png", img);
  const a = await (await t.admin("/pages", "POST", { title: "A", html: '<img src="/_/f/aaaaaaaaaaaa/only.png"><img src="/_/f/bbbbbbbbbbbb/shared.png">' })).json();
  const b = await (await t.admin("/pages", "POST", { title: "B", html: '<img src="/_/f/bbbbbbbbbbbb/shared.png">' })).json();
  await t.answer(a.id, "x"); await t.answer(a.id, "y"); await t.answer(b.id, "z");
  const r = await t.act(a.id, "delete", { token: await jwt() });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, deleted: a.id, records: 2, filesDeleted: 1, filesKept: 1 });
  assert.equal((await t.call("/" + a.id)).status, 404);
  assert.equal((await t.call("/_/f/aaaaaaaaaaaa/only.png")).status, 404);
  assert.equal((await t.call("/_/f/bbbbbbbbbbbb/shared.png")).status, 200);
  assert.equal(t.env.DB.raw.prepare("SELECT COUNT(*) AS n FROM records WHERE page_id = ?").get(a.id).n, 0);
  assert.equal(t.env.DB.raw.prepare("SELECT COUNT(*) AS n FROM records WHERE page_id = ?").get(b.id).n, 1);
  assert.equal((await t.act(a.id, "delete", { token: await jwt() })).status, 404);
});

test("dashboard Change link moves the page and its answers to a new uuid and turns the old link off", async () => {
  const t = setup();
  const a = await (await t.admin("/pages", "POST", { title: "A", html: "<p>x</p>" })).json();
  await t.answer(a.id, "x");
  const r = await t.act(a.id, "new-link", { token: await jwt() });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.old, a.id);
  assert.match(body.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(body.id, a.id);
  assert.equal(body.url, `${HOST}/${body.id}`);
  assert.equal((await t.call("/" + a.id)).status, 404);
  assert.equal((await (await t.call(`/${a.id}/api/c/decisions`)).json()).error, "gone");
  assert.equal((await t.call("/" + body.id)).status, 200);
  assert.equal((await (await t.call(`/${body.id}/api/c/decisions`)).json()).docs.length, 1);
});

test("dashboard actions need the owner's login, a same-site origin, the dashboard header and POST", async () => {
  const t = setup();
  const a = await (await t.admin("/pages", "POST", { title: "A", html: "<p>x</p>" })).json();
  const good = await jwt();
  assert.equal((await t.act(a.id, "delete", {})).status, 404, "no login");
  assert.equal((await t.act(a.id, "delete", { token: await jwt({ email: "stranger@example.com" }) })).status, 404, "not the owner");
  assert.equal((await t.act(a.id, "delete", { token: good, origin: "https://evil.example" })).status, 403, "other site");
  assert.equal((await t.act(a.id, "delete", { token: good, origin: null })).status, 403, "no origin");
  assert.equal((await t.act(a.id, "delete", { token: good, header: null })).status, 403, "no header");
  assert.equal((await t.act(a.id, "delete", { token: good, method: "GET" })).status, 405, "GET");
  assert.equal((await t.act(a.id, "explode", { token: good })).status, 404, "unknown action");
  assert.equal((await t.act("not-a-uuid", "delete", { token: good })).status, 404, "bad id");
  assert.equal((await t.call("/" + a.id)).status, 200, "still there after all refusals");
});

test("the bearer admin API can delete a page and give it a new link too", async () => {
  const t = setup();
  const a = await (await t.admin("/pages", "POST", { title: "A", html: "<p>x</p>" })).json();
  const moved = await (await t.admin(`/pages/${a.id}/new-link`, "POST")).json();
  assert.equal((await t.call("/" + moved.id)).status, 200);
  const del = await t.admin("/pages/" + moved.id, "DELETE");
  assert.equal(del.status, 200);
  assert.equal((await del.json()).deleted, moved.id);
  assert.equal((await t.call("/" + moved.id)).status, 404);
});

test("the dashboard shows Change link and Delete on every row", async () => {
  const t = setup();
  await t.admin("/pages", "POST", { title: "A", html: "<p>x</p>" });
  const html = await (await t.dash(await jwt())).text();
  assert.match(html, /data-act="new-link"/);
  assert.match(html, /data-act="delete"/);
  assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, /<div class="menu" role="menu" hidden>/);
  assert.match(html, /Type DELETE to confirm/);
  // The confirmation dialog starts hidden, and its own display rule must not override that.
  assert.match(html, /<div class="modal" id="modal" hidden/);
  assert.match(html, /\[hidden\] \{ display: none !important; \}/);
});
