import { json } from '../_shared/response';

export const onRequestGet = () =>
  json({
    ok: true,
    service: 'transporter-api',
    mode: 'scaffold'
  });
