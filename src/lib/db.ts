import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const SCHEMA = `
create table if not exists weddings (
  id text primary key,
  data text not null,
  created_at text not null default (datetime('now'))
);
create table if not exists jobs (
  id text primary key,
  wedding_id text not null references weddings(id) on delete cascade,
  request text not null,
  brief text not null,
  status text not null,
  recommendation text,
  booked_vendor_id text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create table if not exists vendors (
  id text primary key,
  job_id text not null references jobs(id) on delete cascade,
  data text not null,
  status text not null
);
create table if not exists calls (
  id text primary key,
  job_id text not null references jobs(id) on delete cascade,
  vendor_id text not null references vendors(id) on delete cascade,
  purpose text not null,
  dialed_number text not null,
  execution_id text,
  status text not null,
  transcript text not null default '[]',
  created_at text not null,
  updated_at text not null
);
create table if not exists quotes (
  vendor_id text primary key references vendors(id) on delete cascade,
  data text not null
);
create table if not exists bookings (
  job_id text primary key references jobs(id) on delete cascade,
  data text not null
);
create table if not exists activity (
  id integer primary key autoincrement,
  job_id text,
  text text not null,
  at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`

// One connection per server process; Next dev reloads modules, so it lives on globalThis.
const globalForDb = globalThis as unknown as { milanDb?: DatabaseSync }

function open(): DatabaseSync {
  const path = resolve(process.env.DATABASE_PATH || 'data/milan.db')
  mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('pragma journal_mode = wal; pragma foreign_keys = on;')
  db.exec(SCHEMA)
  return db
}

export function db(): DatabaseSync {
  if (!globalForDb.milanDb) globalForDb.milanDb = open()
  return globalForDb.milanDb
}
