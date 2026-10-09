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
//   GET  /_/icon.svg, /favicon.ico,      the site icon (SVG, 32 px PNG, 180 px PNG for iOS home screens)
//        /apple-touch-icon.png
//   GET  /_/f/<hash>/<name>              an image, video, audio file or PDF the owner uploaded (R2; Range-aware)
//   GET  /admin                          the owner's dashboard (behind Cloudflare Access; see dashboard.mjs)
//   POST /admin/api/pages/<id>/new-link  dashboard action: move the page to a new uuid (old link stops working)
//   POST /admin/api/pages/<id>/delete    dashboard action: delete the page, its answers and files only it uses
//   GET  /                               redirects a signed-in owner to /admin; everyone else gets the 404 page
// Admin routes (Authorization: Bearer <ADMIN_TOKEN>) live under /_admin/pages and /_admin/files.
// Only the owner can add files (through the admin API); visitors can never upload anything.
//
// Visitors are anonymous: nothing about who wrote a document is stored.

import { runtime } from "./runtime.mjs";
import { ICON_SVG, ICON_PNG_32, ICON_PNG_180 } from "./icons.mjs";
import { verifyAccess, hasAccessCookie, extractDescription, renderDashboard } from "./dashboard.mjs";

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

const PNG_32 = Uint8Array.from(atob(ICON_PNG_32), c => c.charCodeAt(0));
const PNG_180 = Uint8Array.from(atob(ICON_PNG_180), c => c.charCodeAt(0));
const ICON_LINKS = '<link rel="icon" href="/favicon.ico" sizes="32x32">'
  + '<link rel="icon" href="/_/icon.svg" type="image/svg+xml">'
  + '<link rel="apple-touch-icon" href="/apple-touch-icon.png">';

const RESET = ":root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
  + "body{margin:0;font:14px/1.5 system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;background:#fafaf9;color:#1c1c1a}"
  + "img{max-width:100%}[hidden]{display:none!important}";

const CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
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

  if (parts.length === 0) {
    if (env.ACCESS_AUD && hasAccessCookie(req)) {
      return new Response(null, { status: 302, headers: { ...BASE_HEADERS, location: "/admin", "cache-control": "no-store" } });
    }
    return notFoundPage();
  }
  if (parts.length === 1 && parts[0] === "admin" && (method === "GET" || method === "HEAD")) return dashboard(req, env, url);
  if (parts[0] === "admin" && parts[1] === "api") return dashboardApi(req, env, url, parts.slice(2));
  if (parts.length === 1 && parts[0] === "robots.txt") return text("User-agent: *\nDisallow: /\n");
  if (parts.length === 1 && parts[0] === "favicon.ico") return icon(PNG_32, "image/png");
  if (parts.length === 1 && (parts[0] === "apple-touch-icon.png" || parts[0] === "apple-touch-icon-precomposed.png")) {
    return icon(PNG_180, "image/png");
  }
  if (parts[0] === "_") {
    if (parts[1] === "rt.js" && (method === "GET" || method === "HEAD")) {
      const current = url.searchParams.get("v") === RT_VERSION;
      return new Response(RUNTIME_JS, { headers: {
        ...BASE_HEADERS,
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": current ? "public, max-age=31536000, immutable" : "no-cache",
      } });
    }
    if (parts[1] === "icon.svg") return icon(ICON_SVG, "image/svg+xml");
    if (parts[1] === "f" && (method === "GET" || method === "HEAD")) return serveFile(req, env, parts.slice(2).join("/"));
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
    "SELECT id, title, description, html, mode, version FROM pages WHERE id = ? AND archived_at IS NULL"
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
    + (page.description ? `<meta name="description" content="${escapeHtml(page.description)}"><meta property="og:description" content="${escapeHtml(page.description)}">` : "")
    + ICON_LINKS
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

/* ---------------- Owner dashboard ---------------- */

// Dashboard buttons. Same owner check as the dashboard itself, plus proof the request came from the
// dashboard page: a same-site Origin and a custom header that other sites can't send without a preflight.
async function dashboardApi(req, env, url, parts) {
  const who = await verifyAccess(req, env);
  if (!who) return notFoundPage();
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
  if (req.headers.get("x-cfdocs-admin") !== "1" || req.headers.get("origin") !== `${url.protocol}//${url.host}`) {
    throw new HttpError(403, "forbidden", "This action can only be used from the dashboard.");
  }
  const [res, id, action] = parts;
  if (res !== "pages" || !UUID_RE.test(id || "")) throw new HttpError(404, "not_found");
  if (action === "delete") return json(await deletePage(env, id));
  if (action === "new-link") return json(await newLink(env, url, id));
  throw new HttpError(404, "not_found");
}

const FILE_REF_RE = /\/_\/f\/([0-9a-f]{12}\/[A-Za-z0-9._-]{1,120})/g;

// Deletes a page for good: the page, its saved answers, and every uploaded file that no other page uses.
async function deletePage(env, id) {
  const page = await env.DB.prepare("SELECT id, html FROM pages WHERE id = ?").bind(id).first();
  if (!page) throw new HttpError(404, "not_found", "That page doesn't exist.");
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM records WHERE page_id = ?").bind(id).first();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM records WHERE page_id = ?").bind(id),
    env.DB.prepare("DELETE FROM pages WHERE id = ?").bind(id),
  ]);
  let filesDeleted = 0, filesKept = 0;
  if (env.FILES) {
    const keys = new Set([...page.html.matchAll(FILE_REF_RE)].map(m => m[1]));
    for (const key of keys) {
      const used = await env.DB.prepare("SELECT 1 AS x FROM pages WHERE instr(html, ?) > 0 LIMIT 1").bind("/_/f/" + key).first();
      if (used) { filesKept++; continue; }
      await env.FILES.delete(key);
      filesDeleted++;
    }
  }
  return { ok: true, deleted: id, records: n, filesDeleted, filesKept };
}

