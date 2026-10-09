// client-page Worker: serves published pages at /<uuid> and keeps each page's saved answers in D1.
//
// Public routes
//   GET  /<uuid>                         the page, wrapped in a skeleton that loads /_/rt.js
//   GET  /<uuid>/api/c/<collection>      every document in a collection (ETag-aware, for polling)
//   POST /<uuid>/api/c/<collection>      add a document under a generated id
//   GET  /<uuid>/api/d/<collection>/<id> one document
//   PUT  /<uuid>/api/d/<collection>/<id> replace a document
//   PATCH  …/d/<collection>/<id>         merge into a document (must exist)
//   DELETE …/d/<collection>/<id>         delete a document
//   GET  /_/rt.js?v=<version>            the in-page runtime (window.cfdocs); immutable per version
// Admin routes (Authorization: Bearer <ADMIN_TOKEN>) live under /_admin/pages.
//
// Visitors are anonymous: nothing about who wrote a document is stored.

import { runtime } from "./runtime.mjs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KEY_RE = /^[A-Za-z0-9_.~:@+-]{1,128}$/;
const MAX_HTML_BYTES = 1_800_000;   // D1 rows top out at 2 MB
const MAX_DOC_BYTES = 64 * 1024;
const MAX_RECORDS_PER_PAGE = 5000;
const WRITES_PER_MINUTE = 120;      // per client, across all pages
const MODES = new Set(["open", "locked"]);

const RUNTIME_JS = `(${runtime.toString()})();\n`;
// Pages load /_/rt.js?v=<hash of the runtime>, so a deploy changes the URL and no browser runs a stale copy.
const RT_VERSION = fnv1a(RUNTIME_JS);

const RESET = ":root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
  + "body{margin:0;font:14px/1.5 system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;background:#fafaf9;color:#1c1c1a}"
  + "img{max-width:100%}[hidden]{display:none!important}";

const CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const BASE_HEADERS = {
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
      console.error(e && e.stack || e);
      return json({ error: "server_error", message: "Something went wrong." }, 500);
    }
  },
};

class HttpError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}

/* ---------------- Routing ---------------- */

async function route(req, env) {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean).map(decodePart);
  const method = req.method;

  if (parts.length === 0) return notFoundPage();
  if (parts.length === 1 && parts[0] === "robots.txt") return text("User-agent: *\nDisallow: /\n");
  if (parts.length === 1 && parts[0] === "favicon.ico") return new Response(null, { status: 204, headers: BASE_HEADERS });
  if (parts[0] === "_") {
    if (parts[1] === "rt.js" && (method === "GET" || method === "HEAD")) {
      const current = url.searchParams.get("v") === RT_VERSION;
      return new Response(RUNTIME_JS, { headers: {
        ...BASE_HEADERS,
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": current ? "public, max-age=31536000, immutable" : "no-cache",
      } });
    }
    if (parts[1] === "health") return json({ ok: true });
    return notFoundPage();
  }
  if (parts[0] === "_admin") return admin(req, env, parts.slice(1), url);

  const id = parts[0];
  if (!UUID_RE.test(id)) return notFoundPage();
  if (parts.length === 1 && (method === "GET" || method === "HEAD")) return servePage(env, id);
  if (parts[1] === "api") return api(req, env, id, parts.slice(2));
  return notFoundPage();
}

function decodePart(p) {
  try { return decodeURIComponent(p); } catch { return p; }
}

/* ---------------- Page serving ---------------- */

async function servePage(env, id) {
  const page = await env.DB.prepare(
    "SELECT id, title, html, mode, version FROM pages WHERE id = ? AND archived_at IS NULL"
  ).bind(id).first();
  if (!page) return notFoundPage();
  return new Response(wrap(page), {
    headers: {
      ...BASE_HEADERS,
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": CSP,
      "cache-control": "no-store",
    },
  });
}

function wrap(page) {
  const boot = JSON.stringify({ id: page.id, title: page.title, mode: page.mode, version: page.version })
    .replace(/</g, "\\u003c");
  const head = '<meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<meta name="robots" content="noindex,nofollow">'
    + (page.title ? `<title>${escapeHtml(page.title)}</title><meta property="og:title" content="${escapeHtml(page.title)}">` : "")
    + `<style>${RESET}</style>`
    + `<script>window.__CFDOCS__=${boot}</script>`
    + `<script src="/_/rt.js?v=${RT_VERSION}"></script>`;
  const html = page.html;
  if (/^\s*(<!doctype|<html)/i.test(html)) {
    // A full document: keep it, and put the runtime first in its head.
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + head);
    return html.replace(/<html[^>]*>/i, m => m + "<head>" + head + "</head>");
  }
  return `<!doctype html><html lang="en"><head>${head}</head><body>${html}</body></html>`;
}

