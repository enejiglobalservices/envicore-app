# ENVI-CORE — Working Prototype (with real backend)

This is a functioning full-stack prototype of the ENVI-CORE MVP. It implements the five
core functions from your project plan — **Report → Verify → Map → Assign → Track** — with
a real backend and a real database. Data now actually persists.

## How to run it

You need **Node.js 22 or newer** installed (check with `node --version`). Nothing else —
no npm install, no external database to set up. The backend uses Node's built-in SQLite
support, so there are zero dependencies to install.

```bash
cd server
node server.js
```

Then open **http://localhost:3000** in your browser. That's it.

A file called `envicore.db` will appear in the `server/` folder the first time you run
it — that's your real, persistent SQLite database. Stop the server, restart it, reload
the page — your data is still there.

You'll need an internet connection for the **Map** view specifically (it loads the
Leaflet library + OpenStreetMap tiles from a CDN). Every other view works fully offline
once the server is running.

## What's actually working right now

- **Real backend** — a Node.js HTTP server (`server/server.js`) with a REST API, no
  Express or other framework needed
- **Real database** — SQLite (`server/db.js`), two tables (`incidents`, `notes`), with
  data that survives restarts
- **Dashboard** — live stats and a recent-incidents feed, pulled from the database
- **Report Incident** — submission form that creates a real row in the database and
  gets a real generated case ID
- **Map** — every incident plotted by GPS, color-coded by status, click-through to case detail
- **Cases** — full case list and detail view where you can:
  - move a case through the workflow (Unverified → Under Review → Corroborated →
    Verified → Assigned → Action Taken → Resolved)
  - assign it to a responding officer/team (auto-updates status when appropriate)
  - add timestamped follow-up notes
- **Analytics** — incidents by type and by hotspot location, computed from real data

Try it: submit a new report, find it in Cases, move it through the workflow, assign it,
add a note — then **stop the server, restart it, and reload the page**. Everything is
still there. That's the difference from the previous version.

## REST API reference

| Method | Endpoint                          | Description                          |
|--------|------------------------------------|---------------------------------------|
| GET    | `/api/incidents`                  | List all incidents (with notes)       |
| POST   | `/api/incidents`                  | Create a new incident                 |
| GET    | `/api/incidents/:id`               | Get one incident                      |
| PATCH  | `/api/incidents/:id`               | Update `status` and/or `assignedTo`   |
| POST   | `/api/incidents/:id/notes`         | Add a follow-up note                  |

This API is the contract a real mobile app, or a developer's rebuild, would talk to.

## What's still ahead

1. **Authentication** — the "Viewing as" switch in the sidebar is still a demo stand-in.
   Real login and role-based permissions (community reporter vs. reviewing officer vs.
   admin) plug in at the API layer — every endpoint above is where you'd add an auth check.
2. **Photo/video upload** — the report form has a placeholder for this. Real file
   storage (Cloudinary, S3-compatible storage) would handle the actual media; the
   database already has room for a `photo_url` column when you're ready to add it.
3. **Deploy it** — this exact server runs as-is on Render or Railway (both support
   Node.js natively). SQLite works for a pilot; if you outgrow a single file database,
   swapping `server/db.js` for PostgreSQL is a contained change — the rest of the app
   doesn't need to know the difference.
4. **Duplicate-report detection** — mentioned in your project plan as a "later phase"
   feature; the data model here (location + type + time) is already structured to support it.

## File structure

```
envicore-app/
├── public/              — frontend (served by the Node server)
│   ├── index.html        — page shell, sidebar nav, view containers
│   ├── style.css         — ENVI-CORE brand styling
│   ├── data.js           — shared frontend constants
│   └── app.js            — rendering + calls to the API
├── server/
│   ├── server.js         — HTTP server + REST API (no Express, built-in http module)
│   ├── db.js             — SQLite schema, queries, seed data
│   └── envicore.db       — created automatically on first run (not included)
└── README.md             — this file
```

No build step, no framework, no npm install. A developer you bring on can read
`server/db.js` and `server/server.js` in one sitting and know exactly how the whole
backend works.
