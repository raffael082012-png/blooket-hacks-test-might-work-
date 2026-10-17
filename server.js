import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = process.env.PORT || 3000;

const jobs = new Map();
let jobSeq = 1;

/** Stub join — replace with real blooket join calls */
async function joinOnce(pin, name) {
  await new Promise((r) => setTimeout(r, 150 + Math.random() * 250));
  // TODO: real join request here
  return { ok: true, name, pin };
}

async function runRaid(jobId, { pin, name, count }) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "running";
  for (let i = 1; i <= count; i++) {
    if (job.status === "stopped") break;
    const botName = `${name}${i}`;
    job.current = botName;
    try {
      const res = await joinOnce(pin, botName);
      if (res.ok) {
        job.joined.push(botName);
        job.log.push(`ok ${botName}`);
      } else {
        job.failed.push(botName);
        job.log.push(`fail ${botName}: ${res.error || "?"}`);
      }
    } catch (e) {
      job.failed.push(botName);
      job.log.push(`err ${botName}: ${e.message || e}`);
    }
    job.done = i;
  }
  if (job.status !== "stopped") job.status = "done";
  job.current = null;
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
};

async function serveStatic(req, res) {
  let path = req.url.split("?")[0];
  if (path === "/") path = "/index.html";
  const file = join(__dirname, "public", path.replace(/^\//, ""));
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}

function json(res, code, body) {
  res.writeHead(code, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    });
    return res.end();
  }

  if (req.method === "POST" && req.url === "/raid") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let data;
    try { data = JSON.parse(body || "{}"); } catch { return json(res, 400, { error: "bad json" }); }
    const pin = String(data.pin || "").trim();
    const name = String(data.name || "HACKEDLOL").trim() || "HACKEDLOL";
    let count = parseInt(data.count, 10);
    if (!Number.isFinite(count) || count < 1) count = 10;
    if (count > 40) count = 40;
    if (!pin) return json(res, 400, { error: "pin required" });

    const id = String(jobSeq++);
    const job = {
      id, pin, name, count,
      status: "queued", done: 0, current: null,
      joined: [], failed: [], log: [], createdAt: Date.now(),
    };
    jobs.set(id, job);
    runRaid(id, { pin, name, count });
    return json(res, 200, { id, status: job.status, count });
  }

  const m = req.url && req.url.match(/^\/raid\/([^/?]+)$/);
  if (req.method === "GET" && m) {
    const job = jobs.get(m[1]);
    if (!job) return json(res, 404, { error: "unknown job" });
    return json(res, 200, {
      id: job.id, status: job.status, pin: job.pin, name: job.name,
      count: job.count, done: job.done, current: job.current,
      joined: job.joined, failed: job.failed, log: job.log.slice(-30),
    });
  }

  const mStop = req.url && req.url.match(/^\/raid\/([^/?]+)\/stop$/);
  if (req.method === "POST" && mStop) {
    const job = jobs.get(mStop[1]);
    if (!job) return json(res, 404, { error: "unknown job" });
    job.status = "stopped";
    job.log.push("stopped by user");
    return json(res, 200, { id: job.id, status: job.status });
  }

  return serveStatic(req, res);
});

server.listen(PORT, () => console.log("blooket-raid on :" + PORT));
