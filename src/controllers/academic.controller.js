import { query } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { logAudit } from '../utils/audit.js';

// --- SESSIONS ---

export async function getAcademicSessions(req, res, next) {
  const result = await query(
    `SELECT id, session_label, start_date, end_date, status, created_at, updated_at
     FROM academic_sessions
     ORDER BY start_date DESC`
  );
  res.json({ success: true, data: result.rows });
}

export async function createAcademicSession(req, res, next) {
  const { session_label, start_date, end_date, status = 'active' } = req.body;

  if (!session_label || !start_date || !end_date) {
    return next(new AppError('session_label, start_date, and end_date are required.', 400));
  }

  if (new Date(end_date) < new Date(start_date)) {
    return next(new AppError('end_date must be on or after start_date.', 400));
  }

  const result = await query(
    `INSERT INTO academic_sessions (session_label, start_date, end_date, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [session_label.trim(), start_date, end_date, status]
  );

  await logAudit(req, {
    action: 'CREATE_ACADEMIC_SESSION',
    entityType: 'ACADEMIC_SESSION',
    entityId: result.rows[0].id,
    metadata: { session_label },
  });

  res.status(201).json({
    success: true,
    message: 'Academic session created successfully',
    data: result.rows[0],
  });
}

export async function updateAcademicSession(req, res, next) {
  const { id } = req.params;
  const { session_label, start_date, end_date, status } = req.body;

  const existingRes = await query(`SELECT * FROM academic_sessions WHERE id = $1`, [id]);
  if (existingRes.rowCount === 0) {
    return next(new AppError('Academic session not found.', 404));
  }

  const result = await query(
    `UPDATE academic_sessions
     SET session_label = COALESCE($1, session_label),
         start_date = COALESCE($2, start_date),
         end_date = COALESCE($3, end_date),
         status = COALESCE($4, status),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5
     RETURNING *`,
    [session_label ? session_label.trim() : null, start_date || null, end_date || null, status || null, id]
  );

  await logAudit(req, {
    action: 'UPDATE_ACADEMIC_SESSION',
    entityType: 'ACADEMIC_SESSION',
    entityId: id,
    metadata: { session_label, status },
  });

  res.json({
    success: true,
    message: 'Academic session updated successfully',
    data: result.rows[0],
  });
}

// --- SEMESTERS ---

export async function getSemesters(req, res, next) {
  const { academic_session_id } = req.query;
  const conditions = [];
  const params = [];

  if (academic_session_id) {
    params.push(academic_session_id);
    conditions.push(`s.academic_session_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT s.id, s.academic_session_id, s.semester_name, s.start_date, s.end_date, s.status,
            s.created_at, s.updated_at, a.session_label
     FROM semesters s
     JOIN academic_sessions a ON s.academic_session_id = a.id
     ${whereClause}
     ORDER BY s.start_date DESC`,
    params
  );

  res.json({ success: true, data: result.rows });
}

export async function createSemester(req, res, next) {
  const { academic_session_id, semester_name, start_date, end_date, status = 'active' } = req.body;

  if (!academic_session_id || !semester_name || !start_date || !end_date) {
    return next(new AppError('academic_session_id, semester_name, start_date, and end_date are required.', 400));
  }

  if (new Date(end_date) < new Date(start_date)) {
    return next(new AppError('end_date must be on or after start_date.', 400));
  }

  // Verify session exists
  const sessionRes = await query(`SELECT id FROM academic_sessions WHERE id = $1`, [academic_session_id]);
  if (sessionRes.rowCount === 0) {
    return next(new AppError('Referenced academic session does not exist.', 404));
  }

  const result = await query(
    `INSERT INTO semesters (academic_session_id, semester_name, start_date, end_date, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [academic_session_id, semester_name.trim(), start_date, end_date, status]
  );

  await logAudit(req, {
    action: 'CREATE_SEMESTER',
    entityType: 'SEMESTER',
    entityId: result.rows[0].id,
    metadata: { semester_name, academic_session_id },
  });

  res.status(201).json({
    success: true,
    message: 'Semester created successfully',
    data: result.rows[0],
  });
}

export async function updateSemester(req, res, next) {
  const { id } = req.params;
  const { semester_name, start_date, end_date, status } = req.body;

  const existingRes = await query(`SELECT * FROM semesters WHERE id = $1`, [id]);
  if (existingRes.rowCount === 0) {
    return next(new AppError('Semester not found.', 404));
  }

  const result = await query(
    `UPDATE semesters
     SET semester_name = COALESCE($1, semester_name),
         start_date = COALESCE($2, start_date),
         end_date = COALESCE($3, end_date),
         status = COALESCE($4, status),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5
     RETURNING *`,
    [semester_name ? semester_name.trim() : null, start_date || null, end_date || null, status || null, id]
  );

  await logAudit(req, {
    action: 'UPDATE_SEMESTER',
    entityType: 'SEMESTER',
    entityId: id,
    metadata: { semester_name, status },
  });

  res.json({
    success: true,
    message: 'Semester updated successfully',
    data: result.rows[0],
  });
}
