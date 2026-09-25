import { Pool } from 'pg';

const globalDatabase = globalThis as typeof globalThis & { maivenPool?: Pool };

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('Database is not configured');
  if (!globalDatabase.maivenPool) {
    globalDatabase.maivenPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 20_000,
      statement_timeout: 15_000,
      options: '-c search_path=maiven,public,extensions',
    });
    globalDatabase.maivenPool.on('error', () => console.error('Database connection interrupted'));
  }
  return globalDatabase.maivenPool;
}
