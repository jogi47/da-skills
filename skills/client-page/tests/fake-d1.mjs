// A small stand-in for Cloudflare D1, backed by node:sqlite, so the Worker can be tested offline.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

export function fakeD1(schemaPath) {
  const db = new DatabaseSync(":memory:");
  if (schemaPath) db.exec(readFileSync(schemaPath, "utf8"));
  const plain = r => (r ? { ...r } : r);
  function prepare(sql) {
    let args = [];
    const stmt = {
      bind(...a) { args = a; return stmt; },
      async first(col) {
        const r = db.prepare(sql).get(...args);
        if (r === undefined) return null;
        return col ? r[col] : plain(r);
      },
      async all() { return { results: db.prepare(sql).all(...args).map(plain), success: true }; },
      async run() {
        const info = db.prepare(sql).run(...args);
        return { success: true, meta: { changes: Number(info.changes) } };
      },
    };
    return stmt;
  }
  return {
    prepare,
    async batch(stmts) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    raw: db,
  };
}
