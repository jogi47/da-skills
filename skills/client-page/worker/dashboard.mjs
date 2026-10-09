// The owner's dashboard at /admin: every page with its title, description and status.
//
// Cloudflare Access (Zero Trust) puts a login in front of /admin; `client-page.sh admin-setup` creates
// that Access application. This module never trusts Access alone: it verifies the signed token Access
// adds to each request (RS256, issuer, audience, expiry) and requires the email to be on ADMIN_EMAILS.
// Anything short of that answers exactly like an unknown page.

const JWKS = { team: "", at: 0, keys: new Map() };

export async function verifyAccess(req, env) {
  const team = String(env.ACCESS_TEAM || "").trim().toLowerCase();
  const aud = String(env.ACCESS_AUD || "").trim();
  const allowed = String(env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team) || !aud || !allowed.length) return null;

  const token = req.headers.get("cf-access-jwt-assertion") || cookie(req, "CF_Authorization");
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let header, payload;
  try {
    header = JSON.parse(b64urlText(parts[0]));
    payload = JSON.parse(b64urlText(parts[1]));
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) return null;
  if (payload.iss !== `https://${team}`) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) return null;
  if (typeof payload.nbf === "number" && payload.nbf > now + 60) return null;

  const key = await accessKey(team, header.kid);
  if (!key) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1]));
  } catch {
    ok = false;
  }
  if (!ok) return null;
  const email = String(payload.email || "").toLowerCase();
  return email && allowed.includes(email) ? { email } : null;
}

