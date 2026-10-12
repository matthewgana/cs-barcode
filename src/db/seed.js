import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

export async function runSeeds() {
  console.log('Seeding database with CS Department development data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Clean existing data for clean seed
    await client.query(`
      TRUNCATE TABLE attendance_corrections, attendance_records, attendance_sessions,
                     student_course_enrollments, lecturer_assignments, students, courses,
                     semesters, academic_sessions, users, audit_logs, "session"
      CASCADE;
    `);

    // 1. Users
    const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

    const userRows = await client.query(
      `
      INSERT INTO users (full_name, username, email, password_hash, role, status)
      VALUES
        ('Prof. Babatunde Lawal (HOD)', 'hod', 'hod@cs.edu', $1, 'hod', 'active'),
        ('Dr. Kehinde Adebayo', 'lecturer1', 'dr.adebayo@cs.edu', $1, 'lecturer', 'active'),
        ('Prof. Chidi Okoro', 'lecturer2', 'prof.okoro@cs.edu', $1, 'lecturer', 'active'),
        ('Dr. Fatima Bello', 'lecturer3', 'dr.fatima@cs.edu', $1, 'lecturer', 'active'),
        ('Mrs. Alice Johnson', 'secretary', 'secretary@cs.edu', $1, 'secretary', 'active')
      RETURNING id, username, role;
      `,
      [defaultPasswordHash]
    );

    const userMap = {};
    userRows.rows.forEach((u) => {
      userMap[u.username] = u.id;
    });

    // 2. Academic Sessions
    const sessionRes = await client.query(`
      INSERT INTO academic_sessions (session_label, start_date, end_date, status)
      VALUES ('2025/2026', '2025-09-01', '2026-07-31', 'active')
      RETURNING id;
    `);
    const academicSessionId = sessionRes.rows[0].id;

    // 3. Semesters
    const semesterRes = await client.query(
      `
      INSERT INTO semesters (academic_session_id, semester_name, start_date, end_date, status)
      VALUES
        ($1, 'First Semester', '2025-09-01', '2026-02-28', 'active'),
        ($1, 'Second Semester', '2026-03-01', '2026-07-31', 'upcoming')
      RETURNING id, semester_name;
      `,
      [academicSessionId]
    );
    const firstSemesterId = semesterRes.rows.find((s) => s.semester_name === 'First Semester').id;
    const secondSemesterId = semesterRes.rows.find((s) => s.semester_name === 'Second Semester').id;

    // 4. Courses (100, 200, 300, 400 Levels)
    const coursesRes = await client.query(`
      INSERT INTO courses (course_code, course_title, academic_level, semester_type, credit_units, status)
      VALUES
        ('CSC 101', 'Introduction to Computer Science', '100', 'First Semester', 3, 'active'),
        ('CSC 102', 'Problem Solving & Programming in Python', '100', 'First Semester', 3, 'active'),
        ('CSC 201', 'Data Structures and Algorithms', '200', 'First Semester', 3, 'active'),
        ('CSC 203', 'Computer Architecture & Assembly', '200', 'First Semester', 3, 'active'),
        ('CSC 301', 'Operating Systems & Systems Programming', '300', 'First Semester', 3, 'active'),
        ('CSC 303', 'Database Management Systems', '300', 'First Semester', 3, 'active'),
        ('CSC 401', 'Software Engineering Practice', '400', 'First Semester', 3, 'active'),
        ('CSC 403', 'Artificial Intelligence & Machine Learning', '400', 'First Semester', 3, 'active')
      RETURNING id, course_code, academic_level;
    `);

    const courseMap = {};
    coursesRes.rows.forEach((c) => {
      courseMap[c.course_code] = c.id;
    });

    // 5. Lecturer Assignments
    const assignRes = await client.query(
      `
      INSERT INTO lecturer_assignments (lecturer_id, course_id, academic_session_id, semester_id, assignment_status)
      VALUES
        ($1, $4, $7, $8, 'assigned'), -- Dr. Adebayo -> CSC 101
        ($1, $5, $7, $8, 'assigned'), -- Dr. Adebayo -> CSC 201
        ($2, $6, $7, $8, 'assigned'), -- Prof. Okoro -> CSC 301
        ($2, $9, $7, $8, 'assigned'), -- Prof. Okoro -> CSC 401
        ($3, $10, $7, $8, 'assigned') -- Dr. Fatima -> CSC 303
      RETURNING id, course_id, lecturer_id;
      `,
      [
        userMap['lecturer1'],
        userMap['lecturer2'],
        userMap['lecturer3'],
        courseMap['CSC 101'],
        courseMap['CSC 201'],
        courseMap['CSC 301'],
        academicSessionId,
        firstSemesterId,
        courseMap['CSC 401'],
        courseMap['CSC 303'],
      ]
    );

    const csc201AssignmentId = assignRes.rows.find((a) => a.course_id === courseMap['CSC 201']).id;

    // 6. Students (100, 200, 300, 400 Levels)
    const studentsRes = await client.query(`
      INSERT INTO students (matric_number, full_name, academic_level, barcode_value, email, phone, admission_year, status)
      VALUES
        -- 100 Level
        ('CSC/2025/1001', 'John O. Doe', '100', 'CS100-1001', 'john.doe@cs.students.edu', '08012345601', 2025, 'active'),
        ('CSC/2025/1002', 'Mary A. Smith', '100', 'CS100-1002', 'mary.smith@cs.students.edu', '08012345602', 2025, 'active'),
        ('CSC/2025/1003', 'Ibrahim Y. Musa', '100', 'CS100-1003', 'ibrahim.musa@cs.students.edu', '08012345603', 2025, 'active'),
        ('CSC/2025/1004', 'Chidinma R. Eze', '100', 'CS100-1004', 'chidinma.eze@cs.students.edu', '08012345604', 2025, 'active'),
        
        -- 200 Level
        ('CSC/2024/2001', 'Daniel E. Okafor', '200', 'CS200-2001', 'daniel.okafor@cs.students.edu', '08012345605', 2024, 'active'),
        ('CSC/2024/2002', 'Grace B. Adams', '200', 'CS200-2002', 'grace.adams@cs.students.edu', '08012345606', 2024, 'active'),
        ('CSC/2024/2003', 'Ahmed T. Usman', '200', 'CS200-2003', 'ahmed.usman@cs.students.edu', '08012345607', 2024, 'active'),
        ('CSC/2024/2004', 'Zainab K. Aliyu', '200', 'CS200-2004', 'zainab.aliyu@cs.students.edu', '08012345608', 2024, 'active'),

        -- 300 Level
        ('CSC/2023/3001', 'Victor C. Williams', '300', 'CS300-3001', 'victor.williams@cs.students.edu', '08012345609', 2023, 'active'),
        ('CSC/2023/3002', 'Blessing O. Adeleke', '300', 'CS300-3002', 'blessing.adeleke@cs.students.edu', '08012345610', 2023, 'active'),
        ('CSC/2023/3003', 'Samuel S. Damilola', '300', 'CS300-3003', 'samuel.damilola@cs.students.edu', '08012345611', 2023, 'active'),

        -- 400 Level
        ('CSC/2022/4001', 'Emmanuel T. Davies', '400', 'CS400-4001', 'emmanuel.davies@cs.students.edu', '08012345612', 2022, 'active'),
        ('CSC/2022/4002', 'Folake M. Ogunleye', '400', 'CS400-4002', 'folake.ogunleye@cs.students.edu', '08012345613', 2022, 'active'),
        ('CSC/2022/4003', 'Kenneth I. Nnamdi', '400', 'CS400-4003', 'kenneth.nnamdi@cs.students.edu', '08012345614', 2022, 'active')
      RETURNING id, matric_number, academic_level, barcode_value;
    `);

    const studentMap = {};
    studentsRes.rows.forEach((s) => {
      studentMap[s.matric_number] = s.id;
    });

    // 7. Enrollments
    // 100 level students enroll in CSC 101, CSC 102
    // 200 level students enroll in CSC 201, CSC 203
    // 300 level students enroll in CSC 301, CSC 303
    // 400 level students enroll in CSC 401, CSC 403
    for (const s of studentsRes.rows) {
      if (s.academic_level === '100') {
        await client.query(
          `INSERT INTO student_course_enrollments (student_id, course_id, academic_session_id, semester_id) VALUES ($1, $2, $3, $4), ($1, $5, $3, $4)`,
          [s.id, courseMap['CSC 101'], academicSessionId, firstSemesterId, courseMap['CSC 102']]
        );
      } else if (s.academic_level === '200') {
        await client.query(
          `INSERT INTO student_course_enrollments (student_id, course_id, academic_session_id, semester_id) VALUES ($1, $2, $3, $4), ($1, $5, $3, $4)`,
          [s.id, courseMap['CSC 201'], academicSessionId, firstSemesterId, courseMap['CSC 203']]
        );
      } else if (s.academic_level === '300') {
        await client.query(
          `INSERT INTO student_course_enrollments (student_id, course_id, academic_session_id, semester_id) VALUES ($1, $2, $3, $4), ($1, $5, $3, $4)`,
          [s.id, courseMap['CSC 301'], academicSessionId, firstSemesterId, courseMap['CSC 303']]
        );
      } else if (s.academic_level === '400') {
        await client.query(
          `INSERT INTO student_course_enrollments (student_id, course_id, academic_session_id, semester_id) VALUES ($1, $2, $3, $4), ($1, $5, $3, $4)`,
          [s.id, courseMap['CSC 401'], academicSessionId, firstSemesterId, courseMap['CSC 403']]
        );
      }
    }

    // 8. Attendance Sessions
    // A live OPEN session for CSC 201 (assigned to Dr. Adebayo)
    const liveSessionRes = await client.query(
      `
      INSERT INTO attendance_sessions (
        course_id, lecturer_assignment_id, lecturer_id, academic_session_id, semester_id,
        session_title, session_date, start_time, end_time, opened_at, status, lateness_threshold_minutes, allow_checkout
      )
      VALUES
        ($1, $2, $3, $4, $5, 'Week 4: Binary Trees & Heaps Implementation', CURRENT_DATE, '08:00', '10:00', CURRENT_TIMESTAMP, 'open', 15, true)
      RETURNING id;
      `,
      [courseMap['CSC 201'], csc201AssignmentId, userMap['lecturer1'], academicSessionId, firstSemesterId]
    );
    const liveSessionId = liveSessionRes.rows[0].id;

    // A past CLOSED & FINALIZED session for CSC 201
    const pastSessionRes = await client.query(
      `
      INSERT INTO attendance_sessions (
        course_id, lecturer_assignment_id, lecturer_id, academic_session_id, semester_id,
        session_title, session_date, start_time, end_time, opened_at, closed_at, status, lateness_threshold_minutes
      )
      VALUES
        ($1, $2, $3, $4, $5, 'Week 3: Linked Lists & Array Deques', CURRENT_DATE - INTERVAL '7 days', '08:00', '10:00',
         CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '2 hours', 'finalized', 15)
      RETURNING id;
      `,
      [courseMap['CSC 201'], csc201AssignmentId, userMap['lecturer1'], academicSessionId, firstSemesterId]
    );
    const pastSessionId = pastSessionRes.rows[0].id;

    // Past session records
    const s200_1 = studentMap['CSC/2024/2001'];
    const s200_2 = studentMap['CSC/2024/2002'];
    const s200_3 = studentMap['CSC/2024/2003'];
    const s200_4 = studentMap['CSC/2024/2004'];

    await client.query(
      `
      INSERT INTO attendance_records (attendance_session_id, student_id, check_in_time, status, scan_method, recorded_by_user_id)
      VALUES
        ($1, $2, CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '5 minutes', 'present', 'usb', $6),
        ($1, $3, CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '20 minutes', 'late', 'camera', $6),
        ($1, $4, CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '8 minutes', 'present', 'usb', $6),
        ($1, $5, CURRENT_TIMESTAMP - INTERVAL '7 days', 'absent', 'manual_correction', $6);
      `,
      [pastSessionId, s200_1, s200_2, s200_3, s200_4, userMap['lecturer1']]
    );

    // Initial audit log
    await client.query(`
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
      VALUES ($1, 'DATABASE_SEED', 'SYSTEM', '1', '{"message": "Development database seeded with CS department data"}'::jsonb);
    `, [userMap['hod']]);

    await client.query('COMMIT');
    console.log('✓ CS Department development seed data inserted successfully.');
    console.log('  Accounts available:');
    console.log('  - HOD: username: "hod", password: "Password123!"');
    console.log('  - Lecturer: username: "lecturer1", password: "Password123!"');
    console.log('  - Secretary: username: "secretary", password: "Password123!"');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeeds()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
