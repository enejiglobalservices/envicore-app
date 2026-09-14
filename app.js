// ENVI-CORE prototype — application logic.
// Talks to the real backend over /api/* (see server/server.js + server/db.js).
// Data now persists — it's a real SQLite database, not in-memory state.

let currentView = "dashboard";
let mapInstance = null;
let selectedType = null;
let incidentsCache = [];

const STATUS_CLASS = {
  "Unverified": "pill-unverified",
  "Under Review": "pill-review",
  "Corroborated": "pill-corroborated",
  "Verified": "pill-verified",
  "Assigned": "pill-assigned",
  "Action Taken": "pill-action",
  "Resolved": "pill-resolved",
};

const STATUS_MAP_COLOR = {
  "Unverified": "#a99a2e",
  "Under Review": "#c77f1a",
  "Corroborated": "#1c5f8a",
  "Verified": "#1f8a5f",
  "Assigned": "#5a3f9e",
  "Action Taken": "#666666",
  "Resolved": "#1f8a5f",
};

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---------- API layer ----------

async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed: " + url);
  return res.json();
}

async function apiSend(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Request failed: " + url);
  }
  return res.json();
}

async function refreshIncidents() {
  incidentsCache = await apiGet("/api/incidents");
  return incidentsCache;
}

// ---------- Navigation ----------

async function setView(view) {
  currentView = view;
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach(v => v.hidden = true);
  document.getElementById("view-" + view).hidden = false;

  const titles = {
    dashboard: "Dashboard",
    report: "Report an Incident",
    map: "Incident Map",
    cases: "Cases",
    analytics: "Analytics",
  };
  document.getElementById("pageTitle").textContent = titles[view];

  if (view === "dashboard") await renderDashboard();
  if (view === "report") renderReportForm();
  if (view === "map") await renderMap();
  if (view === "cases") await renderCases();
  if (view === "analytics") await renderAnalytics();
}

// ---------- Dashboard ----------

