-- client-page D1 schema. Every statement is idempotent; `client-page.sh setup` applies them one by one.

-- One row per published page. Pages are never hard-deleted: archiving hides them from visitors.
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,                          -- uuid v4, the last segment of the public URL
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',          -- short summary for the owner's dashboard and link previews
  html TEXT NOT NULL,                           -- the page as authored (a fragment or a full document)
  mode TEXT NOT NULL DEFAULT 'open',            -- 'open' accepts answers, 'locked' is read-only
  version INTEGER NOT NULL DEFAULT 1,           -- bumped on every republish
  rev INTEGER NOT NULL DEFAULT 0,               -- bumped on every change a visitor could see; drives the ETag
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER
);

-- Saved answers: small JSON documents, addressed as <collection>/<id> within one page.
CREATE TABLE IF NOT EXISTS records (
  page_id TEXT NOT NULL,
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (page_id, collection, id)
);

-- Write rate limiting: one row per hashed client per minute, pruned as it goes.
CREATE TABLE IF NOT EXISTS hits (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  exp INTEGER NOT NULL
);

-- Added after the first release. Databases created before it get the column here; on newer ones this
-- fails with "duplicate column name", which `client-page.sh schema` (and the test fake) ignore.
ALTER TABLE pages ADD COLUMN description TEXT NOT NULL DEFAULT '';
