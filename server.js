// ENVI-CORE — server.
// Plain Node.js http server: no Express, no npm install required.
// Serves the frontend (public/) and a REST API backed by SQLite (db.js).

const http = require("http");
const fs = require("fs");
const path = require("path");
const db = require("./db");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
};

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = "";
    req.on("data", (c) => (chunks += c));
    req.on("end", () => {
      if (!chunks) return resolve({});
      try {
        resolve(JSON.parse(chunks));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, urlPath) {
  let filePath = urlPath === "/" ? "/index.html" : urlPath;
  filePath = path.join(PUBLIC_DIR, filePath);

  // Prevent path traversal outside the public/ directory.
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean); // e.g. ["api","incidents","ENV-1001","notes"]

  try {
    // ---- REST API ----
    if (parts[0] === "api") {
      // GET /api/incidents
      if (req.method === "GET" && parts[1] === "incidents" && !parts[2]) {
        return sendJSON(res, 200, db.listIncidents());
      }

      // POST /api/incidents
      if (req.method === "POST" && parts[1] === "incidents" && !parts[2]) {
        const body = await readBody(req);
        if (!body.type || !body.description || !body.location) {
          return sendJSON(res, 400, { error: "type, description, and location are required" });
        }
        const incident = db.createIncident({
          type: body.type,
          description: body.description,
          location: body.location,
          lat: typeof body.lat === "number" ? body.lat : 5.55,
          lng: typeof body.lng === "number" ? body.lng : 5.75,
          reporterMode: body.reporterMode || "public",
        });
        return sendJSON(res, 201, incident);
      }

      // GET /api/incidents/:id
      if (req.method === "GET" && parts[1] === "incidents" && parts[2] && !parts[3]) {
        const incident = db.getIncident(parts[2]);
        if (!incident) return sendJSON(res, 404, { error: "not found" });
        return sendJSON(res, 200, incident);
      }

      // PATCH /api/incidents/:id  { status } or { assignedTo }
      if (req.method === "PATCH" && parts[1] === "incidents" && parts[2] && !parts[3]) {
        const body = await readBody(req);
        let incident = db.getIncident(parts[2]);
        if (!incident) return sendJSON(res, 404, { error: "not found" });

        if (body.status) incident = db.updateStatus(parts[2], body.status);
        if (body.assignedTo) incident = db.updateAssignment(parts[2], body.assignedTo);
        return sendJSON(res, 200, incident);
      }

      // POST /api/incidents/:id/notes  { text }
      if (req.method === "POST" && parts[1] === "incidents" && parts[2] && parts[3] === "notes") {
        const body = await readBody(req);
        if (!body.text || !body.text.trim()) {
          return sendJSON(res, 400, { error: "note text is required" });
        }
        const incident = db.addNote(parts[2], body.text.trim());
        if (!incident) return sendJSON(res, 404, { error: "not found" });
        return sendJSON(res, 200, incident);
      }

      return sendJSON(res, 404, { error: "no such endpoint" });
    }

    // ---- Static frontend ----
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error(err);
    return sendJSON(res, 500, { error: "internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`ENVI-CORE server running at http://localhost:${PORT}`);
  console.log(`Database file: ${path.join(__dirname, "envicore.db")}`);
});
