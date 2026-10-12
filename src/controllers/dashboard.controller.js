import { query } from '../config/db.js';

export async function getDashboardStats(req, res, next) {
  try {
    const user = req.session.user;
    const isLecturer = user.role === 'lecturer';

    // 1. Students breakdown by Level (100, 200, 300, 400)
    const levelCountsRes = await query(
      `SELECT academic_level, COUNT(*) AS count
       FROM students
       WHERE status = 'active'
       GROUP BY academic_level
       ORDER BY academic_level ASC`
    );

    const studentsByLevel = {
      '100': 0,
      '200': 0,
      '300': 0,
      '400': 0,
      total: 0,
    };

    levelCountsRes.rows.forEach((r) => {
      studentsByLevel[r.academic_level] = parseInt(r.count, 10);
      studentsByLevel.total += parseInt(r.count, 10);
    });

    // 2. Courses count
    let totalCoursesQuery = `SELECT COUNT(*) FROM courses WHERE status = 'active'`;
    let coursesParams = [];
    if (isLecturer) {
      totalCoursesQuery = `
        SELECT COUNT(DISTINCT course_id)
        FROM lecturer_assignments
        WHERE lecturer_id = $1 AND assignment_status = 'assigned'
      `;
      coursesParams = [user.id];
    }
    const coursesRes = await query(totalCoursesQuery, coursesParams);
    const totalCourses = parseInt(coursesRes.rows[0].count, 10);

    // 3. Active open sessions
    let openSessionsQuery = `SELECT COUNT(*) FROM attendance_sessions WHERE status = 'open'`;
    let openParams = [];
    if (isLecturer) {
      openSessionsQuery += ` AND lecturer_id = $1`;
      openParams = [user.id];
    }
    const openSessionsRes = await query(openSessionsQuery, openParams);
    const activeOpenSessions = parseInt(openSessionsRes.rows[0].count, 10);

    // 4. Today's attendance scans
    let todayScansQuery = `
      SELECT COUNT(*)
      FROM attendance_records ar
      JOIN attendance_sessions s ON ar.attendance_session_id = s.id
      WHERE DATE(ar.check_in_time) = CURRENT_DATE
    `;
    let scanParams = [];
    if (isLecturer) {
      todayScansQuery += ` AND s.lecturer_id = $1`;
      scanParams = [user.id];
    }
    const todayScansRes = await query(todayScansQuery, scanParams);
    const todayScans = parseInt(todayScansRes.rows[0].count, 10);

    // 5. Attendance status distribution (present, late, absent)
    let statusDistQuery = `
      SELECT ar.status, COUNT(*) as count
      FROM attendance_records ar
      JOIN attendance_sessions s ON ar.attendance_session_id = s.id
    `;
    let distParams = [];
    if (isLecturer) {
      statusDistQuery += ` WHERE s.lecturer_id = $1`;
      distParams = [user.id];
    }
    statusDistQuery += ` GROUP BY ar.status`;
    const statusDistRes = await query(statusDistQuery, distParams);

    const statusCounts = { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
    statusDistRes.rows.forEach((r) => {
      statusCounts[r.status] = parseInt(r.count, 10);
      statusCounts.total += parseInt(r.count, 10);
    });

    const attendanceRate = statusCounts.total > 0
      ? Math.round(((statusCounts.present + statusCounts.late) / statusCounts.total) * 100)
      : 100;

    // 6. Recent attendance scans (last 10)
    let recentScansQuery = `
      SELECT ar.id, ar.check_in_time, ar.status, ar.scan_method,
             s.matric_number, s.full_name, s.academic_level,
             c.course_code, c.course_title,
             sess.session_title
      FROM attendance_records ar
      JOIN students s ON ar.student_id = s.id
      JOIN attendance_sessions sess ON ar.attendance_session_id = sess.id
      JOIN courses c ON sess.course_id = c.id
    `;
    let recentParams = [];
    if (isLecturer) {
      recentScansQuery += ` WHERE sess.lecturer_id = $1`;
      recentParams = [user.id];
    }
    recentScansQuery += ` ORDER BY ar.check_in_time DESC LIMIT 10`;
    const recentScansRes = await query(recentScansQuery, recentParams);

    res.json({
      success: true,
      data: {
        studentsByLevel,
        totalCourses,
        activeOpenSessions,
        todayScans,
        statusCounts,
        attendanceRate,
        recentScans: recentScansRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}
