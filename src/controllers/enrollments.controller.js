import { query } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { logAudit } from '../utils/audit.js';

export async function getEnrollments(req, res, next) {
  const { course_id, student_id, academic_session_id, semester_id, academic_level, search } = req.query;
  const conditions = [];
  const params = [];

  if (course_id) {
    params.push(course_id);
    conditions.push(`e.course_id = $${params.length}`);
  }

  if (student_id) {
    params.push(student_id);
    conditions.push(`e.student_id = $${params.length}`);
  }

  if (academic_session_id) {
    params.push(academic_session_id);
    conditions.push(`e.academic_session_id = $${params.length}`);
  }

  if (semester_id) {
    params.push(semester_id);
    conditions.push(`e.semester_id = $${params.length}`);
  }

  if (academic_level) {
    params.push(academic_level);
    conditions.push(`s.academic_level = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(s.matric_number ILIKE $${params.length} OR s.full_name ILIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT e.id, e.enrollment_status, e.created_at,
            s.id AS student_id, s.matric_number, s.full_name AS student_name, s.academic_level, s.barcode_value,
            c.id AS course_id, c.course_code, c.course_title,
            a.session_label,
            sem.semester_name
     FROM student_course_enrollments e
     JOIN students s ON e.student_id = s.id
     JOIN courses c ON e.course_id = c.id
     JOIN academic_sessions a ON e.academic_session_id = a.id
     JOIN semesters sem ON e.semester_id = sem.id
     ${whereClause}
     ORDER BY s.academic_level ASC, s.matric_number ASC`,
    params
  );

  res.json({
    success: true,
    count: result.rowCount,
    data: result.rows,
  });
}

export async function enrollStudent(req, res, next) {
  const { student_id, course_id, academic_session_id, semester_id } = req.body;

  if (!student_id || !course_id || !academic_session_id || !semester_id) {
    return next(new AppError('student_id, course_id, academic_session_id, and semester_id are required.', 400));
  }

  // Check student and course existence
  const studentCheck = await query(`SELECT id, status FROM students WHERE id = $1`, [student_id]);
  if (studentCheck.rowCount === 0) {
    return next(new AppError('Student not found.', 404));
  }
  if (studentCheck.rows[0].status !== 'active') {
    return next(new AppError('Inactive student cannot be enrolled in courses.', 400));
  }

  const existing = await query(
    `SELECT id, enrollment_status FROM student_course_enrollments
     WHERE student_id = $1 AND course_id = $2 AND academic_session_id = $3 AND semester_id = $4`,
    [student_id, course_id, academic_session_id, semester_id]
  );

  let result;
  if (existing.rowCount > 0) {
    if (existing.rows[0].enrollment_status === 'enrolled') {
      return next(new AppError('Student is already enrolled in this course for this session and semester.', 409));
    }
    result = await query(
      `UPDATE student_course_enrollments SET enrollment_status = 'enrolled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [existing.rows[0].id]
    );
  } else {
    result = await query(
      `INSERT INTO student_course_enrollments (student_id, course_id, academic_session_id, semester_id, enrollment_status)
       VALUES ($1, $2, $3, $4, 'enrolled')
       RETURNING *`,
      [student_id, course_id, academic_session_id, semester_id]
    );
  }

  await logAudit(req, {
    action: 'ENROLL_STUDENT',
    entityType: 'ENROLLMENT',
    entityId: result.rows[0].id,
    metadata: { student_id, course_id, academic_session_id, semester_id },
  });

  res.status(201).json({
    success: true,
    message: 'Student enrolled in course successfully',
    data: result.rows[0],
  });
}

export async function bulkEnrollByLevel(req, res, next) {
  const { academic_level, course_id, academic_session_id, semester_id } = req.body;

  if (!academic_level || !course_id || !academic_session_id || !semester_id) {
    return next(new AppError('academic_level, course_id, academic_session_id, and semester_id are required.', 400));
  }

  // Find all active students at that academic level
  const studentsRes = await query(
    `SELECT id FROM students WHERE academic_level = $1 AND status = 'active'`,
    [academic_level]
  );

  if (studentsRes.rowCount === 0) {
    return next(new AppError(`No active students found in ${academic_level} Level.`, 404));
  }

  let enrolledCount = 0;
  for (const s of studentsRes.rows) {
    const insertRes = await query(
      `
      INSERT INTO student_course_enrollments (student_id, course_id, academic_session_id, semester_id, enrollment_status)
      VALUES ($1, $2, $3, $4, 'enrolled')
      ON CONFLICT (student_id, course_id, academic_session_id, semester_id)
      DO UPDATE SET enrollment_status = 'enrolled', updated_at = CURRENT_TIMESTAMP
      RETURNING id;
      `,
      [s.id, course_id, academic_session_id, semester_id]
    );
    if (insertRes.rowCount > 0) enrolledCount++;
  }

  await logAudit(req, {
    action: 'BULK_ENROLL_STUDENTS',
    entityType: 'ENROLLMENT',
    entityId: course_id,
    metadata: { academic_level, count: enrolledCount },
  });

  res.json({
    success: true,
    message: `Successfully enrolled ${enrolledCount} students of ${academic_level} Level into the course.`,
    count: enrolledCount,
  });
}

export async function dropEnrollment(req, res, next) {
  const { id } = req.params;

  const check = await query(`SELECT * FROM student_course_enrollments WHERE id = $1`, [id]);
  if (check.rowCount === 0) {
    return next(new AppError('Enrollment record not found.', 404));
  }

  await query(`DELETE FROM student_course_enrollments WHERE id = $1`, [id]);

  await logAudit(req, {
    action: 'DROP_STUDENT_ENROLLMENT',
    entityType: 'ENROLLMENT',
    entityId: id,
    metadata: { student_id: check.rows[0].student_id, course_id: check.rows[0].course_id },
  });

  res.json({
    success: true,
    message: 'Student enrollment removed successfully',
  });
}
