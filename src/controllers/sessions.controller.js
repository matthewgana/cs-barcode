import { query, transaction } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { logAudit } from '../utils/audit.js';

export async function getSessions(req, res, next) {
  const { course_id, status, academic_session_id, semester_id, date } = req.query;
  const conditions = [];
  const params = [];

  // If role is lecturer, only show sessions assigned to them
  if (req.session.user.role === 'lecturer') {
    params.push(req.session.user.id);
    conditions.push(`s.lecturer_id = $${params.length}`);
  }

  if (course_id) {
    params.push(course_id);
    conditions.push(`s.course_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`s.status = $${params.length}`);
  }

  if (academic_session_id) {
    params.push(academic_session_id);
    conditions.push(`s.academic_session_id = $${params.length}`);
  }

  if (semester_id) {
    params.push(semester_id);
    conditions.push(`s.semester_id = $${params.length}`);
  }

  if (date) {
    params.push(date);
    conditions.push(`s.session_date = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT s.id, s.session_title, s.session_date, s.start_time, s.end_time,
            s.opened_at, s.closed_at, s.status, s.lateness_threshold_minutes, s.allow_checkout,
            s.created_at,
            c.id AS course_id, c.course_code, c.course_title, c.academic_level,
            u.id AS lecturer_id, u.full_name AS lecturer_name,
            a.session_label,
            sem.semester_name,
            (SELECT COUNT(*) FROM attendance_records ar WHERE ar.attendance_session_id = s.id AND ar.status = 'present') AS present_count,
            (SELECT COUNT(*) FROM attendance_records ar WHERE ar.attendance_session_id = s.id AND ar.status = 'late') AS late_count,
            (SELECT COUNT(*) FROM attendance_records ar WHERE ar.attendance_session_id = s.id AND ar.status = 'absent') AS absent_count,
            (SELECT COUNT(*) FROM student_course_enrollments sce 
             WHERE sce.course_id = s.course_id 
               AND sce.academic_session_id = s.academic_session_id 
               AND sce.semester_id = s.semester_id 
               AND sce.enrollment_status = 'enrolled') AS total_enrolled
     FROM attendance_sessions s
     JOIN courses c ON s.course_id = c.id
     JOIN users u ON s.lecturer_id = u.id
     JOIN academic_sessions a ON s.academic_session_id = a.id
     JOIN semesters sem ON s.semester_id = sem.id
     ${whereClause}
     ORDER BY s.session_date DESC, s.start_time DESC`,
    params
  );

  res.json({
    success: true,
    count: result.rowCount,
    data: result.rows,
  });
}

export async function getSessionById(req, res, next) {
  const { id } = req.params;

  const result = await query(
    `SELECT s.id, s.session_title, s.session_date, s.start_time, s.end_time,
            s.opened_at, s.closed_at, s.status, s.lateness_threshold_minutes, s.allow_checkout,
            s.created_at,
            c.id AS course_id, c.course_code, c.course_title, c.academic_level,
            u.id AS lecturer_id, u.full_name AS lecturer_name,
            a.id AS academic_session_id, a.session_label,
            sem.id AS semester_id, sem.semester_name
     FROM attendance_sessions s
     JOIN courses c ON s.course_id = c.id
     JOIN users u ON s.lecturer_id = u.id
     JOIN academic_sessions a ON s.academic_session_id = a.id
     JOIN semesters sem ON s.semester_id = sem.id
     WHERE s.id = $1`,
    [id]
  );

  if (result.rowCount === 0) {
    return next(new AppError('Attendance session not found.', 404));
  }

  const sessionData = result.rows[0];

  // If user is lecturer, verify they own this session
  if (req.session.user.role === 'lecturer' && sessionData.lecturer_id !== req.session.user.id) {
    return next(new AppError('You are not authorized to view this session.', 403));
  }

  // Get enrolled students & their current attendance record for this session
  const enrolledStudents = await query(
    `SELECT sce.student_id, s.matric_number, s.full_name, s.academic_level, s.barcode_value,
            ar.id AS attendance_record_id, ar.check_in_time, ar.check_out_time, ar.status AS attendance_status, ar.scan_method
     FROM student_course_enrollments sce
     JOIN students s ON sce.student_id = s.id
     LEFT JOIN attendance_records ar ON ar.attendance_session_id = $1 AND ar.student_id = s.id
     WHERE sce.course_id = $2 
       AND sce.academic_session_id = $3 
       AND sce.semester_id = $4 
       AND sce.enrollment_status = 'enrolled'
     ORDER BY s.matric_number ASC`,
    [sessionData.id, sessionData.course_id, sessionData.academic_session_id, sessionData.semester_id]
  );

  res.json({
    success: true,
    data: {
      ...sessionData,
      enrolled_students: enrolledStudents.rows,
    },
  });
}

export async function createSession(req, res, next) {
  const {
    course_id,
    academic_session_id,
    semester_id,
    session_title,
    session_date = new Date().toISOString().split('T')[0],
    start_time,
    end_time,
    lateness_threshold_minutes = 15,
    allow_checkout = false,
  } = req.body;

  if (!course_id || !academic_session_id || !semester_id || !session_title || !start_time || !end_time) {
    return next(new AppError('course_id, academic_session_id, semester_id, session_title, start_time, and end_time are required.', 400));
  }

  const lecturerId = req.session.user.role === 'lecturer' ? req.session.user.id : req.body.lecturer_id || req.session.user.id;

  // Check if lecturer is assigned to this course
  const assignmentRes = await query(
    `SELECT id FROM lecturer_assignments
     WHERE lecturer_id = $1 AND course_id = $2 AND academic_session_id = $3 AND semester_id = $4 AND assignment_status = 'assigned'`,
    [lecturerId, course_id, academic_session_id, semester_id]
  );

  if (assignmentRes.rowCount === 0 && req.session.user.role !== 'hod') {
    return next(new AppError('You are not assigned to teach this course for this session and semester.', 403));
  }

  const assignmentId = assignmentRes.rowCount > 0 ? assignmentRes.rows[0].id : null;

  const result = await query(
    `INSERT INTO attendance_sessions (
       course_id, lecturer_assignment_id, lecturer_id, academic_session_id, semester_id,
       session_title, session_date, start_time, end_time, lateness_threshold_minutes, allow_checkout, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'scheduled')
     RETURNING *`,
    [
      course_id,
      assignmentId,
      lecturerId,
      academic_session_id,
      semester_id,
      session_title.trim(),
      session_date,
      start_time,
      end_time,
      parseInt(lateness_threshold_minutes, 10),
      Boolean(allow_checkout),
    ]
  );

  const session = result.rows[0];

  await logAudit(req, {
    action: 'CREATE_ATTENDANCE_SESSION',
    entityType: 'ATTENDANCE_SESSION',
    entityId: session.id,
    metadata: { course_id, session_title },
  });

  res.status(201).json({
    success: true,
    message: 'Attendance session created successfully',
    data: session,
  });
}

export async function openSession(req, res, next) {
  const { id } = req.params;

  const sessionRes = await query(`SELECT * FROM attendance_sessions WHERE id = $1`, [id]);
  if (sessionRes.rowCount === 0) {
    return next(new AppError('Session not found.', 404));
  }

  const session = sessionRes.rows[0];
  if (session.status === 'open') {
    return res.json({ success: true, message: 'Session is already open.', data: session });
  }

  if (session.status === 'finalized') {
    return next(new AppError('Cannot re-open a finalized session.', 400));
  }

  const result = await query(
    `UPDATE attendance_sessions
     SET status = 'open',
         opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  await logAudit(req, {
    action: 'OPEN_ATTENDANCE_SESSION',
    entityType: 'ATTENDANCE_SESSION',
    entityId: id,
    metadata: { session_title: session.session_title },
  });

  res.json({
    success: true,
    message: 'Attendance session is now OPEN. Ready for barcode scanning.',
    data: result.rows[0],
  });
}

export async function closeSession(req, res, next) {
  const { id } = req.params;

  const sessionRes = await query(`SELECT * FROM attendance_sessions WHERE id = $1`, [id]);
  if (sessionRes.rowCount === 0) {
    return next(new AppError('Session not found.', 404));
  }

  const session = sessionRes.rows[0];
  if (session.status === 'closed') {
    return res.json({ success: true, message: 'Session is already closed.', data: session });
  }

  const result = await query(
    `UPDATE attendance_sessions
     SET status = 'closed',
         closed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  await logAudit(req, {
    action: 'CLOSE_ATTENDANCE_SESSION',
    entityType: 'ATTENDANCE_SESSION',
    entityId: id,
    metadata: { session_title: session.session_title },
  });

  res.json({
    success: true,
    message: 'Attendance session is now CLOSED. Further barcode scans are disabled.',
    data: result.rows[0],
  });
}

export async function finalizeSession(req, res, next) {
  const { id } = req.params;

  const sessionRes = await query(`SELECT * FROM attendance_sessions WHERE id = $1`, [id]);
  if (sessionRes.rowCount === 0) {
    return next(new AppError('Session not found.', 404));
  }

  const session = sessionRes.rows[0];

  if (session.status === 'open') {
    return next(new AppError('Please close the attendance session before finalization.', 400));
  }

  if (session.status === 'finalized') {
    return res.json({ success: true, message: 'Session has already been finalized.', data: session });
  }

  const updatedSession = await transaction(async (client) => {
    // 1. Find all active enrolled students who do NOT have an attendance record for this session
    const absentStudentsRes = await client.query(
      `
      SELECT sce.student_id
      FROM student_course_enrollments sce
      JOIN students s ON sce.student_id = s.id
      WHERE sce.course_id = $1
        AND sce.academic_session_id = $2
        AND sce.semester_id = $3
        AND sce.enrollment_status = 'enrolled'
        AND s.status = 'active'
        AND sce.student_id NOT IN (
          SELECT ar.student_id FROM attendance_records ar WHERE ar.attendance_session_id = $4
        )
      `,
      [session.course_id, session.academic_session_id, session.semester_id, session.id]
    );

    // 2. Insert 'absent' records for each unrecorded student
    for (const absent of absentStudentsRes.rows) {
      await client.query(
        `
        INSERT INTO attendance_records (
          attendance_session_id, student_id, check_in_time, status, scan_method, recorded_by_user_id
        )
        VALUES ($1, $2, CURRENT_TIMESTAMP, 'absent', 'manual_correction', $3)
        ON CONFLICT (attendance_session_id, student_id) DO NOTHING
        `,
        [session.id, absent.student_id, req.session.user.id]
      );
    }

    // 3. Set session status to finalized
    const finalRes = await client.query(
      `
      UPDATE attendance_sessions
      SET status = 'finalized',
          closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [session.id]
    );

    return {
      session: finalRes.rows[0],
      absentCount: absentStudentsRes.rowCount,
    };
  });

  await logAudit(req, {
    action: 'FINALIZE_ATTENDANCE_SESSION',
    entityType: 'ATTENDANCE_SESSION',
    entityId: id,
    metadata: { absentStudentsMarked: updatedSession.absentCount },
  });

  res.json({
    success: true,
    message: `Session finalized successfully. Marked ${updatedSession.absentCount} non-attending enrolled students as absent.`,
    data: updatedSession.session,
  });
}
