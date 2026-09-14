// ENVI-CORE — database layer.
// Uses Node's built-in node:sqlite (no external dependencies, no npm install).
// Requires Node.js 22+. Data persists to envicore.db in this folder.

const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const DB_PATH = path.join(__dirname, "envicore.db");
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    reported_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Unverified',
    assigned_to TEXT NOT NULL DEFAULT 'Unassigned',
    reporter_mode TEXT NOT NULL DEFAULT 'public'
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    at TEXT NOT NULL,
    text TEXT NOT NULL,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
  );
`);

let nextIdCounter = null;

function getNextId() {
  if (nextIdCounter === null) {
    const row = db.prepare("SELECT id FROM incidents ORDER BY id DESC LIMIT 1").get();
    if (row && row.id && row.id.startsWith("ENV-")) {
      nextIdCounter = parseInt(row.id.split("-")[1], 10);
    } else {
      nextIdCounter = 1000;
    }
  }
  nextIdCounter += 1;
  return "ENV-" + nextIdCounter;
}

function rowToIncident(row, notes) {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    location: row.location,
    lat: row.lat,
    lng: row.lng,
    reportedAt: row.reported_at,
    status: row.status,
    assignedTo: row.assigned_to,
    reporterMode: row.reporter_mode,
    notes: notes || [],
  };
}

function listIncidents() {
  const rows = db.prepare("SELECT * FROM incidents ORDER BY reported_at DESC").all();
  const notesStmt = db.prepare("SELECT at, text FROM notes WHERE incident_id = ? ORDER BY at ASC");
  return rows.map(row => rowToIncident(row, notesStmt.all(row.id)));
}

function getIncident(id) {
  const row = db.prepare("SELECT * FROM incidents WHERE id = ?").get(id);
  if (!row) return null;
  const notes = db.prepare("SELECT at, text FROM notes WHERE incident_id = ? ORDER BY at ASC").all(id);
  return rowToIncident(row, notes);
}

function createIncident({ type, description, location, lat, lng, reporterMode }) {
  const id = getNextId();
  const reportedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO incidents (id, type, description, location, lat, lng, reported_at, status, assigned_to, reporter_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Unverified', 'Unassigned', ?)
  `).run(id, type, description, location, lat, lng, reportedAt, reporterMode || "public");
  return getIncident(id);
}

function updateStatus(id, status) {
  db.prepare("UPDATE incidents SET status = ? WHERE id = ?").run(status, id);
  return getIncident(id);
}

function updateAssignment(id, assignedTo) {
  const incident = getIncident(id);
  if (!incident) return null;
  let newStatus = incident.status;
  if (assignedTo !== "Unassigned" && incident.status === "Verified") {
    newStatus = "Assigned";
  }
  db.prepare("UPDATE incidents SET assigned_to = ?, status = ? WHERE id = ?").run(assignedTo, newStatus, id);
  return getIncident(id);
}

function addNote(id, text) {
  const at = new Date().toISOString();
  db.prepare("INSERT INTO notes (incident_id, at, text) VALUES (?, ?, ?)").run(id, at, text);
  return getIncident(id);
}

function seedIfEmpty() {
  const { count } = db.prepare("SELECT COUNT(*) as count FROM incidents").get();
  if (count > 0) return;

  const seed = [
    ["ENV-1001", "Oil Spill", "Visible oil sheen on water surface near Forcados field area. Possible leak from nearby facility.", "Forcados, Delta State", 5.3479, 5.6037, "2026-08-24T09:10:00", "Verified", "Field Response Team A", "public"],
    ["ENV-1002", "Gas Flaring", "Unusual smoke and flare intensity at operational site, visible from residential area.", "Sapele, Delta State", 5.8940, 5.6770, "2026-08-24T14:05:00", "Under Review", "Unassigned", "public"],
    ["ENV-1003", "Water Pollution", "Contaminated water source reported by multiple households, discoloration and odour.", "Warri, Delta State", 5.5160, 5.7500, "2026-08-24T16:20:00", "Corroborated", "Local Govt. Env. Officer", "public"],
    ["ENV-1004", "Illegal Dumping", "Waste dumping in community open space, ongoing for several days.", "Ughelli, Delta State", 5.5000, 5.9800, "2026-08-24T18:30:00", "Unverified", "Unassigned", "public"],
    ["ENV-1005", "Air Pollution", "Persistent bad odour and smoke affecting several streets near industrial cluster.", "Burutu, Delta State", 5.3540, 5.5100, "2026-08-24T19:05:00", "Resolved", "Field Response Team B", "public"],
  ];
  const insert = db.prepare(`
    INSERT INTO incidents (id, type, description, location, lat, lng, reported_at, status, assigned_to, reporter_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of seed) insert.run(...row);

  const noteInsert = db.prepare("INSERT INTO notes (incident_id, at, text) VALUES (?, ?, ?)");
  noteInsert.run("ENV-1001", "2026-08-24T09:40:00", "Corroborated by second report from same location.");
  noteInsert.run("ENV-1001", "2026-08-24T13:00:00", "Verified by field officer photo evidence.");
  noteInsert.run("ENV-1003", "2026-08-24T17:00:00", "Two additional households confirmed same water source affected.");
  noteInsert.run("ENV-1005", "2026-08-25T08:00:00", "Site inspected, source identified and referred to operator.");
  noteInsert.run("ENV-1005", "2026-08-25T15:00:00", "Operator confirmed corrective action taken. Case closed.");
}

function updateIncident(id, changes) {
  const incident = getIncident(id);
  if (!incident) return null;

  if (changes.status !== undefined) {
    updateStatus(id, changes.status);
  }

  if (changes.assignedTo !== undefined) {
    updateAssignment(id, changes.assignedTo);
  }

  return getIncident(id);
}
seedIfEmpty();

module.exports = {
  listIncidents,
  getIncidents: listIncidents,
  getIncident,
  createIncident,
  updateIncident,
  updateStatus,
  updateAssignment,
  addNote,
};
