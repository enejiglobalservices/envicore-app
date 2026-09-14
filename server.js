// ENVI-CORE — server.
// Plain Node.js http server: no Express, no npm install required.
// Serves the frontend (public/) and a REST API backed by SQLite (db.js).

const http = require("http");
const fs = require("fs");
const path = require("path");
const db = require("./db.js");

const PORT = process.env.PORT || 10000;

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function serveFile(req, res) {
  let filePath;

  if (req.url === "/" || req.url === "/index.html") {
    filePath = path.join(__dirname, "index.html");
  } else if (req.url === "/style.css") {
    filePath = path.join(__dirname, "style.css");
  } else if (req.url === "/app.js") {
    filePath = path.join(__dirname, "app.js");
  } else if (req.url === "/data.js") {
    filePath = path.join(__dirname, "data.js");
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server error");
      return;
    }

    const types = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript"
    };

    res.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "text/plain"
    });

    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // GET all incidents
    if (req.method === "GET" && url.pathname === "/api/incidents") {
      const incidents = db.getIncidents();
      return sendJSON(res, 200, incidents);
    }

    // GET one incident
    if (
      req.method === "GET" &&
      url.pathname.startsWith("/api/incidents/")
    ) {
      const id = url.pathname.split("/")[3];
      const incident = db.getIncident(id);

      if (!incident) {
        return sendJSON(res, 404, { error: "Incident not found" });
      }

      return sendJSON(res, 200, incident);
    }

    // Create incident
    if (req.method === "POST" && url.pathname === "/api/incidents") {
      const body = await readBody(req);
      const incident = db.createIncident(body);
      return sendJSON(res, 201, incident);
    }

    // Update incident
    if (
      req.method === "PATCH" &&
      url.pathname.startsWith("/api/incidents/")
    ) {
      const id = url.pathname.split("/")[3];
      const body = await readBody(req);
      const incident = db.updateIncident(id, body);

      if (!incident) {
        return sendJSON(res, 404, { error: "Incident not found" });
      }

      return sendJSON(res, 200, incident);
    }

    // Add note
    if (
      req.method === "POST" &&
      url.pathname.match(/^\/api\/incidents\/[^/]+\/notes$/)
    ) {
      const id = url.pathname.split("/")[3];
      const body = await readBody(req);
      const note = db.addNote(id, body.text);

      return sendJSON(res, 201, note);
    }

    // Serve frontend files
    if (req.method === "GET") {
      return serveFile(req, res);
    }

    sendJSON(res, 404, { error: "Route not found" });
  } catch (error) {
    console.error(error);
    sendJSON(res, 500, { error: error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`ENVI-CORE is live on port ${PORT}`);
});
