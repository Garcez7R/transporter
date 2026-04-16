CREATE TABLE IF NOT EXISTS operational_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_request_id INTEGER,
  vehicle_id INTEGER,
  driver_id INTEGER,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_role TEXT,
  actor_name TEXT,
  actor_id INTEGER,
  FOREIGN KEY (trip_request_id) REFERENCES trip_requests(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (driver_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_operational_events_request
  ON operational_events (trip_request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_events_type
  ON operational_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS vehicle_fuel_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_request_id INTEGER,
  vehicle_id INTEGER NOT NULL,
  driver_id INTEGER,
  odometer_km REAL NOT NULL,
  liters REAL NOT NULL,
  fuel_type TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_role TEXT,
  actor_name TEXT,
  actor_id INTEGER,
  FOREIGN KEY (trip_request_id) REFERENCES trip_requests(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (driver_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_fuel_logs_vehicle
  ON vehicle_fuel_logs (vehicle_id, created_at DESC);

CREATE TABLE IF NOT EXISTS gps_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_request_id INTEGER NOT NULL,
  driver_id INTEGER,
  vehicle_id INTEGER,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL,
  speed REAL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_role TEXT,
  actor_name TEXT,
  actor_id INTEGER,
  FOREIGN KEY (trip_request_id) REFERENCES trip_requests(id),
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

CREATE INDEX IF NOT EXISTS idx_gps_logs_request
  ON gps_logs (trip_request_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  theme_mode TEXT NOT NULL DEFAULT 'dark',
  patient_font_large INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
