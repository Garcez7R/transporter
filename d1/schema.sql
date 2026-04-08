CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  document TEXT UNIQUE,
  pin_hash TEXT,
  pin_must_change INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  last_pin_change_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  document TEXT UNIQUE NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plate TEXT UNIQUE NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS trip_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol TEXT UNIQUE NOT NULL,
  client_id INTEGER NOT NULL,
  client_phone TEXT,
  destination TEXT NOT NULL,
  boarding_point TEXT NOT NULL,
  departure_at TEXT NOT NULL,
  arrival_eta TEXT,
  status TEXT NOT NULL DEFAULT 'em_atendimento',
  driver_id INTEGER,
  vehicle_id INTEGER,
  client_pin_status TEXT NOT NULL DEFAULT 'first_access',
  client_confirmed_at TEXT,
  phone_visible INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  companions TEXT,
  updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_request_id INTEGER NOT NULL,
  author_role TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_request_id) REFERENCES trip_requests(id)
);

CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_request_id INTEGER NOT NULL,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  changed_by_role TEXT NOT NULL,
  changed_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_request_id) REFERENCES trip_requests(id)
);

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

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
