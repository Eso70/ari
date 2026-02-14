import { Pool } from "pg";

function getDbConfig() {
  return {
    host: process.env.PGHOST || "localhost",
    port: parseInt(process.env.PGPORT || "5432", 10),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    database: process.env.PGDATABASE || "postgres",
  };
}

const globalForDb = globalThis as unknown as { pool: Pool };
export const pool =
  globalForDb.pool ||
  new Pool({
    ...getDbConfig(),
    max: 5,
    idleTimeoutMillis: 45000,
    connectionTimeoutMillis: 8000,
  });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const client = await pool.connect();
  try {
    const r = await client.query(text, params);
    return { rows: (r.rows as T[]) || [], rowCount: r.rowCount ?? 0 };
  } finally {
    client.release();
  }
}
