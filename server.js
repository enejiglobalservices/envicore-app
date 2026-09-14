// ENVI-CORE — server.
// Plain Node.js http server: no Express, no npm install required.
// Serves the frontend (public/) and a REST API backed by SQLite (db.js).

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
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

    const extension = path.extname(filePath);

    const contentTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json"
    };

    res.writeHead(200, {
      "Content-Type": contentTypes[extension] || "text/plain"
    });

    res.end(content);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`ENVI-CORE is live on port ${PORT}`);
});