// Access signing keys, cached for an hour; an unknown key id refetches at most once a minute.
async function accessKey(team, kid) {
  const age = Date.now() - JWKS.at;
  const sameTeam = JWKS.team === team;
  if (sameTeam && age < 3600_000 && JWKS.keys.has(kid)) return JWKS.keys.get(kid);
  if (sameTeam && age < 60_000) return JWKS.keys.get(kid) || null;
  let body;
  try {
    const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
    if (!r.ok) return null;
    body = await r.json();
  } catch {
    return null;
  }
  const keys = new Map();
  for (const k of (body && body.keys) || []) {
    if (k.kty !== "RSA" || !k.kid) continue;
    try {
      keys.set(k.kid, await crypto.subtle.importKey("jwk", { kty: "RSA", n: k.n, e: k.e, alg: "RS256", ext: true },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
    } catch { /* skip a key we can't use */ }
  }
  JWKS.team = team; JWKS.at = Date.now(); JWKS.keys = keys;
  return keys.get(kid) || null;
}

export function hasAccessCookie(req) {
  return !!cookie(req, "CF_Authorization");
}

function cookie(req, name) {
  const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : "";
}

function b64urlBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  s += "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

function b64urlText(s) {
  return new TextDecoder().decode(b64urlBytes(s));
}

/* ---------------- Descriptions ---------------- */

// A short description for a page: its <meta name="description">, else its lede paragraph, else its
// first paragraph. Plain text, at most about 220 characters.
export function extractDescription(html) {
  const src = String(html || "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const meta = src.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  let t = meta ? meta[1] : "";
  if (!t) {
    const p = src.match(/<p[^>]*class=["'][^"']*\blede\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i) || src.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    t = p ? p[1] : "";
  }
  t = decodeEntities(t.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return t.length > 220 ? t.slice(0, 217).replace(/\s+\S*$/, "") + "…" : t;
}

function decodeEntities(s) {
  return s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

/* ---------------- The dashboard page ---------------- */

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const ICON = {
  open: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/></svg>',
  copy: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>',
  more: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="12.5" cy="8" r="1.1"/></svg>',
  link: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 6.5A5.5 5.5 0 0 0 3.2 4.8M2.5 2.5v2.8h2.8M2.5 9.5a5.5 5.5 0 0 0 10.3 1.7M13.5 13.5v-2.8h-2.8"/></svg>',
  eye: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>',
  hide: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2l12 12M6.6 3.7A6.4 6.4 0 0 1 8 3.5c4.1 0 6.5 4.5 6.5 4.5a12 12 0 0 1-1.9 2.4M10.2 10.6A2 2 0 0 1 6.5 8.6M4.2 5.1A11.6 11.6 0 0 0 1.5 8s2.4 4.5 6.5 4.5c1 0 2-.3 2.8-.7"/></svg>',
  trash: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5h11M6.5 4.5V3a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1.5M4 4.5l.6 8.1a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.1M6.8 7v4M9.2 7v4"/></svg>',
};

function statusOf(p) {
  return p.archived_at ? "archived" : p.mode === "locked" ? "locked" : "open";
}

const STATUS_LABEL = { open: "Open", locked: "Locked", archived: "Hidden" };

export function renderDashboard({ host, email, pages, iconLinks }) {
  const counts = { open: 0, locked: 0, archived: 0 };
  for (const p of pages) counts[statusOf(p)]++;
  const rows = pages.map(p => {
    const s = statusOf(p);
    const title = p.title || "Untitled page";
    const url = `https://${host}/${p.id}`;
    const titleEl = s === "archived"
      ? `<span class="title">${esc(title)}</span>`
      : `<a class="title" href="/${esc(p.id)}" target="_blank" rel="noopener">${esc(title)}</a>`;
    return `<li class="row" data-id="${esc(p.id)}" data-name="${esc(title)}" data-status="${s}" data-title="${esc(title.toLowerCase())}" data-updated="${p.updated_at}" data-created="${p.created_at}" data-entries="${p.records}" data-text="${esc((title + " " + (p.description || "")).toLowerCase())}">
  <div class="main">
    ${titleEl}
    <p class="desc">${p.description ? esc(p.description) : '<span class="none">No description</span>'}</p>
    <div class="meta">
      <span class="status" data-s="${s}">${STATUS_LABEL[s]}</span>
      <span>${p.records} saved ${p.records === 1 ? "entry" : "entries"}</span>
      <span>Version ${p.version}</span>
      <span>Updated <time datetime="${new Date(p.updated_at).toISOString()}">${new Date(p.updated_at).toISOString().slice(0, 16).replace("T", " ")} UTC</time></span>
    </div>
    <div class="url mono">${esc(url)}</div>
  </div>
  <div class="actions">
    ${s === "archived"
      ? `<a class="btn" href="/admin/preview/${esc(p.id)}" target="_blank" rel="noopener" title="Only you can open this; visitors see &quot;not available&quot;">${ICON.eye}<span>Preview</span></a>`
      : `<a class="btn" href="/${esc(p.id)}" target="_blank" rel="noopener">${ICON.open}<span>Open</span></a>`}
    <button class="btn copy" type="button" data-url="${esc(url)}">${ICON.copy}<span class="label">Copy link</span></button>
    <div class="menu-wrap">
      <button class="btn icon more" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${esc(title)}" title="More actions">${ICON.more}</button>
      <div class="menu" role="menu" hidden>
        ${s === "archived"
          ? `<button type="button" role="menuitem" class="act" data-act="show">${ICON.eye}<span>Show page again</span><small>The same link works again</small></button>`
          : `<button type="button" role="menuitem" class="act" data-act="hide">${ICON.hide}<span>Hide page</span><small>Visitors see “not available”; nothing is deleted</small></button>`}
        <button type="button" role="menuitem" class="act" data-act="new-link">${ICON.link}<span>Change link</span><small>The old link stops working</small></button>
        <hr>
        <button type="button" role="menuitem" class="act danger" data-act="delete">${ICON.trash}<span>Delete page</span><small>Permanent, with its answers</small></button>
      </div>
    </div>
  </div>
</li>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>Pages · ${esc(host)}</title>
${iconLinks}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: one column; a toolbar (search, status filter, sort) over a list of page rows. */
:root {
  --paper: #f3f6f7; --surface: #ffffff; --ink: #16222a; --muted: #5a6a75; --line: #d8e0e5;
  --accent: #2450d6; --accent-soft: #e4ebfc; --danger: #b42318; --shade: rgba(10, 16, 22, .55);
  --open: #1d7448; --open-soft: #e0f1e7; --locked: #8a5a00; --locked-soft: #fbefd9; --arch: #5c6770; --arch-soft: #e8ecef;
  --font-display: "Bricolage Grotesque", "Avenir Next", "Segoe UI", system-ui, sans-serif;
  --font-body: "IBM Plex Sans", "Segoe UI", system-ui, -apple-system, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #0e151a; --surface: #152029; --ink: #e4ecf0; --muted: #98a9b4; --line: #26353f;
    --accent: #8eb0ff; --accent-soft: #1b2a4a; --danger: #ff8a7a; --shade: rgba(0, 0, 0, .65);
    --open: #63c992; --open-soft: #123020; --locked: #f0b45a; --locked-soft: #3a2a10; --arch: #a3b0b9; --arch-soft: #222c33;
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 15px/1.55 var(--font-body); padding-inline: 16px; padding-block: 0 64px; }
.wrap { max-width: 980px; margin: 0 auto; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
header.top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding-block: 28px 8px; }
.brand { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 13px; letter-spacing: .06em; text-transform: uppercase; font-weight: 600; }
.brand img { display: block; border-radius: 7px; }
.who { color: var(--muted); font-size: 13px; }
.who b { color: var(--ink); font-weight: 600; }
h1 { font-family: var(--font-display); font-weight: 700; font-size: clamp(30px, 5vw, 40px); letter-spacing: -.01em; margin: 18px 0 4px; }
.summary { margin: 0 0 20px; color: var(--muted); }
.tools { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 2; background: var(--paper); display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding-block: 10px; border-bottom: 1px solid var(--line); }
.search { flex: 1 1 240px; min-width: 0; }
.search input { width: 100%; font: inherit; font-size: 14px; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 99px; padding: 7px 14px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font: inherit; font-size: 13px; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 99px; padding: 4px 12px; cursor: pointer; }
.chip span { color: var(--muted); font-variant-numeric: tabular-nums; margin-left: 2px; }
.chip[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.chip[aria-pressed="true"] span { color: inherit; opacity: .75; }
.sort { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); }
.sort select { font: inherit; font-size: 13px; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px; }
.list { list-style: none; margin: 16px 0 0; padding: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
.row:first-child { border-top-left-radius: 11px; border-top-right-radius: 11px; }
.row:last-child { border-bottom-left-radius: 11px; border-bottom-right-radius: 11px; }
.row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 12px 24px; padding: 18px 20px; border-top: 1px solid var(--line); }
.row:first-child { border-top: 0; }
.row[data-status="archived"] { background: color-mix(in srgb, var(--paper) 55%, var(--surface)); }
.row[data-status="archived"] .title { color: var(--muted); }
.main { display: grid; gap: 6px; min-width: 0; }
.title { font-family: var(--font-display); font-weight: 600; font-size: 18px; color: var(--ink); text-decoration: none; text-wrap: balance; }
a.title:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
.desc { margin: 0; color: var(--muted); max-width: 70ch; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.desc .none { font-style: italic; }
.meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; color: var(--muted); align-items: center; }
.status { font-size: 12px; font-weight: 600; padding: 1px 9px; border-radius: 99px; }
.status[data-s="open"] { background: var(--open-soft); color: var(--open); }
.status[data-s="locked"] { background: var(--locked-soft); color: var(--locked); }
.status[data-s="archived"] { background: var(--arch-soft); color: var(--arch); }
.url { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
.actions { display: flex; gap: 8px; align-items: center; }
@media (max-width: 640px) { .actions { justify-content: flex-start; } }
.btn { display: inline-flex; align-items: center; gap: 7px; height: 34px; font: inherit; font-size: 13px; font-weight: 500; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 9px; padding: 0 12px; text-decoration: none; cursor: pointer; white-space: nowrap; transition: border-color .12s ease, color .12s ease, background .12s ease; }
.btn svg, .menu svg { width: 15px; height: 15px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.btn.icon { width: 34px; padding: 0; justify-content: center; }
.btn.more svg circle { fill: currentColor; stroke: none; }
.btn.more[aria-expanded="true"] { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
.menu-wrap { position: relative; }
.menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 5; min-width: 236px; display: grid; padding: 6px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 14px 36px rgba(10, 16, 22, .16); }
.menu button { display: grid; grid-template-columns: 16px minmax(0, 1fr); align-items: center; gap: 1px 10px; width: 100%; text-align: left; font: inherit; font-size: 14px; color: var(--ink); background: none; border: 0; border-radius: 8px; padding: 8px 10px; cursor: pointer; }
.menu button small { grid-column: 2; font-size: 12px; color: var(--muted); }
.menu button:hover, .menu button:focus-visible { background: var(--paper); outline: none; }
.menu button.danger, .menu button.danger svg { color: var(--danger); }
.menu hr { border: 0; border-top: 1px solid var(--line); margin: 4px 6px; }
@media (max-width: 640px) { .menu { right: auto; left: 0; } }
@media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
.btn:hover { border-color: var(--accent); color: var(--accent); }
.btn.disabled { color: var(--muted); cursor: default; }
.btn.disabled:hover { border-color: var(--line); color: var(--muted); }
.copy.done { background: var(--accent-soft); color: var(--accent); border-color: transparent; }
.btn.danger { color: var(--danger); }
.btn.danger:hover { border-color: var(--danger); color: var(--danger); }
.btn.solid { background: var(--accent); border-color: var(--accent); color: var(--surface); }
.btn.solid:hover { color: var(--surface); filter: brightness(1.08); }
.btn.solid.danger { background: var(--danger); border-color: var(--danger); color: var(--surface); }
.btn:disabled { opacity: .45; cursor: default; filter: none; }
.modal { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 16px; background: var(--shade); }
.sheet { width: min(520px, 100%); background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 14px; padding: 22px; display: grid; gap: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
.sheet h2 { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 22px; text-wrap: balance; }
.sheet p { margin: 0; color: var(--muted); }
.sheet .confirm { display: grid; gap: 6px; font-size: 14px; color: var(--muted); }
.sheet .confirm input { font: inherit; color: var(--ink); background: var(--paper); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; }
.sheet .newurl { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.sheet .newurl code { font-family: var(--font-mono); font-size: 13px; color: var(--ink); background: var(--paper); border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; overflow-wrap: anywhere; flex: 1 1 260px; }
.m-error { color: var(--danger) !important; }
.m-actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.empty { margin: 24px 0; text-align: center; color: var(--muted); }
footer { margin-top: 28px; font-size: 13px; color: var(--muted); }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (max-width: 640px) { .row { grid-template-columns: minmax(0, 1fr); } }
@media (min-width: 1440px) { body { zoom: 1.12; } }
@media (min-width: 1800px) { body { zoom: 1.25; } }
@media (min-width: 2300px) { body { zoom: 1.4; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="brand"><img src="/_/icon.svg" alt="" width="28" height="28">${esc(host)}</div>
    <div class="who">Signed in as <b>${esc(email)}</b></div>
  </header>
  <h1>Pages</h1>
  <p class="summary">${pages.length} ${pages.length === 1 ? "page" : "pages"} · ${counts.open} open · ${counts.locked} locked · ${counts.archived} hidden. Only you can see this list; visitors only ever see the page they were sent.</p>
  <div class="tools">
    <label class="search"><input id="q" type="search" placeholder="Search titles and descriptions" aria-label="Search pages" autocomplete="off"></label>
    <div class="chips" role="group" aria-label="Filter by status">
      <button class="chip" type="button" data-f="all" aria-pressed="true">All <span>${pages.length}</span></button>
      <button class="chip" type="button" data-f="open" aria-pressed="false">Open <span>${counts.open}</span></button>
      <button class="chip" type="button" data-f="locked" aria-pressed="false">Locked <span>${counts.locked}</span></button>
      <button class="chip" type="button" data-f="archived" aria-pressed="false">Hidden <span>${counts.archived}</span></button>
    </div>
    <label class="sort">Sort
      <select id="sort" aria-label="Sort pages">
        <option value="updated">Last updated</option>
        <option value="created">Newest first</option>
        <option value="title">Title A–Z</option>
        <option value="entries">Most saved entries</option>
      </select>
    </label>
  </div>
  ${pages.length ? `<ul class="list" id="list">\n${rows}\n</ul>` : ""}
  <p class="empty" id="empty"${pages.length ? " hidden" : ""}>${pages.length ? "No pages match." : "No pages yet. Ask Claude to publish one with the client-page skill."}</p>
  <footer>"Hide page" makes a link show "not available" without deleting anything; "Show page again" brings the same link back, and Preview lets you look at a hidden page. "Change link" gives a page a new address and turns the old one off. "Delete" removes a page, its saved entries and any files only it uses, for good.</footer>
</div>
<div class="modal" id="modal" hidden role="dialog" aria-modal="true" aria-labelledby="m-title">
  <div class="sheet">
    <h2 id="m-title"></h2>
    <div id="m-body"></div>
    <label class="confirm" id="m-confirm-wrap" hidden>Type DELETE to confirm<input id="m-confirm" autocomplete="off" spellcheck="false"></label>
    <p class="m-error" id="m-error" hidden></p>
    <div class="m-actions"><button class="btn" type="button" id="m-cancel">Cancel</button><button class="btn solid" type="button" id="m-go"></button></div>
  </div>
</div>
<script>
(function () {
  var list = document.getElementById("list");
  if (!list) return;
  var rows = Array.prototype.slice.call(list.children);
  var state = { q: "", f: "all", sort: "updated" };
  try {
    var fmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    document.querySelectorAll("time[datetime]").forEach(function (t) { t.textContent = fmt.format(new Date(t.getAttribute("datetime"))); });
  } catch (e) {}
  function apply() {
    var q = state.q.trim().toLowerCase(), shown = 0;
    var sorted = rows.slice().sort(function (a, b) {
      if (state.sort === "title") return a.dataset.title < b.dataset.title ? -1 : a.dataset.title > b.dataset.title ? 1 : 0;
      if (state.sort === "entries") return b.dataset.entries - a.dataset.entries;
      if (state.sort === "created") return b.dataset.created - a.dataset.created;
      return b.dataset.updated - a.dataset.updated;
    });
    sorted.forEach(function (r) {
      var ok = (state.f === "all" || r.dataset.status === state.f) && (!q || r.dataset.text.indexOf(q) !== -1);
      r.hidden = !ok;
      if (ok) shown++;
      list.appendChild(r);
    });
    document.getElementById("empty").hidden = shown > 0;
  }
  document.getElementById("q").addEventListener("input", function (e) { state.q = e.target.value; apply(); });
  document.getElementById("sort").addEventListener("change", function (e) { state.sort = e.target.value; apply(); });
  document.querySelectorAll(".chip[data-f]").forEach(function (c) {
    c.addEventListener("click", function () {
      state.f = c.dataset.f;
      document.querySelectorAll(".chip[data-f]").forEach(function (o) { o.setAttribute("aria-pressed", String(o === c)); });
      apply();
    });
  });
  list.addEventListener("click", function (e) {
    var b = e.target.closest(".copy");
    if (!b) return;
    var url = b.dataset.url;
    var label = b.querySelector(".label") || b;
    function done() { label.textContent = "Copied"; b.classList.add("done"); setTimeout(function () { label.textContent = "Copy link"; b.classList.remove("done"); }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { window.prompt("Copy this link:", url); });
    else window.prompt("Copy this link:", url);
  });
  /* Change link / Delete */
  var modal = document.getElementById("modal"), mTitle = document.getElementById("m-title"), mBody = document.getElementById("m-body");
  var mWrap = document.getElementById("m-confirm-wrap"), mInput = document.getElementById("m-confirm"), mErr = document.getElementById("m-error");
  var mGo = document.getElementById("m-go"), mCancel = document.getElementById("m-cancel");
  var current = null, opener = null, done = false;
  function para(text) { var p = document.createElement("p"); p.textContent = text; return p; }
  function openModal(row, act, btn) {
    current = { row: row, act: act }; opener = btn; done = false;
    var name = "\u201c" + row.dataset.name + "\u201d", entries = Number(row.dataset.entries);
    mErr.hidden = true; mInput.value = ""; mCancel.textContent = "Cancel"; mGo.hidden = false; mGo.disabled = false;
    mBody.replaceChildren();
    if (act === "hide") {
      mTitle.textContent = "Hide " + name + "?";
      mBody.append(para("Anyone with the link will see \u201cnot available\u201d, and anyone who has it open is told it is no longer available. Nothing is deleted: its " + entries + " saved " + (entries === 1 ? "entry" : "entries") + " and files are kept, you can still preview it from here, and you can show it again with the same link."));
      mWrap.hidden = true; mGo.textContent = "Hide page"; mGo.className = "btn solid";
    } else if (act === "show") {
      mTitle.textContent = "Show " + name + " again?";
      mBody.append(para("Its link works again, with its saved entries, for anyone who has it."));
      mWrap.hidden = true; mGo.textContent = "Show page"; mGo.className = "btn solid";
    } else if (act === "delete") {
      mTitle.textContent = "Delete " + name + "?";
      mBody.append(para("This removes the page and its " + entries + " saved " + (entries === 1 ? "entry" : "entries") + " for good, and its link stops working. Screenshots and files that only this page uses are deleted too. This can't be undone."));
      mWrap.hidden = false; mGo.textContent = "Delete page"; mGo.className = "btn solid danger"; mGo.disabled = true;
    } else {
      mTitle.textContent = "Give " + name + " a new link?";
      mBody.append(para("The current link stops working straight away: anyone who has it will see \u201cnot available\u201d. Saved entries stay with the page. Send the new link to the people who should still see it."));
      mWrap.hidden = true; mGo.textContent = "Change link"; mGo.className = "btn solid";
    }
    modal.hidden = false;
    (act === "delete" ? mInput : mGo).focus();
  }
  function closeModal() {
    modal.hidden = true;
    if (done) { location.reload(); return; }
    if (opener) opener.focus();
  }
  mInput.addEventListener("input", function () { mGo.disabled = mInput.value.trim() !== "DELETE"; });
  mCancel.addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", function (e) { if (!modal.hidden && e.key === "Escape") closeModal(); });
  mGo.addEventListener("click", function () {
    if (!current || mGo.disabled) return;
    var row = current.row, act = current.act;
    mGo.disabled = true; mErr.hidden = true;
    fetch("/admin/api/pages/" + encodeURIComponent(row.dataset.id) + "/" + act, {
      method: "POST", headers: { "x-cfdocs-admin": "1" }, credentials: "same-origin", cache: "no-store",
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) throw new Error(b.message || "Something went wrong (" + r.status + ")."); return b; });
    }).then(function (b) {
      done = true;
      if (act === "hide" || act === "show") { closeModal(); return; }
      mGo.hidden = true; mWrap.hidden = true; mCancel.textContent = "Close";
      mBody.replaceChildren();
      if (act === "delete") {
        mTitle.textContent = "Deleted";
        mBody.append(para(b.records + " saved " + (b.records === 1 ? "entry" : "entries") + " removed" + (b.filesDeleted || b.filesKept ? "; " + b.filesDeleted + " file" + (b.filesDeleted === 1 ? "" : "s") + " deleted" + (b.filesKept ? ", " + b.filesKept + " kept because other pages use them" : "") : "") + "."));
      } else {
        mTitle.textContent = "New link ready";
        mBody.append(para("The old link no longer works. The new one:"));
        var box = document.createElement("div"); box.className = "newurl";
        var code = document.createElement("code"); code.textContent = b.url;
        var copy = document.createElement("button"); copy.type = "button"; copy.className = "btn copy"; copy.dataset.url = b.url; copy.textContent = "Copy link";
        copy.addEventListener("click", function () {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(b.url).then(function () { copy.textContent = "Copied"; copy.classList.add("done"); }, function () { window.prompt("Copy this link:", b.url); });
          else window.prompt("Copy this link:", b.url);
        });
        box.append(code, copy); mBody.append(box);
      }
      mCancel.focus();
    }).catch(function (err) {
      mErr.textContent = err.message; mErr.hidden = false; mGo.disabled = act === "delete" && mInput.value.trim() !== "DELETE";
    });
  });
  var openMenu = null;
  function closeMenu(focusButton) {
    if (!openMenu) return;
    openMenu.menu.hidden = true;
    openMenu.button.setAttribute("aria-expanded", "false");
    if (focusButton) openMenu.button.focus();
    openMenu = null;
  }
  list.addEventListener("click", function (e) {
    var more = e.target.closest(".more");
    if (more) {
      var menu = more.parentElement.querySelector(".menu"), wasOpen = openMenu && openMenu.menu === menu;
      closeMenu(false);
      if (!wasOpen) {
        menu.hidden = false; more.setAttribute("aria-expanded", "true");
        openMenu = { menu: menu, button: more };
        menu.querySelector("button").focus();
      }
      return;
    }
    var b = e.target.closest(".act");
    if (b) {
      var trigger = openMenu ? openMenu.button : b;
      closeMenu(false);
      openModal(b.closest(".row"), b.dataset.act, trigger);
    }
  });
  document.addEventListener("click", function (e) { if (openMenu && !e.target.closest(".menu-wrap")) closeMenu(false); });
  document.addEventListener("keydown", function (e) {
    if (!openMenu) return;
    var items = Array.prototype.slice.call(openMenu.menu.querySelectorAll("button")), i = items.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); closeMenu(true); }
    else if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === "Tab") { closeMenu(false); }
  });
  apply();
})();
</script>
</body>
</html>`;
}
