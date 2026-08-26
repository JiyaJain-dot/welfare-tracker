const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.DATABASE_URL || 'file:data.db',
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

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
      type TEXT NOT NULL,
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
    // Replaces the instant-grant external_consents flow above. A row
    // here represents ONE request from ONE connected external system,
    // and its status only changes when the CITIZEN responds via the
    // client portal - never directly by an officer action.
    `CREATE TABLE IF NOT EXISTS consent_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL REFERENCES applications(id),
      source_system TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'denied'
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      responded_at TEXT
    )`,
  ],
  'write'
);

module.exports = { db, ready };
