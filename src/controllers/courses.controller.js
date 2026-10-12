import { query } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { logAudit } from '../utils/audit.js';

export async function getCourses(req, res, next) {
  const { academic_level, semester_type, status, search } = req.query;
  const conditions = [];
  const params = [];

  if (academic_level) {
    params.push(academic_level);
    conditions.push(`c.academic_level = $${params.length}`);
  }

  if (semester_type) {
    params.push(semester_type);
    conditions.push(`c.semester_type = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(c.course_code ILIKE $${params.length} OR c.course_title ILIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT c.id, c.course_code, c.course_title, c.academic_level, c.semester_type,
            c.credit_units, c.status, c.created_at, c.updated_at
     FROM courses c
     ${whereClause}
     ORDER BY c.academic_level ASC, c.course_code ASC`,
    params
  );

  res.json({
    success: true,
    count: result.rowCount,
    data: result.rows,
  });
}

export async function getCourseById(req, res, next) {
  const { id } = req.params;
  const result = await query(`SELECT * FROM courses WHERE id = $1`, [id]);
  if (result.rowCount === 0) {
    return next(new AppError('Course not found.', 404));
  }
  res.json({ success: true, data: result.rows[0] });
}

export async function createCourse(req, res, next) {
  const { course_code, course_title, academic_level, semester_type, credit_units = 3, status = 'active' } = req.body;

  if (!course_code || !course_title || !academic_level || !semester_type) {
    return next(new AppError('course_code, course_title, academic_level, and semester_type are required.', 400));
  }

  if (!['100', '200', '300', '400'].includes(academic_level)) {
    return next(new AppError('academic_level must be one of: 100, 200, 300, 400.', 400));
  }

  const existing = await query(`SELECT id FROM courses WHERE UPPER(course_code) = UPPER($1)`, [course_code.trim()]);
  if (existing.rowCount > 0) {
    return next(new AppError(`Course code "${course_code.toUpperCase()}" already exists.`, 409));
  }

  const result = await query(
    `INSERT INTO courses (course_code, course_title, academic_level, semester_type, credit_units, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [course_code.trim().toUpperCase(), course_title.trim(), academic_level, semester_type, credit_units, status]
  );

  const course = result.rows[0];

  await logAudit(req, {
    action: 'CREATE_COURSE',
    entityType: 'COURSE',
    entityId: course.id,
    metadata: { course_code: course.course_code, academic_level: course.academic_level },
  });

  res.status(201).json({
    success: true,
    message: 'Course created successfully',
    data: course,
  });
}

export async function updateCourse(req, res, next) {
  const { id } = req.params;
  const { course_code, course_title, academic_level, semester_type, credit_units, status } = req.body;

  const existingRes = await query(`SELECT * FROM courses WHERE id = $1`, [id]);
  if (existingRes.rowCount === 0) {
    return next(new AppError('Course not found.', 404));
  }

  if (academic_level && !['100', '200', '300', '400'].includes(academic_level)) {
    return next(new AppError('academic_level must be one of: 100, 200, 300, 400.', 400));
  }

  const result = await query(
    `UPDATE courses
     SET course_code = COALESCE($1, course_code),
         course_title = COALESCE($2, course_title),
         academic_level = COALESCE($3, academic_level),
         semester_type = COALESCE($4, semester_type),
         credit_units = COALESCE($5, credit_units),
         status = COALESCE($6, status),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $7
     RETURNING *`,
    [
      course_code ? course_code.trim().toUpperCase() : null,
      course_title ? course_title.trim() : null,
      academic_level || null,
      semester_type || null,
      credit_units || null,
      status || null,
      id,
    ]
  );

  await logAudit(req, {
    action: 'UPDATE_COURSE',
    entityType: 'COURSE',
    entityId: id,
    metadata: { course_code, status },
  });

  res.json({
    success: true,
    message: 'Course updated successfully',
    data: result.rows[0],
  });
}
