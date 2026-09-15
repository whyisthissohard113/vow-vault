import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Database client singleton.
 *
 * Uses the `postgres` driver (supports local PostgreSQL, RDS, Neon pooled
 * URLs). Connection pooling is handled by the driver; set DATABASE_URL to a
 * pooled connection string in production.
 *
 * IMPORTANT: this module is server-side only. Never import it into client
 * components or expose `db` to the browser.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required. See .env.example');
}

// `prepare: false` is required for use with the Postgres.js driver in Drizzle
// when using parameterized queries against pgbouncer-style pools.
const client = postgres(connectionString, {
  max: 10,
  prepare: false,
  onnotice: () => undefined, // suppress notice noise in dev
  // postgres.js defaults to 30s; Docker Desktop's port-forward occasionally
  // stalls TCP connects for ~1min under sustained local DB load (spotted by
  // the admin integration suite). A long outer budget rides those stalls out.
  connect_timeout: 120,
});

export const db = drizzle(client, { schema });

export type DB = typeof db;

export { schema };
export * from './schema';