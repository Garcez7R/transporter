export type Env = {
  DB?: D1Database;
  JWT_SECRET?: string;
  SPLUNK_HEC_URL?: string;
  SPLUNK_HEC_TOKEN?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
};

export type RequestHandler = (request: Request, env: Env) => Promise<Response>;
