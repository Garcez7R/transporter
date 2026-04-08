INSERT OR IGNORE INTO users (id, role, name, document, pin_hash, pin_must_change) VALUES
  (1, 'administrador', 'Admin Central', '96820373015', '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0', 1),
  (2, 'operador', 'Equipe Atendimento', '11111111111', '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0', 1),
  (3, 'gerente', 'Logistica Norte', '22222222222', '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0', 1),
  (4, 'motorista', 'Carlos Mendes', '33333333333', '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0', 1),
  (5, 'cliente', 'Ana Lúcia Pereira', '12345678909', '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0', 1),
  (6, 'cliente', 'Cooperativa Norte', '12345678000190', '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0', 1),
  (7, 'cliente', 'João Batista Silva', '98765432142', '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0', 1);

INSERT OR IGNORE INTO clients (id, name, document, phone, address) VALUES
  (1, 'Ana Lúcia Pereira', '12345678909', '+55 11 99999-1000', 'Av. Paulista, 1000'),
  (2, 'Cooperativa Norte', '12345678000190', '+55 11 98888-2000', 'Rua do Porto, 245');

INSERT OR IGNORE INTO vehicles (id, plate, model, status) VALUES
  (1, 'BRG-4A12', 'Sprinter', 'available'),
  (2, 'QWE-9D71', 'Onix Preto', 'maintenance');

INSERT OR IGNORE INTO trip_requests (
  id,
  protocol,
  client_id,
  client_phone,
  destination,
  boarding_point,
  departure_at,
  arrival_eta,
  status,
  driver_id,
  vehicle_id,
  client_pin_status,
  phone_visible,
  notes,
  companions
) VALUES
  (1, 'TRP-2026-00481', 1, '+55 11 99999-1000', 'Aeroporto Internacional', 'Av. Paulista, 1000', '2026-04-08T06:40:00-03:00', '2026-04-08T08:05:00-03:00', 'agendada', 4, 1, 'active', 1, 'Cliente com mala pequena e embarque rápido.', '1 acompanhante'),
  (2, 'TRP-2026-00477', 2, '+55 11 98888-2000', 'Centro de Distribuição', 'Rua do Porto, 245', '2026-04-08T14:10:00-03:00', '2026-04-08T15:15:00-03:00', 'aguardando_distribuicao', NULL, NULL, 'first_access', 0, 'Carga leve e retirada no ponto combinado.', 'Sem acompanhantes');