async function renderDashboard() {
  const el = document.getElementById("view-dashboard");
  el.innerHTML = `<div class="empty-state">Loading…</div>`;

  let incidents;
  try {
    incidents = await refreshIncidents();
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Could not reach the server. Is server/server.js running?</div>`;
    return;
  }

  const total = incidents.length;
  const verified = incidents.filter(i => ["Verified", "Assigned", "Action Taken", "Resolved"].includes(i.status)).length;
  const underReview = incidents.filter(i => ["Unverified", "Under Review", "Corroborated"].includes(i.status)).length;
  const resolved = incidents.filter(i => i.status === "Resolved").length;
  const recent = [...incidents].sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt)).slice(0, 5);

  el.innerHTML = `
    <div class="stat-row">
      <div class="stat-card"><div class="label">Total Reports</div><div class="value">${total}</div></div>
      <div class="stat-card"><div class="label">Verified Incidents</div><div class="value">${verified}</div></div>
      <div class="stat-card"><div class="label">Under Review</div><div class="value">${underReview}</div></div>
      <div class="stat-card"><div class="label">Resolved</div><div class="value">${resolved}</div></div>
    </div>
    <div class="panel">
      <h2>Recent Incidents</h2>
      <div class="incident-row head">
        <div>Case ID</div><div>Description</div><div>Type</div><div>Status</div><div>Reported</div>
      </div>
      ${recent.length ? recent.map(i => `
        <div class="incident-row" style="cursor:pointer" onclick="openCase('${i.id}')">
          <div class="case-id">${i.id}</div>
          <div>${i.description.slice(0, 46)}${i.description.length > 46 ? "…" : ""}</div>
          <div class="type-tag">${i.type}</div>
          <div><span class="pill ${STATUS_CLASS[i.status]}">${i.status}</span></div>
          <div class="type-tag">${fmtDate(i.reportedAt)}</div>
        </div>
      `).join("") : `<div class="empty-state">No incidents reported yet.</div>`}
    </div>
  `;
}

// ---------- Report form ----------

function renderReportForm() {
  const el = document.getElementById("view-report");
  selectedType = null;
  el.innerHTML = `
    <div class="panel">
      <h2>Submit an Environmental Incident</h2>
      <form id="reportForm">
        <div class="form-grid">
          <div class="incident-type-grid" id="typeGrid">
            ${INCIDENT_TYPES.map(t => `<div class="type-choice" data-type="${t}">${t}</div>`).join("")}
          </div>

          <div class="field full">
            <label>Description</label>
            <textarea id="descField" placeholder="Describe what you observed — what happened, when, and anything relevant to follow-up." required></textarea>
          </div>

          <div class="field">
            <label>Location (place name)</label>
            <input id="locField" type="text" placeholder="e.g. Warri, Delta State" required />
          </div>
          <div class="field">
            <label>GPS Coordinates</label>
            <input id="gpsField" type="text" placeholder="5.5160, 5.7500" />
          </div>

          <div class="field full">
            <label>Reporting as</label>
            <select id="anonField">
              <option value="public">Public (visible to reviewers)</option>
              <option value="anonymous">Anonymous</option>
            </select>
          </div>

          <div class="field full">
            <button type="submit" class="btn-primary">Submit Report</button>
          </div>
        </div>
      </form>
    </div>
  `;

  document.querySelectorAll(".type-choice").forEach(c => {
    c.addEventListener("click", () => {
      document.querySelectorAll(".type-choice").forEach(x => x.classList.remove("selected"));
      c.classList.add("selected");
      selectedType = c.dataset.type;
    });
  });

  document.getElementById("reportForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedType) { showToast("Please select an incident type."); return; }
    const desc = document.getElementById("descField").value.trim();
    const loc = document.getElementById("locField").value.trim();
    const gps = document.getElementById("gpsField").value.trim();
    if (!desc || !loc) { showToast("Description and location are required."); return; }

    let lat = 5.55, lng = 5.75; // fallback near Delta State
    if (gps.includes(",")) {
      const parts = gps.split(",").map(p => parseFloat(p.trim()));
      if (!isNaN(parts[0]) && !isNaN(parts[1])) { lat = parts[0]; lng = parts[1]; }
    }

    const submitBtn = e.target.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    try {
      const incident = await apiSend("/api/incidents", "POST", {
        type: selectedType,
        description: desc,
        location: loc,
        lat, lng,
        reporterMode: document.getElementById("anonField").value,
      });
      showToast(`Report submitted — case ${incident.id} created.`);
      await setView("cases");
    } catch (err) {
      showToast("Could not submit report: " + err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Report";
    }
  });
}

// ---------- Map ----------

async function renderMap() {
  const el = document.getElementById("view-map");

  if (typeof L === "undefined") {
    el.innerHTML = `
      <div class="panel">
        <div class="empty-state">
          Map library didn't load — this view needs an internet connection<br/>
          (it loads Leaflet + OpenStreetMap tiles from a CDN).
        </div>
      </div>
    `;
    return;
  }

  let incidents;
  try {
    incidents = await refreshIncidents();
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Could not reach the server.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="map-legend">
      ${Object.entries(STATUS_MAP_COLOR).map(([status, color]) => `
        <span><span class="legend-dot" style="background:${color}"></span>${status}</span>
      `).join("")}
    </div>
    <div id="leafletMap"></div>
  `;

  setTimeout(() => {
    if (mapInstance) { mapInstance.remove(); mapInstance = null; }
    mapInstance = L.map("leafletMap").setView([5.55, 5.75], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(mapInstance);

    incidents.forEach(i => {
      const marker = L.circleMarker([i.lat, i.lng], {
        radius: 8,
        color: STATUS_MAP_COLOR[i.status] || "#666",
        fillColor: STATUS_MAP_COLOR[i.status] || "#666",
        fillOpacity: 0.85,
        weight: 2,
      }).addTo(mapInstance);
      marker.bindPopup(`
        <strong>${i.type}</strong><br/>
        ${i.location}<br/>
        <span style="color:${STATUS_MAP_COLOR[i.status]}">${i.status}</span><br/>
        <a href="#" onclick="openCase('${i.id}'); return false;">View case ${i.id}</a>
      `);
    });
  }, 0);
}

// ---------- Cases (Verify / Assign / Track) ----------

async function renderCases() {
  const el = document.getElementById("view-cases");
  el.innerHTML = `<div class="empty-state">Loading…</div>`;

  let incidents;
  try {
    incidents = await refreshIncidents();
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Could not reach the server.</div>`;
    return;
  }

  const sorted = [...incidents].sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));

  el.innerHTML = `
    <div class="panel">
      <h2>All Cases</h2>
      <div class="incident-row head">
        <div>Case ID</div><div>Description</div><div>Type</div><div>Status</div><div>Assigned</div>
      </div>
      ${sorted.length ? sorted.map(i => `
        <div class="incident-row" style="cursor:pointer" onclick="openCase('${i.id}')">
          <div class="case-id">${i.id}</div>
          <div>${i.description.slice(0, 40)}${i.description.length > 40 ? "…" : ""}</div>
          <div class="type-tag">${i.type}</div>
          <div><span class="pill ${STATUS_CLASS[i.status]}">${i.status}</span></div>
          <div class="type-tag">${i.assignedTo}</div>
        </div>
      `).join("") : `<div class="empty-state">No cases yet — submit a report to create one.</div>`}
    </div>
  `;
}

async function openCase(id) {
  let incident;
  try {
    incident = await apiGet("/api/incidents/" + id);
  } catch (e) {
    showToast("Could not load case.");
    return;
  }

  closeCase();
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.id = "caseOverlay";
  overlay.innerHTML = `
    <div class="drawer">
      <button class="drawer-close" onclick="closeCase()">✕</button>
      <div class="case-id">${incident.id}</div>
      <h2>${incident.type}</h2>

      <div class="kv"><span>Location</span><span>${incident.location}</span></div>
      <div class="kv"><span>GPS</span><span class="case-id">${incident.lat.toFixed(4)}, ${incident.lng.toFixed(4)}</span></div>
      <div class="kv"><span>Reported</span><span>${fmtDate(incident.reportedAt)}</span></div>
      <div class="kv"><span>Reporting mode</span><span>${incident.reporterMode === "anonymous" ? "Anonymous" : "Public"}</span></div>

      <p style="font-size:13.5px; line-height:1.5; margin-top:14px;">${incident.description}</p>

      <label style="margin-top:16px;">Workflow status</label>
      <div class="workflow-steps" id="workflowSteps">
        ${WORKFLOW_STEPS.filter(s => s !== "Reported").map(s => `
          <button class="step-btn ${incident.status === s ? "current" : ""}" data-step="${s}">${s}</button>
        `).join("")}
      </div>

      <label>Assign to</label>
      <div class="assign-row">
        <select id="assignSelect">
          ${OFFICERS.map(o => `<option value="${o}" ${incident.assignedTo === o ? "selected" : ""}>${o}</option>`).join("")}
        </select>
      </div>

      <div class="notes-log">
        <label>Follow-up notes</label>
        <div id="notesList">
          ${incident.notes.length ? incident.notes.map(n => `
            <div class="note-item"><strong>${fmtDate(n.at)}</strong> — ${n.text}</div>
          `).join("") : `<div class="note-item">No follow-up notes yet.</div>`}
        </div>
        <div style="margin-top:10px; display:flex; gap:8px;">
          <input id="noteInput" type="text" placeholder="Add a follow-up note…" style="flex:1" />
          <button class="btn-secondary" onclick="addNote('${incident.id}')">Add</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.querySelectorAll("#workflowSteps .step-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        await apiSend("/api/incidents/" + id, "PATCH", { status: btn.dataset.step });
        showToast(`${id} moved to "${btn.dataset.step}".`);
        await openCase(id);
        if (currentView === "cases") await renderCases();
        if (currentView === "dashboard") await renderDashboard();
      } catch (err) {
        showToast("Could not update status: " + err.message);
      }
    });
  });

  document.getElementById("assignSelect").addEventListener("change", async (e) => {
    try {
      await apiSend("/api/incidents/" + id, "PATCH", { assignedTo: e.target.value });
      showToast(`${id} assigned to ${e.target.value}.`);
      if (currentView === "cases") await renderCases();
    } catch (err) {
      showToast("Could not update assignment: " + err.message);
    }
  });
}

