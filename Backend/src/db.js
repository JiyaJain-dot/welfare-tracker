// This file sets up the database connection using Turso (a free, cloud-
// hosted SQLite-compatible database) via the libSQL client.
//
// The same client also works against a plain local file - if
// DATABASE_URL isn't set, it falls back to "file:data.db" automatically.
// That means you can keep developing locally exactly like before,
// without needing a Turso account just to run things on your laptop.
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.DATABASE_URL || 'file:data.db',
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

// Runs once, creates tables if they don't exist yet. Every route awaits
// this promise before touching the database - that makes it safe even
// on a "cold start" (the first request after a serverless function has
// been asleep), since we can't rely on a server that's been running
// continuously to have already set things up.
const ready = db.batch(
  [
    `CREATE TABLE IF NOT EXISTS offices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS schemes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      priority INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS officers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      office_id INTEGER REFERENCES offices(id)
    )`,
    `CREATE TABLE IF NOT EXISTS applicants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_id TEXT NOT NULL UNIQUE,
      applicant_id INTEGER NOT NULL REFERENCES applicants(id),
      scheme_id INTEGER NOT NULL REFERENCES schemes(id),
      office_id INTEGER NOT NULL REFERENCES offices(id),
      current_stage TEXT NOT NULL DEFAULT 'submitted',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL REFERENCES applications(id),
      stage TEXT NOT NULL,
      note TEXT,
      changed_by TEXT,
      changed_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL REFERENCES applications(id),
      doc_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL REFERENCES applications(id),
      type TEXT NOT NULL, -- 'status_update' | 'document_missing' | 'info'
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS external_consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL UNIQUE REFERENCES applications(id),
      consent_granted INTEGER NOT NULL DEFAULT 0,
      granted_by TEXT,
      granted_at TEXT
    )`,
  ],
  'write'
);

module.exports = { db, ready };
