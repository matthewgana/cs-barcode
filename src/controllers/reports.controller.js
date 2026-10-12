import { query } from '../config/db.js';

function buildReportFilter(req) {
  const {
    academic_session_id,
    semester_id,
    academic_level,
    course_id,
    lecturer_id,
    attendance_session_id,
    status,
    search,
    date_from,
    date_to,
  } = req.query;

  const conditions = [];
  const params = [];

  // Role filtering
  if (req.session.user.role === 'lecturer') {
    params.push(req.session.user.id);
    conditions.push(`sess.lecturer_id = $${params.length}`);
  } else if (lecturer_id) {
    params.push(lecturer_id);
    conditions.push(`sess.lecturer_id = $${params.length}`);
  }

  if (academic_session_id) {
    params.push(academic_session_id);
    conditions.push(`sess.academic_session_id = $${params.length}`);
  }

  if (semester_id) {
    params.push(semester_id);
    conditions.push(`sess.semester_id = $${params.length}`);
  }

  if (academic_level) {
    params.push(academic_level);
    conditions.push(`s.academic_level = $${params.length}`);
  }

  if (course_id) {
    params.push(course_id);
    conditions.push(`sess.course_id = $${params.length}`);
  }

  if (attendance_session_id) {
    params.push(attendance_session_id);
    conditions.push(`ar.attendance_session_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`ar.status = $${params.length}`);
  }

  if (date_from) {
    params.push(date_from);
    conditions.push(`sess.session_date >= $${params.length}`);
  }

  if (date_to) {
    params.push(date_to);
    conditions.push(`sess.session_date <= $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(s.matric_number ILIKE $${params.length} OR s.full_name ILIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}

export async function getAttendanceReport(req, res, next) {
  try {
    const { whereClause, params } = buildReportFilter(req);

    // Fetch matching attendance records
    const recordsQuery = `
      SELECT ar.id, ar.check_in_time, ar.check_out_time, ar.status, ar.scan_method,
             s.id AS student_id, s.matric_number, s.full_name AS student_name, s.academic_level, s.barcode_value,
             c.course_code, c.course_title,
             sess.id AS session_id, sess.session_title, sess.session_date, sess.start_time, sess.end_time,
             u.full_name AS lecturer_name,
             a.session_label,
             sem.semester_name
      FROM attendance_records ar
      JOIN students s ON ar.student_id = s.id
      JOIN attendance_sessions sess ON ar.attendance_session_id = sess.id
      JOIN courses c ON sess.course_id = c.id
      JOIN users u ON sess.lecturer_id = u.id
      JOIN academic_sessions a ON sess.academic_session_id = a.id
      JOIN semesters sem ON sess.semester_id = sem.id
      ${whereClause}
      ORDER BY sess.session_date DESC, ar.check_in_time DESC
      LIMIT 1000
    `;

    const recordsRes = await query(recordsQuery, params);

    // Summary aggregation
    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;
    let totalExcused = 0;

    recordsRes.rows.forEach((r) => {
      if (r.status === 'present') totalPresent++;
      else if (r.status === 'late') totalLate++;
      else if (r.status === 'absent') totalAbsent++;
      else if (r.status === 'excused') totalExcused++;
    });

    const totalRecords = recordsRes.rowCount;
    const attendedCount = totalPresent + totalLate;
    const attendancePercentage = totalRecords > 0 ? Math.round((attendedCount / totalRecords) * 100) : 0;

    res.json({
      success: true,
      summary: {
        totalRecords,
        totalPresent,
        totalLate,
        totalAbsent,
        totalExcused,
        attendancePercentage,
      },
      records: recordsRes.rows,
    });
  } catch (err) {
    next(err);
  }
}

export async function exportReportCSV(req, res, next) {
  try {
    const { whereClause, params } = buildReportFilter(req);

    const recordsQuery = `
      SELECT ar.id, ar.check_in_time, ar.check_out_time, ar.status, ar.scan_method,
             s.matric_number, s.full_name AS student_name, s.academic_level,
             c.course_code, c.course_title,
             sess.session_title, sess.session_date,
             u.full_name AS lecturer_name,
             a.session_label,
             sem.semester_name
      FROM attendance_records ar
      JOIN students s ON ar.student_id = s.id
      JOIN attendance_sessions sess ON ar.attendance_session_id = sess.id
      JOIN courses c ON sess.course_id = c.id
      JOIN users u ON sess.lecturer_id = u.id
      JOIN academic_sessions a ON sess.academic_session_id = a.id
      JOIN semesters sem ON sess.semester_id = sem.id
      ${whereClause}
      ORDER BY sess.session_date DESC, ar.check_in_time DESC
    `;

    const recordsRes = await query(recordsQuery, params);

    // Build CSV content
    const headers = [
      'Matric Number',
      'Student Name',
      'Academic Level',
      'Course Code',
      'Course Title',
      'Session Title',
      'Session Date',
      'Academic Session',
      'Semester',
      'Lecturer',
      'Status',
      'Check-in Time',
      'Check-out Time',
      'Scan Method',
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csvContent = headers.join(',') + '\r\n';

    recordsRes.rows.forEach((r) => {
      const row = [
        escapeCsv(r.matric_number),
        escapeCsv(r.student_name),
        escapeCsv(`${r.academic_level} Level`),
        escapeCsv(r.course_code),
        escapeCsv(r.course_title),
        escapeCsv(r.session_title),
        escapeCsv(r.session_date ? new Date(r.session_date).toISOString().split('T')[0] : ''),
        escapeCsv(r.session_label),
        escapeCsv(r.semester_name),
        escapeCsv(r.lecturer_name),
        escapeCsv(r.status.toUpperCase()),
        escapeCsv(r.check_in_time ? new Date(r.check_in_time).toLocaleString() : ''),
        escapeCsv(r.check_out_time ? new Date(r.check_out_time).toLocaleString() : ''),
        escapeCsv(r.scan_method),
      ];
      csvContent += row.join(',') + '\r\n';
    });

    const filename = `CS_Attendance_Report_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
}
