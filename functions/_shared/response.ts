export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');

  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers
  });
}
