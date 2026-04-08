CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_request_id INTEGER,
  entity_type TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  actor_role TEXT,
  actor_name TEXT,
  actor_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_request_id) REFERENCES trip_requests(id)
);
