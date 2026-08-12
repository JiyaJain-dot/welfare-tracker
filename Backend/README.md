# Welfare Tracker — Backend

Backend API for the pension/welfare scheme application tracking system.
Built with Node.js, Express, and SQLite (no separate database software needed).

## What this backend does

- Officers create applications and get a unique tracking ID (like a courier tracking number)
- Citizens check status at `GET /api/v1/applications/track/:trackingId` — no login needed
- Officers log in, update application status, flag missing documents
- SMS alerts fire automatically on submission, status change, and missing documents
  (logged to your terminal in development — see `src/utils/sms.js`)
- Officer dashboard stats: total pending count, count per scheme, priority-sorted queue

## 1. Install these on your laptop (one-time setup)

1. **Node.js (LTS version)** — https://nodejs.org — this installs both `node` and `npm`.
   Check it worked by opening a terminal and running:
   ```
   node -v
   npm -v
   ```
2. **Git** — https://git-scm.com/downloads
3. **VS Code** — https://code.visualstudio.com
4. In VS Code, install these extensions (Extensions icon on the left sidebar, search by name):
   - **ESLint** (optional but helpful — flags JS mistakes as you type)
   - **SQLite Viewer** or **SQLite** by alexcvzz — lets you open `data.db` and see your tables visually
   - **Thunder Client** — lets you test your API endpoints directly inside VS Code (like a mini Postman)

## 2. Get the code running

```bash
# clone your team's shared repo (or this folder if you're starting fresh)
git clone <your-repo-url>
cd welfare-tracker-backend

# install all dependencies listed in package.json
npm install

# create your local environment file
cp .env.example .env
# open .env in VS Code and change JWT_SECRET to any random string

# create the database tables and add test data
npm run seed

# start the server (auto-restarts when you save a file)
npm run dev
```

You should see:
```
Welfare tracker API running at http://localhost:4000
```

Open `http://localhost:4000` in a browser — you should see `{"status":"ok",...}`.

## 3. Test it works (using Thunder Client or curl)

**Log in as the test officer:**
```
POST http://localhost:4000/api/v1/auth/login
Body (JSON): { "username": "officer1", "password": "officer123" }
```
Copy the `token` from the response — you'll need it for every officer request below,
sent as a header: `Authorization: Bearer <token>`

**Create an application (as the officer):**
```
POST http://localhost:4000/api/v1/officer/applications
Header: Authorization: Bearer <token>
Body: { "name": "Ramesh Kumar", "phone": "9876543210", "address": "Village X", "schemeId": 1 }
```
This returns a `trackingId` like `WLF-7K3P9QXR`. Check your terminal — you'll see the
"SMS" printed there.

**Check status as a citizen (no login needed):**
```
GET http://localhost:4000/api/v1/applications/track/WLF-7K3P9QXR
```

**See the officer dashboard stats:**
```
GET http://localhost:4000/api/v1/officer/stats
Header: Authorization: Bearer <token>
```

## API reference

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/login` | none | Officer login, returns JWT |
| GET | `/api/v1/applications/track/:trackingId` | none | Citizen status + timeline lookup |
| POST | `/api/v1/officer/applications` | officer | Submit new application, get tracking ID |
| GET | `/api/v1/officer/applications?stage=` | officer | List applications, priority-sorted |
| GET | `/api/v1/officer/stats` | officer | Total + per-scheme counts |
| PATCH | `/api/v1/officer/applications/:id/status` | officer | Update stage, triggers SMS |
| POST | `/api/v1/officer/applications/:id/documents` | officer | Flag missing/received doc, triggers SMS |

All responses are shaped as `{ "data": {...} }` on success or `{ "error": { "code", "message" } }` on failure.

## Give this to your frontend/dashboard teammates

They don't need this codebase at all — just the table above and:
- Base URL during development: `http://localhost:4000/api/v1`
- CORS is already enabled for `localhost:3000` and `localhost:5173` (edit `src/server.js` if your teammates use a different port)
- They send the officer's JWT as `Authorization: Bearer <token>` on every officer-only request

## Next steps once this works

- Deploy this to Render or Railway (free tier) so your teammates hit a real URL instead of your laptop
- Swap the console SMS stub in `src/utils/sms.js` for a real provider (MSG91, Kaleyra) once you have an account
- Add rate-limiting to the public tracking endpoint before going live, so it can't be scraped
