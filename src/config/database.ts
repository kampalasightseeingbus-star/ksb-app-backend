import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Debug - log what Railway is providing
console.log('🔍 DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('🔍 PGHOST exists:', !!process.env.PGHOST);
console.log('🔍 NODE_ENV:', process.env.NODE_ENV);

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432'),
        database: process.env.PGDATABASE || process.env.DB_NAME || 'ksb_db',
        user: process.env.PGUSER || process.env.DB_USER || 'postgres',
        password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
      }
);

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database error:', err.message);
});

// Test connection immediately on startup
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    console.error('❌ Database test query failed:', err.message);
  } else {
    console.log('✅ Database test query successful:', result.rows[0]);
  }
});

export default pool;