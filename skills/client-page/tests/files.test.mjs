// Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import worker from "../worker/worker.mjs";
import { fakeD1 } from "./fake-d1.mjs";
import { fakeR2 } from "./fake-r2.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = join(here, "..", "worker", "schema.sql");
const HOST = "https://docs.example.test";
const TOKEN = "t".repeat(64);
const KEY = "0123456789ab/screen-1.png";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 40 }, (_, i) => i)]);

function setup(withFiles = true) {
  const env = { DB: fakeD1(SCHEMA), ADMIN_TOKEN: TOKEN, ...(withFiles ? { FILES: fakeR2() } : {}) };
  const call = (path, init = {}) => worker.fetch(new Request(HOST + path, init), env);
  const upload = (key, body, type = "image/png", auth = TOKEN) => call("/_admin/files/" + key, {
    method: "PUT", body, headers: { authorization: "Bearer " + auth, "content-type": type, "content-length": String(body.length) },
  });
  return { env, call, upload };
}

test("the owner uploads a file and anyone can fetch it, with the right type and long caching", async () => {
  const t = setup();
  const r = await t.upload(KEY, PNG);
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.path, "/_/f/" + KEY);
  assert.equal(body.url, `${HOST}/_/f/${KEY}`);
  const f = await t.call("/_/f/" + KEY);
  assert.equal(f.status, 200);
  assert.equal(f.headers.get("content-type"), "image/png");
  assert.match(f.headers.get("cache-control"), /immutable/);
  assert.match(f.headers.get("content-security-policy"), /sandbox/);
  assert.equal(f.headers.get("accept-ranges"), "bytes");
  assert.deepEqual(new Uint8Array(await f.arrayBuffer()), PNG);
  const h = await t.call("/_/f/" + KEY, { method: "HEAD" });
  assert.equal(h.headers.get("content-length"), String(PNG.length));
});

test("video-style range requests get 206 partial content, and impossible ranges get 416", async () => {
  const t = setup();
  await t.upload("aaaaaaaaaaaa/clip.mp4", PNG, "video/mp4");
  let r = await t.call("/_/f/aaaaaaaaaaaa/clip.mp4", { headers: { range: "bytes=0-3" } });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("content-range"), `bytes 0-3/${PNG.length}`);
  assert.deepEqual([...new Uint8Array(await r.arrayBuffer())], [...PNG.subarray(0, 4)]);
  r = await t.call("/_/f/aaaaaaaaaaaa/clip.mp4", { headers: { range: "bytes=10-" } });
  assert.equal(r.headers.get("content-range"), `bytes 10-${PNG.length - 1}/${PNG.length}`);
  r = await t.call("/_/f/aaaaaaaaaaaa/clip.mp4", { headers: { range: "bytes=-5" } });
  assert.equal(r.headers.get("content-range"), `bytes ${PNG.length - 5}-${PNG.length - 1}/${PNG.length}`);
  r = await t.call("/_/f/aaaaaaaaaaaa/clip.mp4", { headers: { range: "bytes=9999-" } });
  assert.equal(r.status, 416);
});

test("only the owner can upload, and only images, video, audio and PDF", async () => {
  const t = setup();
  assert.equal((await t.upload(KEY, PNG, "image/png", "x".repeat(64))).status, 401);
  assert.equal((await t.call("/_admin/files/" + KEY, { method: "PUT", body: PNG })).status, 401);
  assert.equal((await t.upload(KEY, PNG, "text/html")).status, 415);
  assert.equal((await t.upload(KEY, PNG, "application/javascript")).status, 415);
  assert.equal((await t.upload("not-a-hash/x.png", PNG)).status, 400);
  assert.equal((await t.upload("0123456789ab/../x.png", PNG)).status, 400);
  // Visitors have no upload route at all.
  assert.equal((await t.call("/_/f/" + KEY, { method: "PUT", body: PNG })).status, 404);
});

test("missing files and malformed keys are the ordinary 404 page", async () => {
  const t = setup();
  assert.equal((await t.call("/_/f/0123456789ab/none.png")).status, 404);
  assert.equal((await t.call("/_/f/whatever")).status, 404);
});

test("the owner can list and remove files", async () => {
  const t = setup();
  await t.upload(KEY, PNG);
  const list = await (await t.call("/_admin/files", { headers: { authorization: "Bearer " + TOKEN } })).json();
  assert.equal(list.files.length, 1);
  assert.equal(list.files[0].type, "image/png");
  assert.equal((await t.call("/_admin/files/" + KEY, { method: "DELETE", headers: { authorization: "Bearer " + TOKEN } })).status, 200);
  assert.equal((await t.call("/_/f/" + KEY)).status, 404);
});

test("without a bucket the file routes are off, and pages allow same-site media", async () => {
  const t = setup(false);
  assert.equal((await t.call("/_/f/" + KEY)).status, 404);
  const r = await t.upload(KEY, PNG);
  assert.equal(r.status, 501);
  assert.equal((await r.json()).error, "files_off");
  const page = await (await t.call("/_admin/pages", { method: "POST", headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" }, body: JSON.stringify({ title: "x", html: "<p>x</p>" }) })).json();
  const csp = (await t.call("/" + page.id)).headers.get("content-security-policy");
  assert.match(csp, /img-src 'self'/);
  assert.match(csp, /media-src 'self'/);
});

test("128-bit file keys (new uploads) and 48-bit ones (older uploads) both work", async () => {
  const t = setup();
  const long = "0123456789abcdef0123456789abcdef/screen.png";
  assert.equal((await t.upload(long, PNG)).status, 200);
  assert.equal((await t.call("/_/f/" + long)).status, 200);
  assert.equal((await t.upload(KEY, PNG)).status, 200);
  assert.equal((await t.call("/_/f/" + KEY)).status, 200);
  assert.equal((await t.upload("0123456789a/short.png", PNG)).status, 400, "11 hex is too short");
});
