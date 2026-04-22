CREATE TABLE IF NOT EXISTS vehicle_maintenance_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  maintenance_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  odometer_km REAL,
  notes TEXT,
  scheduled_for TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_role TEXT,
  actor_name TEXT,
  actor_id INTEGER,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_logs_vehicle
  ON vehicle_maintenance_logs (vehicle_id, created_at DESC);
