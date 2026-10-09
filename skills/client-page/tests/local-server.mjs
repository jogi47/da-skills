// Serves the Worker locally on 127.0.0.1:<port> with an in-memory D1, for testing scripts/client-page.sh.
import http from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import worker from "../worker/worker.mjs";
import { fakeD1 } from "./fake-d1.mjs";
import { fakeR2 } from "./fake-r2.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const env = { DB: fakeD1(join(here, "..", "worker", "schema.sql")), FILES: fakeR2(), ADMIN_TOKEN: process.env.CLIENT_PAGE_ADMIN_TOKEN };
const port = Number(process.argv[2] || 8799);
http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await worker.fetch(new Request(`http://127.0.0.1:${port}${req.url}`, {
    method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
  }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, "127.0.0.1", () => console.log("listening " + port));