/* ---------------- Visitor API ---------------- */

async function api(req, env, pageId, parts) {
  const method = req.method;
  const page = await env.DB.prepare(
    "SELECT id, mode, version, rev FROM pages WHERE id = ? AND archived_at IS NULL"
  ).bind(pageId).first();
  // "gone" (not "not_found") so the runtime can tell an archived page from a missing document and stop polling.
  if (!page) throw new HttpError(404, "gone", "This page isn't available.");

  const [kind, collection, docId] = parts;
  if (!KEY_RE.test(collection || "")) throw new HttpError(400, "invalid", "Bad collection name.");

  if (kind === "c" && parts.length === 2) {
    if (method === "GET" || method === "HEAD") return listCollection(req, env, page, collection);
    if (method === "POST") {
      await guardWrite(req, env, page);
      const data = await readDoc(req);
      const id = newId();
      await writeDoc(env, page, collection, id, data);
      return json({ ok: true, id });
    }
    throw new HttpError(405, "method_not_allowed");
  }

  if (kind === "d" && parts.length === 3) {
    if (!KEY_RE.test(docId || "")) throw new HttpError(400, "invalid", "Bad document id.");
    if (method === "GET" || method === "HEAD") {
      const rec = await env.DB.prepare(
        "SELECT id, data, version, updated_at FROM records WHERE page_id = ? AND collection = ? AND id = ?"
      ).bind(page.id, collection, docId).first();
      return json(rec ? { exists: true, ...shapeRecord(rec) } : { exists: false, id: docId });
    }
    if (method === "PUT") {
      await guardWrite(req, env, page);
      const data = await readDoc(req);
      await writeDoc(env, page, collection, docId, data);
      return json({ ok: true, id: docId });
    }
    if (method === "PATCH") {
      await guardWrite(req, env, page);
      const patch = await readDoc(req);
      const rec = await env.DB.prepare(
        "SELECT data FROM records WHERE page_id = ? AND collection = ? AND id = ?"
      ).bind(page.id, collection, docId).first();
      if (!rec) throw new HttpError(404, "not_found", "That document doesn't exist yet.");
      const merged = deepMerge(JSON.parse(rec.data), patch);
      checkSize(merged);
      await writeDoc(env, page, collection, docId, merged);
      return json({ ok: true, id: docId });
    }
    if (method === "DELETE") {
      await guardWrite(req, env, page);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM records WHERE page_id = ? AND collection = ? AND id = ?").bind(page.id, collection, docId),
        env.DB.prepare("UPDATE pages SET rev = rev + 1 WHERE id = ?").bind(page.id),
      ]);
      return json({ ok: true, id: docId });
    }
    throw new HttpError(405, "method_not_allowed");
  }

  throw new HttpError(404, "not_found");
}

