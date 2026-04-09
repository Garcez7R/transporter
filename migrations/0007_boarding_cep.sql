ALTER TABLE trip_requests ADD COLUMN boarding_cep TEXT;

UPDATE trip_requests
SET boarding_cep = (
  SELECT cep FROM clients WHERE clients.id = trip_requests.client_id
)
WHERE boarding_cep IS NULL;