async function addNote(id) {
  const input = document.getElementById("noteInput");
  const text = input.value.trim();
  if (!text) return;
  try {
    await apiSend("/api/incidents/" + id + "/notes", "POST", { text });
    await openCase(id);
  } catch (err) {
    showToast("Could not add note: " + err.message);
  }
}

function closeCase() {
  const overlay = document.getElementById("caseOverlay");
  if (overlay) overlay.remove();
}

// ---------- Analytics ----------

async function renderAnalytics() {
  const el = document.getElementById("view-analytics");
  el.innerHTML = `<div class="empty-state">Loading…</div>`;

  let incidents;
  try {
    incidents = await refreshIncidents();
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Could not reach the server.</div>`;
    return;
  }

  const byType = {};
  INCIDENT_TYPES.forEach(t => byType[t] = 0);
  incidents.forEach(i => { byType[i.type] = (byType[i.type] || 0) + 1; });
  const maxCount = Math.max(1, ...Object.values(byType));

  const byLocation = incidents.reduce((acc, i) => { acc[i.location] = (acc[i.location] || 0) + 1; return acc; }, {});

  el.innerHTML = `
    <div class="panel">
      <h2>Incidents by Type</h2>
      <div class="bar-chart">
        ${Object.entries(byType).map(([type, count]) => `
          <div class="bar-col">
            <div class="bar-value">${count}</div>
            <div class="bar" style="height:${Math.max(6, (count / maxCount) * 130)}px"></div>
            <div class="bar-label">${type}</div>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="panel">
      <h2>Top Locations</h2>
      ${Object.keys(byLocation).length ? Object.entries(byLocation).sort((a, b) => b[1] - a[1]).map(([loc, count]) => `
        <div class="kv"><span>${loc}</span><span>${count} incident${count === 1 ? "" : "s"}</span></div>
      `).join("") : `<div class="empty-state">No data yet.</div>`}
    </div>
  `;
}

// ---------- Init ----------

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});
document.getElementById("reportBtn").addEventListener("click", () => setView("report"));

setView("dashboard");
