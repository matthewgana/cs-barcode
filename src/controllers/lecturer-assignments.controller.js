import { query } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { logAudit } from '../utils/audit.js';

export async function getLecturerAssignments(req, res, next) {
  const { lecturer_id, course_id, academic_session_id, semester_id, assignment_status } = req.query;
  const conditions = [];
  const params = [];

  // If a lecturer is logged in and not HOD, restrict to their own assignments
  if (req.session.user.role === 'lecturer') {
    params.push(req.session.user.id);
    conditions.push(`la.lecturer_id = $${params.length}`);
  } else if (lecturer_id) {
    params.push(lecturer_id);
    conditions.push(`la.lecturer_id = $${params.length}`);
  }

  if (course_id) {
    params.push(course_id);
    conditions.push(`la.course_id = $${params.length}`);
  }

  if (academic_session_id) {
    params.push(academic_session_id);
    conditions.push(`la.academic_session_id = $${params.length}`);
  }

  if (semester_id) {
    params.push(semester_id);
    conditions.push(`la.semester_id = $${params.length}`);
  }

  if (assignment_status) {
    params.push(assignment_status);
    conditions.push(`la.assignment_status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT la.id, la.assignment_status, la.created_at,
            u.id AS lecturer_id, u.full_name AS lecturer_name, u.email AS lecturer_email,
            c.id AS course_id, c.course_code, c.course_title, c.academic_level,
            a.id AS session_id, a.session_label,
            s.id AS semester_id, s.semester_name
     FROM lecturer_assignments la
     JOIN users u ON la.lecturer_id = u.id
     JOIN courses c ON la.course_id = c.id
     JOIN academic_sessions a ON la.academic_session_id = a.id
     JOIN semesters s ON la.semester_id = s.id
     ${whereClause}
     ORDER BY a.session_label DESC, c.course_code ASC`,
    params
  );

  res.json({
    success: true,
    count: result.rowCount,
    data: result.rows,
  });
}

export async function createLecturerAssignment(req, res, next) {
  const { lecturer_id, course_id, academic_session_id, semester_id } = req.body;

  if (!lecturer_id || !course_id || !academic_session_id || !semester_id) {
    return next(new AppError('lecturer_id, course_id, academic_session_id, and semester_id are required.', 400));
  }

  // Ensure user is actually a lecturer
  const userCheck = await query(`SELECT id, role, full_name FROM users WHERE id = $1`, [lecturer_id]);
  if (userCheck.rowCount === 0 || userCheck.rows[0].role !== 'lecturer') {
    return next(new AppError('The specified user is not a registered lecturer.', 400));
  }

  // Check unique assignment
  const existing = await query(
    `SELECT id, assignment_status FROM lecturer_assignments
     WHERE lecturer_id = $1 AND course_id = $2 AND academic_session_id = $3 AND semester_id = $4`,
    [lecturer_id, course_id, academic_session_id, semester_id]
  );

  let result;
  if (existing.rowCount > 0) {
    if (existing.rows[0].assignment_status === 'assigned') {
      return next(new AppError('Lecturer is already assigned to this course for this session and semester.', 409));
    }
    // Re-activate assignment if previously revoked
    result = await query(
      `UPDATE lecturer_assignments SET assignment_status = 'assigned', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [existing.rows[0].id]
    );
  } else {
    result = await query(
      `INSERT INTO lecturer_assignments (lecturer_id, course_id, academic_session_id, semester_id, assignment_status)
       VALUES ($1, $2, $3, $4, 'assigned')
       RETURNING *`,
      [lecturer_id, course_id, academic_session_id, semester_id]
    );
  }

  await logAudit(req, {
    action: 'ASSIGN_LECTURER_COURSE',
    entityType: 'LECTURER_ASSIGNMENT',
    entityId: result.rows[0].id,
    metadata: { lecturer_id, course_id, academic_session_id, semester_id },
  });

  res.status(201).json({
    success: true,
    message: 'Lecturer assigned to course successfully',
    data: result.rows[0],
  });
}

export async function revokeLecturerAssignment(req, res, next) {
  const { id } = req.params;

  const check = await query(`SELECT * FROM lecturer_assignments WHERE id = $1`, [id]);
  if (check.rowCount === 0) {
    return next(new AppError('Assignment not found.', 404));
  }

  await query(`UPDATE lecturer_assignments SET assignment_status = 'revoked', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);

  await logAudit(req, {
    action: 'REVOKE_LECTURER_COURSE',
    entityType: 'LECTURER_ASSIGNMENT',
    entityId: id,
    metadata: { previousStatus: check.rows[0].assignment_status },
  });

  res.json({
    success: true,
    message: 'Lecturer course assignment revoked successfully',
  });
}