async function listCollection(req, env, page, collection) {
  const etag = `"r${page.rev}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ...BASE_HEADERS, etag, "cache-control": "no-store" } });
  }
  const { results } = await env.DB.prepare(
    "SELECT id, data, version, updated_at FROM records WHERE page_id = ? AND collection = ? ORDER BY id LIMIT ?"
  ).bind(page.id, collection, MAX_RECORDS_PER_PAGE).all();
  return json({ mode: page.mode, pageVersion: page.version, docs: results.map(shapeRecord) }, 200, { etag });
}

function shapeRecord(r) {
  return { id: r.id, data: JSON.parse(r.data), version: r.version, at: r.updated_at };
}

async function guardWrite(req, env, page) {
  // A custom header forces a CORS preflight, which this Worker never answers, so other sites can't write.
  if (req.headers.get("x-cfdocs") !== "1") throw new HttpError(403, "forbidden", "Missing request header.");
  if (page.mode !== "open") throw new HttpError(403, "locked", "This page no longer accepts answers.");
  if (await rateLimited(req, env)) throw new HttpError(429, "rate_limited", "Too many changes at once. Wait a minute and try again.");
}

async function readDoc(req) {
  const raw = await req.text();
  if (byteLength(raw) > MAX_DOC_BYTES) throw new HttpError(413, "too_large", "That entry is too large.");
  let data;
  try { data = JSON.parse(raw); } catch { throw new HttpError(400, "invalid", "The entry isn't valid JSON."); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new HttpError(400, "invalid", "An entry must be a JSON object.");
  return data;
}

function checkSize(data) {
  if (byteLength(JSON.stringify(data)) > MAX_DOC_BYTES) throw new HttpError(413, "too_large", "That entry is too large.");
}

async function writeDoc(env, page, collection, id, data) {
  const existing = await env.DB.prepare(
    "SELECT 1 AS x FROM records WHERE page_id = ? AND collection = ? AND id = ?"
  ).bind(page.id, collection, id).first();
  if (!existing) {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM records WHERE page_id = ?").bind(page.id).first();
    if (row.n >= MAX_RECORDS_PER_PAGE) throw new HttpError(507, "quota", "This page is full and can't save more entries.");
  }
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO records (page_id, collection, id, data, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?) "
      + "ON CONFLICT (page_id, collection, id) DO UPDATE SET data = excluded.data, version = records.version + 1, updated_at = excluded.updated_at"
    ).bind(page.id, collection, id, JSON.stringify(data), now, now),
    env.DB.prepare("UPDATE pages SET rev = rev + 1 WHERE id = ?").bind(page.id),
  ]);
}

async function rateLimited(req, env) {
  const ip = req.headers.get("cf-connecting-ip") || "local";
  const minute = Math.floor(Date.now() / 60000);
  const key = (await sha256Hex(ip)).slice(0, 24) + ":" + minute; // no raw IPs are stored
  const row = await env.DB.prepare(
    "INSERT INTO hits (k, n, exp) VALUES (?, 1, ?) ON CONFLICT (k) DO UPDATE SET n = n + 1 RETURNING n"
  ).bind(key, (minute + 2) * 60000).first();
  if (Math.random() < 0.05) await env.DB.prepare("DELETE FROM hits WHERE exp < ?").bind(Date.now()).run();
  return row.n > WRITES_PER_MINUTE;
}

/* ---------------- Admin API ---------------- */

async function admin(req, env, parts, url) {
  if (!(await authorized(req, env))) throw new HttpError(401, "unauthorized", "Admin token missing or wrong.");
  const method = req.method;
  const [res, id, sub, collection, docId] = parts;
  if (res !== "pages") throw new HttpError(404, "not_found");

  if (!id) {
    if (method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT p.id, p.title, p.mode, p.version, p.created_at, p.updated_at, p.archived_at, "
        + "(SELECT COUNT(*) FROM records r WHERE r.page_id = p.id) AS records FROM pages p ORDER BY p.updated_at DESC"
      ).all();
      return json({ pages: results.map(p => ({ ...p, url: pageUrl(url, p.id) })) });
    }
    if (method === "POST") {
      const body = await readAdminBody(req);
      return json(await upsertPage(env, url, crypto.randomUUID(), body, true));
    }
    throw new HttpError(405, "method_not_allowed");
  }

  if (!UUID_RE.test(id)) throw new HttpError(400, "invalid", "Page ids are lowercase uuid v4.");

  if (!sub) {
    if (method === "GET") {
      const page = await env.DB.prepare(
        "SELECT id, title, mode, version, created_at, updated_at, archived_at" + (url.searchParams.get("html") === "1" ? ", html" : "")
        + " FROM pages WHERE id = ?"
      ).bind(id).first();
      if (!page) throw new HttpError(404, "not_found");
      return json({ ...page, url: pageUrl(url, id) });
    }
    if (method === "PUT") {
      const body = await readAdminBody(req);
      return json(await upsertPage(env, url, id, body, false));
    }
    if (method === "PATCH") {
      const body = await readAdminBody(req);
      const sets = [], args = [];
      if (body.mode !== undefined) {
        if (!MODES.has(body.mode)) throw new HttpError(400, "invalid", "mode must be open or locked.");
        sets.push("mode = ?"); args.push(body.mode);
      }
      if (body.title !== undefined) { sets.push("title = ?"); args.push(String(body.title)); }
      if (body.archived === true) { sets.push("archived_at = ?"); args.push(Date.now()); }
      if (body.archived === false) { sets.push("archived_at = NULL"); }
      if (!sets.length) throw new HttpError(400, "invalid", "Nothing to change.");
      sets.push("rev = rev + 1", "updated_at = ?"); args.push(Date.now());
      const r = await env.DB.prepare(`UPDATE pages SET ${sets.join(", ")} WHERE id = ?`).bind(...args, id).run();
      if (!r.meta || !r.meta.changes) throw new HttpError(404, "not_found");
      return json({ ok: true, id, url: pageUrl(url, id) });
    }
    throw new HttpError(405, "method_not_allowed");
  }

  if (sub === "records") {
    if (!collection && method === "GET") {
      const only = url.searchParams.get("collection");
      const stmt = only
        ? env.DB.prepare("SELECT collection, id, data, version, created_at, updated_at FROM records WHERE page_id = ? AND collection = ? ORDER BY collection, id").bind(id, only)
        : env.DB.prepare("SELECT collection, id, data, version, created_at, updated_at FROM records WHERE page_id = ? ORDER BY collection, id").bind(id);
      const { results } = await stmt.all();
      return json({ page: id, records: results.map(r => ({ ...r, data: JSON.parse(r.data) })) });
    }
    if (collection && docId && method === "DELETE") {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM records WHERE page_id = ? AND collection = ? AND id = ?").bind(id, collection, docId),
        env.DB.prepare("UPDATE pages SET rev = rev + 1 WHERE id = ?").bind(id),
      ]);
      return json({ ok: true });
    }
  }
  throw new HttpError(404, "not_found");
}

async function upsertPage(env, url, id, body, mustBeNew) {
  if (typeof body.html !== "string" || !body.html.trim()) throw new HttpError(400, "invalid", "html is required.");
  if (byteLength(body.html) > MAX_HTML_BYTES) throw new HttpError(413, "too_large", "The page is larger than 1.8 MB.");
  if (body.mode !== undefined && !MODES.has(body.mode)) throw new HttpError(400, "invalid", "mode must be open or locked.");
  const title = typeof body.title === "string" ? body.title.slice(0, 200) : "";
  const now = Date.now();
  const existing = await env.DB.prepare("SELECT version FROM pages WHERE id = ?").bind(id).first();
  if (existing && mustBeNew) throw new HttpError(409, "conflict");
  if (existing) {
    await env.DB.prepare(
      "UPDATE pages SET title = ?, html = ?, mode = COALESCE(?, mode), version = version + 1, rev = rev + 1, updated_at = ? WHERE id = ?"
    ).bind(title, body.html, body.mode ?? null, now, id).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO pages (id, title, html, mode, version, rev, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)"
    ).bind(id, title, body.html, body.mode ?? "open", now, now).run();
  }
  const page = await env.DB.prepare("SELECT id, title, mode, version, archived_at FROM pages WHERE id = ?").bind(id).first();
  return { ...page, created: !existing, url: pageUrl(url, id) };
}

async function readAdminBody(req) {
  const raw = await req.text();
  if (byteLength(raw) > MAX_HTML_BYTES + 64 * 1024) throw new HttpError(413, "too_large", "The page is larger than 1.8 MB.");
  try {
    const b = JSON.parse(raw || "{}");
    if (!b || typeof b !== "object" || Array.isArray(b)) throw new Error("not an object");
    return b;
  } catch {
    throw new HttpError(400, "invalid", "Body must be a JSON object.");
  }
}

async function authorized(req, env) {
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const expected = env.ADMIN_TOKEN || "";
  if (expected.length < 32 || token.length !== expected.length) return false;
  const a = new TextEncoder().encode(token), b = new TextEncoder().encode(expected);
  if (crypto.subtle && typeof crypto.subtle.timingSafeEqual === "function") return crypto.subtle.timingSafeEqual(a, b);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function pageUrl(url, id) {
  return `${url.protocol}//${url.host}/${id}`;
}

/* ---------------- Helpers ---------------- */

function deepMerge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])
      ? deepMerge(out[k], v)
      : v;
  }
  return out;
}

function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

function newId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

function byteLength(s) {
  return new TextEncoder().encode(s).length;
}

async function sha256Hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}

function text(body, status = 200) {
  return new Response(body, { status, headers: { ...BASE_HEADERS, "content-type": "text/plain; charset=utf-8" } });
}

function notFoundPage() {
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow"><title>Not available</title>'
    + `<style>${RESET}main{max-width:32rem;margin:20vh auto;padding:0 16px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#666;margin:0}</style></head>`
    + "<body><main><h1>This page isn't available</h1><p>Check the link you were sent, or ask the person who shared it.</p></main></body></html>";
  return new Response(html, {
    status: 404,
    headers: { ...BASE_HEADERS, "content-type": "text/html; charset=utf-8", "content-security-policy": CSP, "cache-control": "no-store" },
  });
}
