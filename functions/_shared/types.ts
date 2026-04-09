export type Env = {
  DB?: D1Database;
  JWT_SECRET?: string;
  SPLUNK_HEC_URL?: string;
  SPLUNK_HEC_TOKEN?: string;
};

export type RequestHandler = (request: Request, env: Env) => Promise<Response>;
