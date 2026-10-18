import { query, transaction } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { logAudit } from '../utils/audit.js';

export async function recordScan(req, res, next) {
  const session_id = req.body.session_id || req.body.attendance_session_id;
  const barcode_value = req.body.barcode_value;
  const scan_method_raw = String(req.body.scan_method || 'usb').toLowerCase();
  const action = req.body.action || 'check_in';

  if (!session_id || !barcode_value) {
    return next(new AppError('session_id (or attendance_session_id) and barcode_value are required.', 400));
  }

  const cleanBarcode = String(barcode_value).trim();
  const validMethods = ['usb', 'camera', 'manual_correction'];
  const finalScanMethod = validMethods.includes(scan_method_raw) ? scan_method_raw : 'usb';

  // 1. Fetch attendance session details
  const sessionRes = await query(
    `SELECT s.*, c.course_code, c.course_title, c.academic_level
     FROM attendance_sessions s
     JOIN courses c ON s.course_id = c.id
     WHERE s.id = $1`,
    [session_id]
  );

  if (sessionRes.rowCount === 0) {
    return next(new AppError('Attendance session not found.', 404));
  }

  const session = sessionRes.rows[0];

  // 2. Validate session status
  if (session.status !== 'open') {
    return next(new AppError(`Cannot record attendance: Session is currently "${session.status.toUpperCase()}". It must be OPEN.`, 400));
  }

  // 3. Authorization: Caller must be HOD or the assigned lecturer
  if (req.session.user.role === 'lecturer' && session.lecturer_id !== req.session.user.id) {
    return next(new AppError('You are not authorized to record attendance for this course session.', 403));
  }

  // 4. Look up student by barcode value
  const studentRes = await query(
    `SELECT * FROM students WHERE barcode_value = $1 OR UPPER(matric_number) = UPPER($1)`,
    [cleanBarcode]
  );

  if (studentRes.rowCount === 0) {
    return next(new AppError(`Unknown barcode: No student is registered with barcode/matric "${cleanBarcode}".`, 404));
  }

  const student = studentRes.rows[0];

  if (student.status !== 'active') {
    return next(new AppError(`Student ${student.full_name} (${student.matric_number}) is currently ${student.status} and cannot record attendance.`, 403));
  }

  // 5. Verify student is actively enrolled in this course for this session and semester
  const enrollmentRes = await query(
    `SELECT id, enrollment_status FROM student_course_enrollments
     WHERE student_id = $1 AND course_id = $2 AND academic_session_id = $3 AND semester_id = $4`,
    [student.id, session.course_id, session.academic_session_id, session.semester_id]
  );

  if (enrollmentRes.rowCount === 0 || enrollmentRes.rows[0].enrollment_status !== 'enrolled') {
    // If student's level matches or not specified, auto-enroll student so attendance marking is seamless!
    const courseLevel = session.academic_level;
    if (!courseLevel || student.academic_level === courseLevel) {
      await query(
        `INSERT INTO student_course_enrollments (student_id, course_id, academic_session_id, semester_id, enrollment_status)
         VALUES ($1, $2, $3, $4, 'enrolled')
         ON CONFLICT (student_id, course_id, academic_session_id, semester_id) 
         DO UPDATE SET enrollment_status = 'enrolled'`,
        [student.id, session.course_id, session.academic_session_id, session.semester_id]
      );
    } else {
      return next(
        new AppError(
          `Not Enrolled: Student ${student.full_name} (${student.matric_number}, Level ${student.academic_level}) is NOT enrolled in ${session.course_code} (${courseLevel}L).`,
          403
        )
      );
    }
  }

  // 6. Process Check-in or Check-out atomically
  try {
    const scanResult = await transaction(async (client) => {
      // Check existing attendance record with row-level lock
      const existingRecordRes = await client.query(
        `SELECT * FROM attendance_records
         WHERE attendance_session_id = $1 AND student_id = $2
         FOR UPDATE`,
        [session.id, student.id]
      );

      const now = new Date();

      if (action === 'check_out') {
        if (!session.allow_checkout) {
          throw new AppError('Check-out is not enabled for this attendance session.', 400);
        }
        if (existingRecordRes.rowCount === 0) {
          throw new AppError(`Student ${student.full_name} must check in before checking out.`, 400);
        }
        const record = existingRecordRes.rows[0];
        if (record.check_out_time) {
          throw new AppError(
            `Duplicate Check-Out: Student ${student.full_name} already checked out at ${new Date(record.check_out_time).toLocaleTimeString()}.`,
            409
          );
        }

        const updateRes = await client.query(
          `UPDATE attendance_records
           SET check_out_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 RETURNING *`,
          [record.id]
        );

        return {
          record: updateRes.rows[0],
          isCheckOut: true,
          status: record.status,
        };
      }

      // Normal Check-in
      if (existingRecordRes.rowCount > 0) {
        const prev = existingRecordRes.rows[0];
        const timeStr = new Date(prev.check_in_time).toLocaleTimeString();
        throw new AppError(
          `Already Marked: Student ${student.full_name} (${student.matric_number}) has already checked in at ${timeStr} (Status: ${prev.status.toUpperCase()}).`,
          409
        );
      }

      // Compute late vs present status
      const sessionDateStr = session.session_date instanceof Date
        ? session.session_date.toISOString().split('T')[0]
        : String(session.session_date);

      const sessionStartDateTime = new Date(`${sessionDateStr}T${session.start_time}`);
      const latenessThresholdMs = (session.lateness_threshold_minutes || 15) * 60 * 1000;
      const lateCutoffTime = new Date(sessionStartDateTime.getTime() + latenessThresholdMs);

      let attendanceStatus = 'present';
      if (now > lateCutoffTime) {
        attendanceStatus = 'late';
      }

      const insertRes = await client.query(
        `INSERT INTO attendance_records (
           attendance_session_id, student_id, check_in_time, status, scan_method, recorded_by_user_id
         )
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5)
         RETURNING *`,
        [session.id, student.id, attendanceStatus, finalScanMethod, req.session.user.id]
      );

      return {
        record: insertRes.rows[0],
        isCheckOut: false,
        status: attendanceStatus,
      };
    });

    const splitNames = (student.full_name || '').split(' ');
    const firstName = splitNames[0] || '';
    const lastName = splitNames.slice(1).join(' ') || '';

    const payload = {
      ...scanResult.record,
      first_name: firstName,
      last_name: lastName,
      student_name: student.full_name,
      reg_number: student.matric_number,
      matric_number: student.matric_number,
      level: student.academic_level,
      academic_level: student.academic_level,
      scanned_at: scanResult.record.check_in_time,
      check_in_time: scanResult.record.check_in_time,
    };

    res.status(200).json({
      success: true,
      message: scanResult.isCheckOut
        ? `Check-out recorded for ${student.full_name}`
        : `Attendance recorded: ${student.full_name} (${scanResult.status.toUpperCase()})`,
      data: payload,
      student: {
        id: student.id,
        matric_number: student.matric_number,
        reg_number: student.matric_number,
        full_name: student.full_name,
        first_name: firstName,
        last_name: lastName,
        academic_level: student.academic_level,
        level: student.academic_level,
        barcode_value: student.barcode_value,
      },
      attendance: {
        id: scanResult.record.id,
        status: scanResult.status,
        scan_method: finalScanMethod,
        check_in_time: scanResult.record.check_in_time,
        check_out_time: scanResult.record.check_out_time,
        scanned_at: scanResult.record.check_in_time,
      },
      session: {
        id: session.id,
        course_code: session.course_code,
        course_title: session.course_title,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getSessionAttendanceRecords(req, res, next) {
  const { id } = req.params;

  const result = await query(
    `SELECT ar.id, ar.check_in_time, ar.check_in_time AS scanned_at,
            ar.check_out_time, ar.status, ar.scan_method, ar.created_at,
            s.id AS student_id, s.matric_number, s.matric_number AS reg_number,
            s.full_name, s.full_name AS student_name,
            s.academic_level, s.academic_level AS level, s.barcode_value,
            u.full_name AS recorded_by_name
     FROM attendance_records ar
     JOIN students s ON ar.student_id = s.id
     LEFT JOIN users u ON ar.recorded_by_user_id = u.id
     WHERE ar.attendance_session_id = $1
     ORDER BY ar.check_in_time DESC`,
    [id]
  );

  res.json({
    success: true,
    count: result.rowCount,
    data: result.rows,
  });
}

export async function correctAttendanceRecord(req, res, next) {
  const { attendance_record_id, new_status, reason } = req.body;

  if (!attendance_record_id || !new_status || !reason) {
    return next(new AppError('attendance_record_id, new_status, and reason are required.', 400));
  }

  const validStatuses = ['present', 'late', 'absent', 'excused'];
  if (!validStatuses.includes(new_status)) {
    return next(new AppError(`new_status must be one of: ${validStatuses.join(', ')}`, 400));
  }

  const recordRes = await query(
    `SELECT ar.*, s.full_name, s.matric_number, sess.session_title, sess.lecturer_id
     FROM attendance_records ar
     JOIN students s ON ar.student_id = s.id
     JOIN attendance_sessions sess ON ar.attendance_session_id = sess.id
     WHERE ar.id = $1`,
    [attendance_record_id]
  );

  if (recordRes.rowCount === 0) {
    return next(new AppError('Attendance record not found.', 404));
  }

  const record = recordRes.rows[0];

  // Check authorization: HOD or the assigned lecturer or secretary
  if (req.session.user.role === 'lecturer' && record.lecturer_id !== req.session.user.id) {
    return next(new AppError('You are not authorized to correct attendance for this session.', 403));
  }

  const previousStatus = record.status;
  if (previousStatus === new_status) {
    return next(new AppError(`Record status is already "${new_status}".`, 400));
  }

  const updatedRecord = await transaction(async (client) => {
    // 1. Update attendance record
    const updateRes = await client.query(
      `UPDATE attendance_records
       SET status = $1, scan_method = 'manual_correction', updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [new_status, attendance_record_id]
    );

    // 2. Insert correction audit entry
    await client.query(
      `INSERT INTO attendance_corrections (
         attendance_record_id, attendance_session_id, student_id, previous_status, new_status, reason, actor_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [attendance_record_id, record.attendance_session_id, record.student_id, previousStatus, new_status, reason.trim(), req.session.user.id]
    );

    return updateRes.rows[0];
  });

  await logAudit(req, {
    action: 'ATTENDANCE_CORRECTION',
    entityType: 'ATTENDANCE_RECORD',
    entityId: attendance_record_id,
    metadata: {
      student: record.matric_number,
      previousStatus,
      newStatus: new_status,
      reason,
    },
  });

  res.json({
    success: true,
    message: `Attendance corrected for ${record.full_name}: changed from "${previousStatus}" to "${new_status}".`,
    data: updatedRecord,
  });
}
