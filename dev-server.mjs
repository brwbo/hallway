import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.argv[2] || 5173);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".glb": "model/gltf-binary", ".txt": "text/plain" };

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return raw; }
}

async function runApi(req, res, url) {
  const name = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
  const file = join(root, "api", `${name}.js`);
  if (!normalize(file).startsWith(join(root, "api"))) { res.writeHead(400); return res.end(); }
  try { await stat(file); } catch { res.writeHead(404, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: "no such endpoint" })); }
  req.body = await readBody(req);
  req.query = Object.fromEntries(url.searchParams);
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
  try {
    const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
    await mod.default(req, res);
  } catch (e) { console.error(e); if (!res.writableEnded) { res.statusCode = 500; res.json({ error: String(e.message || e) }); } }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname.startsWith("/api/")) return runApi(req, res, url);
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith("/")) path += "index.html";
  let file = join(root, normalize(path));
  if (!file.startsWith(root)) { res.writeHead(400); return res.end(); }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    if (!extname(file)) file += ".html";
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
}).listen(port, () => console.log(`hallway dev on http://localhost:${port}`));
