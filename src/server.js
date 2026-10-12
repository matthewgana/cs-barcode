import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config/env.js';
import { pool } from './config/db.js';
import { runMigrations } from './db/migrate.js';
import { errorHandler } from './middleware/error-handler.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import academicRoutes from './routes/academic.routes.js';
import coursesRoutes from './routes/courses.routes.js';
import studentsRoutes from './routes/students.routes.js';
import lecturerAssignmentsRoutes from './routes/lecturer-assignments.routes.js';
import enrollmentsRoutes from './routes/enrollments.routes.js';
import sessionsRoutes from './routes/sessions.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import auditRoutes from './routes/audit.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- Security & Parsing Middleware ---
app.set('trust proxy', 1);

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

if (config.nodeEnv !== 'test') {
  app.use(morgan(config.isProd ? 'combined' : 'dev'));
}

// --- Session Store ---
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: false, // We create via migration
    }),
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    name: 'cs_attend_sid',
    cookie: {
      secure: config.session.cookieSecure,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: config.session.cookieMaxAge,
    },
  })
);

// --- Static Frontend ---
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/lecturer-assignments', lecturerAssignmentsRoutes);
app.use('/api/enrollments', enrollmentsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/attendance-sessions', sessionsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/audit', auditRoutes);

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'CS Department Attendance System API is operational.',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// --- SPA Fallback (serve frontend index.html for non-API routes) ---
app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: `API route not found: ${req.method} ${req.originalUrl}` });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- Global Error Handler ---
app.use(errorHandler);

// --- Start Server ---
const startServer = async () => {
  try {
    // Verify DB connection
    await pool.query('SELECT 1');
    console.log('✓ Connected to PostgreSQL database.');

    // Run migrations on startup if not in test mode
    if (config.nodeEnv !== 'test') {
      await runMigrations();
    }

    app.listen(config.port, () => {
      console.log(`\n🎓 CS Department Barcode Attendance System`);
      console.log(`   Environment : ${config.nodeEnv}`);
      console.log(`   Server URL  : http://localhost:${config.port}`);
      console.log(`   API Base    : http://localhost:${config.port}/api`);
      console.log(`   DB          : ${config.db.database}@${config.db.host}:${config.db.port}\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

export default app;