// Gives a page a new uuid. The old link stops working at once; saved answers move with the page.
async function newLink(env, url, id) {
  const fresh = crypto.randomUUID();
  const [moved] = await env.DB.batch([
    env.DB.prepare("UPDATE pages SET id = ?, rev = rev + 1 WHERE id = ?").bind(fresh, id),
    env.DB.prepare("UPDATE records SET page_id = ? WHERE page_id = ?").bind(fresh, id),
  ]);
  if (!moved.meta || !moved.meta.changes) throw new HttpError(404, "not_found", "That page doesn't exist.");
  return { ok: true, old: id, id: fresh, url: pageUrl(url, fresh) };
}

async function dashboard(req, env, url) {
  const who = await verifyAccess(req, env);
  if (!who) return notFoundPage();
  // Older pages may have no stored description yet: derive it from their HTML once and keep it.
  const { results: missing } = await env.DB.prepare("SELECT id, html FROM pages WHERE description = ''").all();
  const fills = missing.map(p => [p.id, extractDescription(p.html)]).filter(([, d]) => d);
  if (fills.length) {
    await env.DB.batch(fills.map(([id, d]) => env.DB.prepare("UPDATE pages SET description = ? WHERE id = ?").bind(d, id)));
  }
  const { results } = await env.DB.prepare(
    "SELECT p.id, p.title, p.description, p.mode, p.version, p.created_at, p.updated_at, p.archived_at, "
    + "(SELECT COUNT(*) FROM records r WHERE r.page_id = p.id) AS records FROM pages p ORDER BY p.updated_at DESC"
  ).all();
  return new Response(renderDashboard({ host: url.host, email: who.email, pages: results, iconLinks: ICON_LINKS }), {
    headers: { ...BASE_HEADERS, "content-type": "text/html; charset=utf-8", "content-security-policy": CSP, "cache-control": "no-store" },
  });
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
  if (res === "files") return adminFiles(req, env, parts.slice(1).join("/"), url);
  if (res !== "pages") throw new HttpError(404, "not_found");

  if (!id) {
    if (method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT p.id, p.title, p.description, p.mode, p.version, p.created_at, p.updated_at, p.archived_at, "
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
        "SELECT id, title, description, mode, version, created_at, updated_at, archived_at" + (url.searchParams.get("html") === "1" ? ", html" : "")
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
      if (body.description !== undefined) { sets.push("description = ?"); args.push(String(body.description).slice(0, 300)); }
      if (body.archived === true) { sets.push("archived_at = ?"); args.push(Date.now()); }
      if (body.archived === false) { sets.push("archived_at = NULL"); }
      if (!sets.length) throw new HttpError(400, "invalid", "Nothing to change.");
      sets.push("rev = rev + 1", "updated_at = ?"); args.push(Date.now());
      const r = await env.DB.prepare(`UPDATE pages SET ${sets.join(", ")} WHERE id = ?`).bind(...args, id).run();
      if (!r.meta || !r.meta.changes) throw new HttpError(404, "not_found");
      return json({ ok: true, id, url: pageUrl(url, id) });
    }
    if (method === "DELETE") return json(await deletePage(env, id));
    throw new HttpError(405, "method_not_allowed");
  }

  if (sub === "new-link" && method === "POST") return json(await newLink(env, url, id));

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
  const description = typeof body.description === "string" && body.description.trim()
    ? body.description.trim().slice(0, 300)
    : extractDescription(body.html);
  const now = Date.now();
  const existing = await env.DB.prepare("SELECT version FROM pages WHERE id = ?").bind(id).first();
  if (existing && mustBeNew) throw new HttpError(409, "conflict");
  if (existing) {
    await env.DB.prepare(
      "UPDATE pages SET title = ?, description = ?, html = ?, mode = COALESCE(?, mode), version = version + 1, rev = rev + 1, updated_at = ? WHERE id = ?"
    ).bind(title, description, body.html, body.mode ?? null, now, id).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO pages (id, title, description, html, mode, version, rev, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)"
    ).bind(id, title, description, body.html, body.mode ?? "open", now, now).run();
  }
  const page = await env.DB.prepare("SELECT id, title, description, mode, version, archived_at FROM pages WHERE id = ?").bind(id).first();
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

