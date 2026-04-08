export type Env = {
  DB?: D1Database;
  JWT_SECRET?: string;
};

export type RequestHandler = (request: Request, env: Env) => Promise<Response>;
