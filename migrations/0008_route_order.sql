ALTER TABLE trip_requests ADD COLUMN route_date TEXT;
ALTER TABLE trip_requests ADD COLUMN route_order INTEGER;

CREATE INDEX IF NOT EXISTS idx_trip_requests_route
  ON trip_requests (driver_id, route_date, route_order);
