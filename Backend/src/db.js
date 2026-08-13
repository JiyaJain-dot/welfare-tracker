// This file sets up the database. We use SQLite, which stores the whole
// database as a single file (data.db) right in this project folder -
// no separate database server to install or run.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, '..', 'data.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
// Runs once on startup. CREATE TABLE IF NOT EXISTS means it's safe to
// run this every time the server starts - it won't wipe existing data.
db.exec(`
  CREATE TABLE IF NOT EXISTS offices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schemes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    priority INTEGER NOT NULL -- 1 = highest priority (e.g. old age pension)
  );

  CREATE TABLE IF NOT EXISTS officers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    office_id INTEGER REFERENCES offices(id)
  );

  CREATE TABLE IF NOT EXISTS applicants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_id TEXT NOT NULL UNIQUE,
    applicant_id INTEGER NOT NULL REFERENCES applicants(id),
    scheme_id INTEGER NOT NULL REFERENCES schemes(id),
    office_id INTEGER NOT NULL REFERENCES offices(id),
    current_stage TEXT NOT NULL DEFAULT 'submitted',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Append-only: every status change becomes a NEW row here, never an
  -- overwrite. This is what powers both the citizen's timeline view and
  -- the officer's "how long has this been pending" calculation.
  CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id),
    stage TEXT NOT NULL,
    note TEXT,
    changed_by TEXT,
    changed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id),
    doc_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | received | missing
    note TEXT
  );
`);

module.exports = db;
