// The in-page runtime. The Worker serves `(${runtime.toString()})()` at /_/rt.js, so this function
// must be self-contained: no imports, no references to anything outside its own body.
//
// It defines window.cfdocs:
//   cfdocs.page                 { id, title, version, mode }   (mode: "open" | "locked")
//   cfdocs.canWrite             true while the page accepts answers
//   cfdocs.db.collection(name)  query + add + doc(id)
//   cfdocs.db.doc("col/id")     get / set / update / delete / onSnapshot
// Snapshots stay live by polling the page's API (every 4 s while visible, 30 s while hidden).

export function runtime() {
  "use strict";
  var boot = (typeof window !== "undefined" && window.__CFDOCS__) || {};
  var KEY_RE = /^[A-Za-z0-9_.~:@+-]{1,128}$/;
  var base = "/" + boot.id + "/api";
  var state = { mode: boot.mode || "locked", version: boot.version || 0, notified: false, gone: false };
  var pollers = new Map();

  function fail(code, message) {
    var e = new Error(message || code);
    e.code = code;
    return e;
  }
  function enc(s) { return encodeURIComponent(s); }
  function checkKey(k, what) {
    if (typeof k !== "string" || !KEY_RE.test(k)) throw fail("invalid", "Bad " + what + ": use letters, digits and _ . ~ : @ + - (max 128).");
  }
  function checkObject(d) {
    if (!d || typeof d !== "object" || Array.isArray(d)) throw fail("invalid", "Documents must be plain objects.");
  }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function newId() {
    var c = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now();
    return c.replace(/-/g, "").slice(0, 20);
  }

  async function call(method, path, body) {
    var res, data = null;
    var headers = { "x-cfdocs": "1" };
    if (body !== undefined) headers["content-type"] = "application/json";
    try {
      res = await fetch(base + path, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
    } catch (e) {
      throw fail("network", "Couldn't reach the server. Check your connection and try again.");
    }
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      var err = fail((data && data.error) || "server_error", data && data.message);
      if (err.code === "locked") setMode("locked");
      if (err.code === "gone") pageGone(err);
      throw err;
    }
    return data;
  }

  function setMode(mode) {
    if (!mode || mode === state.mode) return;
    state.mode = mode;
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("cfdocs:mode", { detail: { mode: mode } }));
    }
  }

  function noteVersion(v) {
    if (!v || v <= state.version || state.notified) return;
    state.notified = true;
    if (typeof window === "undefined" || !window.dispatchEvent) return;
    var ev = new CustomEvent("cfdocs:updated", { detail: { version: v }, cancelable: true });
    if (window.dispatchEvent(ev)) showBar("This page has been updated.", true);
  }

  // The page was archived or removed: stop every poller for good, tell listeners once, show a notice.
  function pageGone(err) {
    if (state.gone) return;
    state.gone = true;
    pollers.forEach(function (p) {
      clearTimeout(p.timer);
      var ls = Array.from(p.listeners);
      p.listeners.clear();
      ls.forEach(function (l) { if (l.error) { try { l.error(err); } catch (e) { console.error(e); } } });
    });
    if (typeof window === "undefined" || !window.dispatchEvent) return;
    var ev = new CustomEvent("cfdocs:gone", { cancelable: true });
    if (window.dispatchEvent(ev)) showBar("This page is no longer available.", false);
  }

  function showBar(text, withReload) {
    if (typeof document === "undefined" || !document.body) return;
    var bar = document.createElement("div");
    bar.setAttribute("role", "status");
    bar.style.cssText = "position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483000;"
      + "display:flex;gap:12px;align-items:center;max-width:calc(100% - 32px);padding:10px 14px;border-radius:10px;"
      + "background:#1c1c1a;color:#fafaf9;font:14px/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)";
    var msg = document.createElement("span");
    msg.textContent = text;
    bar.append(msg);
    if (withReload) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Reload";
      btn.style.cssText = "font:inherit;font-weight:600;color:inherit;background:transparent;border:1px solid rgba(255,255,255,.5);border-radius:6px;padding:4px 10px;cursor:pointer";
      btn.addEventListener("click", function () { location.reload(); });
      bar.append(btn);
    }
    document.body.append(bar);
  }

  /* ---------- Live collections (polling) ---------- */

  function poller(col) {
    var p = pollers.get(col);
    if (!p) {
      p = { col: col, etag: null, docs: null, listeners: new Set(), timer: null, busy: false, again: false };
      pollers.set(col, p);
    }
    return p;
  }

  async function refresh(p) {
    if (state.gone) return;
    if (p.busy) { p.again = true; return; }
    p.busy = true;
    try {
      var headers = { "x-cfdocs": "1" };
      if (p.etag) headers["if-none-match"] = p.etag;
      var res = await fetch(base + "/c/" + enc(p.col), { headers: headers, cache: "no-store" });
      if (res.status === 304) return;
      var body = null;
      try { body = await res.json(); } catch (e) { body = null; }
      if (!res.ok) {
        var err = fail((body && body.error) || "server_error", body && body.message);
        if (err.code === "gone") { pageGone(err); return; }
        p.listeners.forEach(function (l) { if (l.error) l.error(err); });
        return;
      }
      p.etag = res.headers.get("etag");
      p.docs = new Map(body.docs.map(function (d) { return [d.id, d]; }));
      setMode(body.mode);
      noteVersion(body.pageVersion);
      p.listeners.forEach(function (l) { try { l.fn(p); } catch (e) { console.error(e); } });
    } catch (e) {
      // Network blip: keep the last state and try again on the next tick.
    } finally {
      p.busy = false;
      if (p.again) { p.again = false; refresh(p); }
    }
  }

  function schedule(p) {
    clearTimeout(p.timer);
    if (state.gone || !p.listeners.size) return;
    var hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    p.timer = setTimeout(function () { refresh(p).then(function () { schedule(p); }); }, hidden ? 30000 : 4000);
  }

  function listen(col, l) {
    if (state.gone) {
      Promise.resolve().then(function () { if (l.error) l.error(fail("gone", "This page isn't available.")); });
      return function unsubscribe() {};
    }
    var p = poller(col);
    p.listeners.add(l);
    if (p.docs) Promise.resolve().then(function () { if (p.listeners.has(l)) l.fn(p); });
    else refresh(p);
    schedule(p);
    return function unsubscribe() {
      p.listeners.delete(l);
      if (!p.listeners.size) clearTimeout(p.timer);
    };
  }

  function kick(col) {
    var p = pollers.get(col);
    if (p && p.listeners.size) { refresh(p); schedule(p); }
  }

  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") pollers.forEach(function (p) { if (p.listeners.size) { refresh(p); schedule(p); } });
    });
  }

  /* ---------- Snapshots ---------- */

  function docSnap(id, rec) {
    return {
      id: id,
      exists: !!rec,
      data: function () { return rec ? clone(rec.data) : undefined; },
      meta: rec ? { at: rec.at, version: rec.version } : null,
    };
  }

  function compare(a, op, b) {
    switch (op) {
      case "==": return a === b;
      case "!=": return a !== b;
      case "<": return a < b;
      case "<=": return a <= b;
      case ">": return a > b;
      case ">=": return a >= b;
      case "in": return Array.isArray(b) && b.indexOf(a) !== -1;
      case "not-in": return Array.isArray(b) && b.indexOf(a) === -1;
      case "array-contains": return Array.isArray(a) && a.indexOf(b) !== -1;
      default: throw fail("invalid", "Unknown operator " + op);
    }
  }

  function query(col, filters, order, lim) {
    function apply(map) {
      var arr = Array.from(map.values());
      filters.forEach(function (f) { arr = arr.filter(function (d) { return compare(d.data ? d.data[f[0]] : undefined, f[1], f[2]); }); });
      if (order) {
        var field = order[0], dir = order[1] === "desc" ? -1 : 1;
        arr.sort(function (a, b) {
          var x = a.data ? a.data[field] : undefined, y = b.data ? b.data[field] : undefined;
          if (x === undefined && y !== undefined) return 1;
          if (y === undefined && x !== undefined) return -1;
          return x < y ? -dir : x > y ? dir : (a.id < b.id ? -1 : 1);
        });
      } else {
        arr.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
      }
      if (lim) arr = arr.slice(0, lim);
      return arr;
    }
    function snap(map) {
      var docs = apply(map).map(function (r) { return docSnap(r.id, r); });
      return { docs: docs, size: docs.length, empty: docs.length === 0 };
    }
    return {
      where: function (f, op, v) { return query(col, filters.concat([[f, op, v]]), order, lim); },
      orderBy: function (f, dir) { return query(col, filters, [f, dir || "asc"], lim); },
      limit: function (n) { return query(col, filters, order, n); },
      get: async function () {
        var body = await call("GET", "/c/" + enc(col));
        setMode(body.mode);
        return snap(new Map(body.docs.map(function (d) { return [d.id, d]; })));
      },
      onSnapshot: function (next, error) {
        return listen(col, { fn: function (p) { next(snap(p.docs)); }, error: error });
      },
    };
  }

  function collection(col) {
    checkKey(col, "collection name");
    var q = query(col, [], null, null);
    q.path = col;
    q.doc = function (id) { return doc(col, id === undefined ? newId() : id); };
    q.add = async function (data) {
      checkObject(data);
      var r = await call("POST", "/c/" + enc(col), data);
      kick(col);
      return doc(col, r.id);
    };
    return q;
  }

  function doc(col, id) {
    checkKey(col, "collection name");
    checkKey(id, "document id");
    var path = "/d/" + enc(col) + "/" + enc(id);
    return {
      id: id,
      path: col + "/" + id,
      get: async function () {
        var r = await call("GET", path);
        return docSnap(id, r.exists ? r : null);
      },
      set: async function (data) { checkObject(data); await call("PUT", path, data); kick(col); },
      update: async function (data) { checkObject(data); await call("PATCH", path, data); kick(col); },
      delete: async function () { await call("DELETE", path); kick(col); },
      onSnapshot: function (next, error) {
        return listen(col, { fn: function (p) { next(docSnap(id, p.docs.get(id) || null)); }, error: error });
      },
    };
  }

  function docByPath(path) {
    var parts = String(path).split("/");
    if (parts.length !== 2) throw fail("invalid", "Document paths are \"collection/id\".");
    return doc(parts[0], parts[1]);
  }

  var api = {
    page: Object.freeze({
      id: boot.id,
      title: boot.title,
      version: boot.version,
      get mode() { return state.mode; },
    }),
    get canWrite() { return state.mode === "open"; },
    db: Object.freeze({ collection: collection, doc: docByPath }),
  };
  if (typeof window !== "undefined") window.cfdocs = Object.freeze(api);
  return api;
}
