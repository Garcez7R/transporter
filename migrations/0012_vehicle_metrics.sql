CREATE TABLE IF NOT EXISTS vehicle_metrics (
  vehicle_id INTEGER PRIMARY KEY,
  odometer_km REAL NOT NULL DEFAULT 0,
  autonomy_km REAL NOT NULL DEFAULT 0,
  fuel_type TEXT,
  oil_last_km REAL NOT NULL DEFAULT 0,
  oil_next_km REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

ALTER TABLE trip_requests ADD COLUMN distance_km REAL NOT NULL DEFAULT 0;
