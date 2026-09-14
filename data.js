// ENVI-CORE — shared frontend constants.
// Incident data itself now lives in the server's SQLite database (server/db.js)
// and is fetched over the API — see app.js.

const INCIDENT_TYPES = [
  "Oil Spill",
  "Gas Flaring",
  "Water Pollution",
  "Air Pollution",
  "Illegal Dumping",
  "Chemical Spill",
  "Ecosystem Impact",
  "Flooding",
];

const WORKFLOW_STEPS = [
  "Reported",
  "Unverified",
  "Under Review",
  "Corroborated",
  "Verified",
  "Assigned",
  "Action Taken",
  "Resolved",
];

const OFFICERS = [
  "Unassigned",
  "State Env. Protection Unit",
  "Local Govt. Env. Officer",
  "Field Response Team A",
  "Field Response Team B",
];
