// Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import worker from "../worker/worker.mjs";
import { extractDescription } from "../worker/dashboard.mjs";
import { fakeD1 } from "./fake-d1.mjs";

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
  const env = { DB: fakeD1(SCHEMA), ADMIN_TOKEN: TOKEN, ACCESS_TEAM: TEAM, ACCESS_AUD: AUD, ADMIN_EMAILS: `${OWNER}, second@example.com`, ...extraEnv };
  const call = (path, init = {}) => worker.fetch(new Request(HOST + path, init), env);
  const admin = (path, method = "GET", body) => call("/_admin" + path, {
    method, headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const dash = async (token) => call("/admin", token ? { headers: { "cf-access-jwt-assertion": token } } : {});
  return { env, call, admin, dash };
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
  const tampered = (await jwt()).replace(/.$/, c => (c === "A" ? "B" : "A"));
  const cases = {
    "no token": undefined,
    "garbage": "not.a.jwt",
    "tampered signature": tampered,
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
