import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  db: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/cs_attendance_db',
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT, 10) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'cs_attendance_db',
  },
  session: {
    secret: process.env.SESSION_SECRET || 'dev_secret_key_attendance_system_change_me_in_prod',
    cookieMaxAge: 1000 * 60 * 60 * 24, // 24 hours
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
};