/* ---------------- Files (owner uploads, stored in R2) ---------------- */

// Keys are "<first 12 hex of the file's SHA-256>/<file name>", chosen by the uploader (client-page.sh),
// so the same file always lands at the same URL and is never stored twice.
const FILE_KEY_RE = /^[0-9a-f]{12}\/[A-Za-z0-9._-]{1,120}$/;
const MAX_FILE_BYTES = 100 * 1024 * 1024; // Cloudflare's request-size limit on the free plan
const FILE_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/svg+xml",
  "video/mp4", "video/webm", "video/quicktime", "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg",
  "application/pdf",
]);
// A file opened on its own can never run script, even an SVG.
const FILE_CSP = "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox";

function parseRange(h) {
  const m = /^bytes=(\d*)-(\d*)$/.exec((h || "").trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") return { suffix: Number(m[2]) };
  const offset = Number(m[1]);
  return m[2] === "" ? { offset } : { offset, length: Number(m[2]) - offset + 1 };
}

async function serveFile(req, env, key) {
  if (!env.FILES || !FILE_KEY_RE.test(key)) return notFoundPage();
  const headers = {
    ...BASE_HEADERS,
    "cache-control": "public, max-age=31536000, immutable",
    "content-security-policy": FILE_CSP,
    "accept-ranges": "bytes",
  };
  const head = await env.FILES.head(key);
  if (!head) return notFoundPage();
  headers["content-type"] = (head.httpMetadata && head.httpMetadata.contentType) || "application/octet-stream";
  headers.etag = head.httpEtag;
  if (req.method === "HEAD") return new Response(null, { headers: { ...headers, "content-length": String(head.size) } });

  const range = parseRange(req.headers.get("range"));
  if (range) {
    const size = head.size;
    const start = "suffix" in range ? Math.max(0, size - range.suffix) : range.offset;
    const end = "suffix" in range || range.length === undefined ? size - 1 : Math.min(size - 1, range.offset + range.length - 1);
    if (start >= size || end < start) {
      return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
    }
    const obj = await env.FILES.get(key, { range: { offset: start, length: end - start + 1 } });
    if (!obj) return notFoundPage();
    return new Response(obj.body, { status: 206, headers: {
      ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1),
    } });
  }
  const obj = await env.FILES.get(key);
  if (!obj) return notFoundPage();
  return new Response(obj.body, { headers: { ...headers, "content-length": String(obj.size) } });
}

async function adminFiles(req, env, key, url) {
  if (!env.FILES) throw new HttpError(501, "files_off", "File storage isn't set up. Run: client-page.sh files-setup");
  if (!key) {
    if (req.method !== "GET") throw new HttpError(405, "method_not_allowed");
    const out = [];
    let cursor;
    do {
      const page = await env.FILES.list({ limit: 1000, cursor, include: ["httpMetadata"] });
      for (const o of page.objects) {
        out.push({ key: o.key, size: o.size, type: o.httpMetadata && o.httpMetadata.contentType, uploaded: o.uploaded, url: `${url.protocol}//${url.host}/_/f/${o.key}` });
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return json({ files: out });
  }
  if (!FILE_KEY_RE.test(key)) throw new HttpError(400, "invalid", "File keys are <12 hex>/<name> with letters, digits, dot, dash and underscore.");
  if (req.method === "PUT") {
    const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!FILE_TYPES.has(type)) throw new HttpError(415, "unsupported_type", "Only images, video, audio and PDF files can be uploaded.");
    const length = Number(req.headers.get("content-length") || "0");
    if (!length) throw new HttpError(411, "length_required", "Send the file with a Content-Length.");
    if (length > MAX_FILE_BYTES) throw new HttpError(413, "too_large", "Files can be up to 100 MB.");
    if (!req.body) throw new HttpError(400, "invalid", "The file is empty.");
    const obj = await env.FILES.put(key, req.body, { httpMetadata: { contentType: type } });
    return json({ ok: true, key, size: obj && obj.size, url: `${url.protocol}//${url.host}/_/f/${key}`, path: `/_/f/${key}` });
  }
  if (req.method === "DELETE") {
    await env.FILES.delete(key);
    return json({ ok: true, key });
  }
  throw new HttpError(405, "method_not_allowed");
}

function icon(body, type) {
  return new Response(body, { headers: { ...BASE_HEADERS, "content-type": type, "cache-control": "public, max-age=86400" } });
}

function text(body, status = 200) {
  return new Response(body, { status, headers: { ...BASE_HEADERS, "content-type": "text/plain; charset=utf-8" } });
}

function notFoundPage() {
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow"><title>Not available</title>' + ICON_LINKS
    + `<style>${RESET}main{max-width:32rem;margin:20vh auto;padding:0 16px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#666;margin:0}</style></head>`
    + "<body><main><h1>This page isn't available</h1><p>Check the link you were sent, or ask the person who shared it.</p></main></body></html>";
  return new Response(html, {
    status: 404,
    headers: { ...BASE_HEADERS, "content-type": "text/html; charset=utf-8", "content-security-policy": CSP, "cache-control": "no-store" },
  });
}
