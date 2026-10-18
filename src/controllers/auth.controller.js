import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { logAudit } from '../utils/audit.js';
import { generateStudentBarcodeValue } from '../utils/barcode.js';

export async function register(req, res, next) {
  const {
    role = 'student',
    full_name,
    username,
    email,
    password,
    matric_number,
    academic_level = '100',
    phone,
  } = req.body;

  if (!full_name || !email || !password) {
    return next(new AppError('Full name, email, and password are required.', 400));
  }

  const cleanRole = String(role).toLowerCase().trim();
  if (!['student', 'lecturer', 'secretary', 'hod'].includes(cleanRole)) {
    return next(new AppError('Invalid role specified. Must be student, lecturer, secretary, or hod.', 400));
  }

  if (password.length < 6) {
    return next(new AppError('Password must be at least 6 characters long.', 400));
  }

  const cleanEmail = email.trim().toLowerCase();
  let cleanUsername = username ? username.trim().toLowerCase() : '';

  if (cleanRole === 'student') {
    if (!matric_number) {
      return next(new AppError('Matriculation number is required for student registration.', 400));
    }
    const cleanLevel = String(academic_level).replace(/\D/g, '') || '100';
    if (!['100', '200', '300', '400'].includes(cleanLevel)) {
      return next(new AppError('Academic level must be 100, 200, 300, or 400.', 400));
    }

    if (!cleanUsername) {
      cleanUsername = matric_number.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    }
  } else {
    if (!cleanUsername) {
      cleanUsername = cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');
    }
  }

  // Check if username or email already exists in users
  const existingUserRes = await query(
    `SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)`,
    [cleanUsername, cleanEmail]
  );

  if (existingUserRes.rowCount > 0) {
    return next(new AppError('A user account with this username or email already exists.', 409));
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let studentRecord = null;

  if (cleanRole === 'student') {
    const cleanMatric = matric_number.trim().toUpperCase();
    const cleanLevel = String(academic_level).replace(/\D/g, '') || '100';

    // Check if student already exists in students table
    const existingStudentRes = await query(
      `SELECT id, user_id, barcode_value FROM students WHERE UPPER(matric_number) = $1`,
      [cleanMatric]
    );

    if (existingStudentRes.rowCount > 0) {
      studentRecord = existingStudentRes.rows[0];
      if (studentRecord.user_id) {
        return next(new AppError(`An account has already been registered for matric number ${cleanMatric}. Please sign in.`, 409));
      }
      // Update student email/phone if provided
      await query(
        `UPDATE students 
         SET email = COALESCE($1, email),
             phone = COALESCE($2, phone),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [cleanEmail, phone ? phone.trim() : null, studentRecord.id]
      );
    } else {
      // Create student record with new barcode
      const barcodeValue = generateStudentBarcodeValue(cleanLevel, cleanMatric);
      const newStudentRes = await query(
        `INSERT INTO students (matric_number, full_name, academic_level, barcode_value, email, phone, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')
         RETURNING id, matric_number, academic_level, barcode_value`,
        [cleanMatric, full_name.trim(), cleanLevel, barcodeValue, cleanEmail, phone ? phone.trim() : null]
      );
      studentRecord = newStudentRes.rows[0];
    }
  }

  // Insert into users
  const userInsertRes = await query(
    `INSERT INTO users (full_name, username, email, password_hash, role, status, student_id)
     VALUES ($1, $2, $3, $4, $5, 'active', $6)
     RETURNING id, full_name, username, email, role, status, student_id, created_at`,
    [
      full_name.trim(),
      cleanUsername,
      cleanEmail,
      passwordHash,
      cleanRole,
      studentRecord ? studentRecord.id : null,
    ]
  );

  const newUser = userInsertRes.rows[0];

  // If student, link user_id back to student record
  if (studentRecord) {
    await query(`UPDATE students SET user_id = $1 WHERE id = $2`, [newUser.id, studentRecord.id]);
  }

  // Regenerate session ID & log user in
  req.session.regenerate((err) => {
    if (err) return next(err);

    req.session.user = {
      id: newUser.id,
      fullName: newUser.full_name,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      studentId: studentRecord ? studentRecord.id : null,
      matricNumber: studentRecord ? studentRecord.matric_number : null,
      academicLevel: studentRecord ? studentRecord.academic_level : null,
      barcodeValue: studentRecord ? studentRecord.barcode_value : null,
    };

    req.session.save(async (saveErr) => {
      if (saveErr) return next(saveErr);

      await logAudit(req, {
        action: 'USER_REGISTER',
        entityType: 'USER',
        entityId: newUser.id,
        metadata: { username: newUser.username, role: newUser.role },
      });

      res.status(201).json({
        success: true,
        message: 'Account created successfully! Welcome to the portal.',
        user: req.session.user,
      });
    });
  });
}

export async function login(req, res, next) {
  const { username, password } = req.body;

  if (!username || !password) {
    return next(new AppError('Please provide both username/email/matric number and password.', 400));
  }

  const queryTerm = username.trim();

  const result = await query(
    `SELECT u.id, u.full_name, u.username, u.email, u.password_hash, u.role, u.status, u.student_id,
            u.photo_url, u.phone, u.title, u.office_location,
            s.id AS linked_student_id, s.matric_number, s.academic_level, s.barcode_value,
            s.photo_url AS student_photo_url, s.phone AS student_phone
     FROM users u
     LEFT JOIN students s ON (s.user_id = u.id OR u.student_id = s.id OR LOWER(s.email) = LOWER(u.email))
     WHERE (
       LOWER(u.username) = LOWER($1)
       OR LOWER(u.email) = LOWER($1)
       OR (s.matric_number IS NOT NULL AND LOWER(s.matric_number) = LOWER($1))
     )
     LIMIT 1`,
    [queryTerm]
  );

  if (result.rowCount === 0) {
    return next(new AppError('Invalid credentials. User not found.', 401));
  }

  const user = result.rows[0];

  if (user.status !== 'active') {
    return next(new AppError('Your account is deactivated. Please contact the HOD.', 403));
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return next(new AppError('Invalid credentials. Password incorrect.', 401));
  }

  // Regenerate session ID to prevent session fixation attacks
  req.session.regenerate((err) => {
    if (err) return next(err);

    req.session.user = {
      id: user.id,
      fullName: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role,
      photoUrl: user.photo_url || user.student_photo_url || null,
      phone: user.phone || user.student_phone || null,
      title: user.title || null,
      officeLocation: user.office_location || null,
      studentId: user.student_id || user.linked_student_id || null,
      matricNumber: user.matric_number || null,
      academicLevel: user.academic_level || null,
      barcodeValue: user.barcode_value || null,
    };

    req.session.save(async (saveErr) => {
      if (saveErr) return next(saveErr);

      await logAudit(req, {
        action: 'USER_LOGIN',
        entityType: 'USER',
        entityId: user.id,
        metadata: { username: user.username, role: user.role },
      });

      res.json({
        success: true,
        message: 'Login successful',
        user: req.session.user,
      });
    });
  });
}

export async function logout(req, res, next) {
  if (req.session?.user) {
    await logAudit(req, {
      action: 'USER_LOGOUT',
      entityType: 'USER',
      entityId: req.session.user.id,
      metadata: { username: req.session.user.username },
    });
  }

  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
}

export async function getMe(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const currentUser = req.session.user;

  // Refresh user fields from db
  const userRes = await query(
    `SELECT u.id, u.full_name, u.username, u.email, u.role, u.photo_url, u.phone, u.title, u.office_location
     FROM users u WHERE u.id = $1`,
    [currentUser.id]
  );

  if (userRes.rowCount > 0) {
    const u = userRes.rows[0];
    currentUser.fullName = u.full_name || currentUser.fullName;
    currentUser.photoUrl = u.photo_url || currentUser.photoUrl;
    currentUser.phone = u.phone || currentUser.phone;
    currentUser.title = u.title || currentUser.title;
    currentUser.officeLocation = u.office_location || currentUser.officeLocation;
  }

  // Refresh student data if student
  if (currentUser.role === 'student') {
    const studentRes = await query(
      `SELECT s.id, s.matric_number, s.academic_level, s.barcode_value, s.full_name, s.email, s.phone, s.photo_url
       FROM students s
       WHERE s.user_id = $1 OR s.id = $2 OR LOWER(s.email) = LOWER($3)
       LIMIT 1`,
      [currentUser.id, currentUser.studentId || -1, currentUser.email]
    );

    if (studentRes.rowCount > 0) {
      const s = studentRes.rows[0];
      currentUser.studentId = s.id;
      currentUser.matricNumber = s.matric_number;
      currentUser.academicLevel = s.academic_level;
      currentUser.barcodeValue = s.barcode_value;
      currentUser.fullName = s.full_name || currentUser.fullName;
      currentUser.photoUrl = s.photo_url || currentUser.photoUrl;
      currentUser.phone = s.phone || currentUser.phone;
    }
  }

  res.json({
    success: true,
    user: currentUser,
  });
}

/**
 * Get complete profile of authenticated user
 */
export async function getProfile(req, res, next) {
  const userId = req.session.user.id;

  const userRes = await query(
    `SELECT u.id, u.full_name, u.username, u.email, u.role, u.photo_url, u.phone, u.title, u.office_location, u.created_at,
            s.id AS student_id, s.matric_number, s.academic_level, s.barcode_value, s.admission_year,
            s.photo_url AS student_photo_url, s.phone AS student_phone
     FROM users u
     LEFT JOIN students s ON (s.user_id = u.id OR u.student_id = s.id OR LOWER(s.email) = LOWER(u.email))
     WHERE u.id = $1`,
    [userId]
  );

  if (userRes.rowCount === 0) {
    return next(new AppError('User not found.', 404));
  }

  const u = userRes.rows[0];
  const profile = {
    id: u.id,
    fullName: u.full_name,
    username: u.username,
    email: u.email,
    role: u.role,
    photoUrl: u.photo_url || u.student_photo_url || null,
    phone: u.phone || u.student_phone || '',
    title: u.title || '',
    officeLocation: u.office_location || '',
    createdAt: u.created_at,
    isStudent: u.role === 'student',
    student: u.role === 'student' ? {
      id: u.student_id,
      matricNumber: u.matric_number,
      academicLevel: u.academic_level,
      barcodeValue: u.barcode_value,
      admissionYear: u.admission_year,
      photoUrl: u.student_photo_url || u.photo_url || null,
      phone: u.student_phone || u.phone || '',
    } : null,
  };

  res.json({
    success: true,
    data: profile,
  });
}

/**
 * Update authenticated user's profile and/or passport photograph
 */
export async function updateProfile(req, res, next) {
  const userId = req.session.user.id;
  const role = req.session.user.role;
  const {
    full_name,
    phone,
    title,
    office_location,
    photo_url,
    current_password,
    new_password,
  } = req.body;

  // Retrieve current user
  const userRes = await query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if (userRes.rowCount === 0) {
    return next(new AppError('User not found.', 404));
  }
  const user = userRes.rows[0];

  // If changing password, verify current password
  let newPasswordHash = null;
  if (new_password) {
    if (!current_password) {
      return next(new AppError('Current password is required to set a new password.', 400));
    }
    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return next(new AppError('Current password provided is incorrect.', 400));
    }
    if (new_password.length < 6) {
      return next(new AppError('New password must be at least 6 characters long.', 400));
    }
    newPasswordHash = await bcrypt.hash(new_password, 12);
  }

  // Update user fields
  const updatedFullName = (role !== 'student' && full_name) ? full_name.trim() : user.full_name;
  const updatedPhone = phone !== undefined ? (phone ? phone.trim() : null) : user.phone;
  const updatedPhotoUrl = photo_url !== undefined ? photo_url : user.photo_url;
  const updatedTitle = title !== undefined ? (title ? title.trim() : null) : user.title;
  const updatedOffice = office_location !== undefined ? (office_location ? office_location.trim() : null) : user.office_location;
  const finalPasswordHash = newPasswordHash || user.password_hash;

  await query(
    `UPDATE users
     SET full_name = $1, phone = $2, photo_url = $3, title = $4, office_location = $5,
         password_hash = $6, updated_at = NOW()
     WHERE id = $7`,
    [updatedFullName, updatedPhone, updatedPhotoUrl, updatedTitle, updatedOffice, finalPasswordHash, userId]
  );

  // If student, synchronize photo and phone to students table as well
  if (role === 'student') {
    await query(
      `UPDATE students
       SET photo_url = $1, phone = $2, updated_at = NOW()
       WHERE user_id = $3 OR LOWER(email) = LOWER($4)`,
      [updatedPhotoUrl, updatedPhone, userId, user.email]
    );
  }

  // Update session
  req.session.user.fullName = updatedFullName;
  req.session.user.phone = updatedPhone;
  req.session.user.photoUrl = updatedPhotoUrl;
  req.session.user.title = updatedTitle;
  req.session.user.officeLocation = updatedOffice;

  await logAudit(req, {
    action: 'PROFILE_UPDATED',
    entityType: 'USER',
    entityId: userId,
    metadata: { role, photoUpdated: photo_url !== undefined, passwordChanged: !!new_password },
  });

  res.json({
    success: true,
    message: 'Profile updated successfully!',
    user: req.session.user,
  });
}
