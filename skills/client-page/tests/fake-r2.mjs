// A small stand-in for a Cloudflare R2 bucket binding, enough for the Worker's file routes.
export function fakeR2() {
  const store = new Map();
  const meta = (key, o) => ({ key, size: o.bytes.length, uploaded: o.uploaded, httpMetadata: { contentType: o.type }, httpEtag: `"${o.etag}"` });
  return {
    async put(key, body, opts = {}) {
      const bytes = new Uint8Array(await new Response(body).arrayBuffer());
      const o = { bytes, type: opts.httpMetadata && opts.httpMetadata.contentType, uploaded: new Date(), etag: `e${bytes.length}-${key.length}` };
      store.set(key, o);
      return meta(key, o);
    },
    async head(key) {
      const o = store.get(key);
      return o ? meta(key, o) : null;
    },
    async get(key, opts = {}) {
      const o = store.get(key);
      if (!o) return null;
      let bytes = o.bytes;
      if (opts.range) bytes = bytes.subarray(opts.range.offset, opts.range.offset + opts.range.length);
      return { ...meta(key, o), body: new Blob([bytes]).stream() };
    },
    async delete(key) { store.delete(key); },
    async list() {
      return { objects: [...store].map(([key, o]) => meta(key, o)), truncated: false };
    },
    raw: store,
  };
}
