import { query } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { logAudit } from '../utils/audit.js';
import { generateBarcodeImage, generateStudentBarcodeValue } from '../utils/barcode.js';

export async function getStudents(req, res, next) {
  const { academic_level, status, search, limit = 100, offset = 0 } = req.query;
  const conditions = [];
  const params = [];

  if (academic_level) {
    params.push(academic_level);
    conditions.push(`academic_level = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(matric_number ILIKE $${params.length} OR full_name ILIKE $${params.length} OR barcode_value ILIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(parseInt(limit, 10));
  const limitIndex = params.length;
  params.push(parseInt(offset, 10));
  const offsetIndex = params.length;

  const countQuery = await query(
    `SELECT COUNT(*) FROM students ${whereClause}`,
    params.slice(0, conditions.length)
  );
  const totalCount = parseInt(countQuery.rows[0].count, 10);

  const result = await query(
    `SELECT id, matric_number, full_name, academic_level, barcode_value, email, phone, photo_url,
            admission_year, status, created_at, updated_at
     FROM students
     ${whereClause}
     ORDER BY academic_level ASC, matric_number ASC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );

  res.json({
    success: true,
    total: totalCount,
    count: result.rowCount,
    data: result.rows,
  });
}

export async function getStudentById(req, res, next) {
  const { id } = req.params;
  const user = req.session.user;

  // ABAC: If caller is a student, they may strictly view only their own record
  if (user.role === 'student' && String(user.studentId) !== String(id)) {
    return next(new AppError('Access denied: You are not authorized to view another student\'s record.', 403));
  }

  const result = await query(
    `SELECT id, matric_number, full_name, academic_level, barcode_value, email, phone, photo_url,
            admission_year, status, created_at, updated_at
     FROM students WHERE id = $1`,
    [id]
  );

  if (result.rowCount === 0) {
    return next(new AppError('Student not found.', 404));
  }

  res.json({ success: true, data: result.rows[0] });
}

export async function createStudent(req, res, next) {
  const { matric_number, full_name, academic_level, barcode_value, email, phone, admission_year, status = 'active' } = req.body;

  if (!matric_number || !full_name || !academic_level) {
    return next(new AppError('matric_number, full_name, and academic_level are required.', 400));
  }

  if (!['100', '200', '300', '400'].includes(String(academic_level))) {
    return next(new AppError('academic_level must be one of: 100, 200, 300, 400.', 400));
  }

  // Check unique matric number
  const existingMatric = await query(`SELECT id FROM students WHERE UPPER(matric_number) = UPPER($1)`, [matric_number.trim()]);
  if (existingMatric.rowCount > 0) {
    return next(new AppError(`Student with matric number "${matric_number}" already exists.`, 409));
  }

  // Generate or sanitize barcode value
  let finalBarcode = barcode_value ? barcode_value.trim() : generateStudentBarcodeValue(academic_level, matric_number);

  // Check unique barcode value
  const existingBarcode = await query(`SELECT id FROM students WHERE barcode_value = $1`, [finalBarcode]);
  if (existingBarcode.rowCount > 0) {
    // If collision, append timestamp hash
    finalBarcode = `CS${academic_level}-${Date.now().toString().slice(-6)}`;
  }

  const result = await query(
    `INSERT INTO students (matric_number, full_name, academic_level, barcode_value, email, phone, admission_year, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      matric_number.trim().toUpperCase(),
      full_name.trim(),
      academic_level,
      finalBarcode,
      email ? email.trim().toLowerCase() : null,
      phone ? phone.trim() : null,
      admission_year ? parseInt(admission_year, 10) : new Date().getFullYear(),
      status,
    ]
  );

  const student = result.rows[0];

  await logAudit(req, {
    action: 'REGISTER_STUDENT',
    entityType: 'STUDENT',
    entityId: student.id,
    metadata: { matric_number: student.matric_number, barcode_value: student.barcode_value, level: student.academic_level },
  });

  res.status(201).json({
    success: true,
    message: 'Student registered successfully',
    data: student,
  });
}

export async function updateStudent(req, res, next) {
  const { id } = req.params;
  const { matric_number, full_name, academic_level, email, phone, photo_url, admission_year, status } = req.body;

  const existingRes = await query(`SELECT * FROM students WHERE id = $1`, [id]);
  if (existingRes.rowCount === 0) {
    return next(new AppError('Student not found.', 404));
  }

  if (academic_level && !['100', '200', '300', '400'].includes(String(academic_level))) {
    return next(new AppError('academic_level must be one of: 100, 200, 300, 400.', 400));
  }

  const result = await query(
    `UPDATE students
     SET matric_number = COALESCE($1, matric_number),
         full_name = COALESCE($2, full_name),
         academic_level = COALESCE($3, academic_level),
         email = COALESCE($4, email),
         phone = COALESCE($5, phone),
         photo_url = COALESCE($6, photo_url),
         admission_year = COALESCE($7, admission_year),
         status = COALESCE($8, status),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $9
     RETURNING *`,
    [
      matric_number ? matric_number.trim().toUpperCase() : null,
      full_name ? full_name.trim() : null,
      academic_level || null,
      email ? email.trim().toLowerCase() : null,
      phone ? phone.trim() : null,
      photo_url !== undefined ? photo_url : null,
      admission_year ? parseInt(admission_year, 10) : null,
      status || null,
      id,
    ]
  );

  await logAudit(req, {
    action: 'UPDATE_STUDENT',
    entityType: 'STUDENT',
    entityId: id,
    metadata: { matric_number: result.rows[0].matric_number, level: result.rows[0].academic_level },
  });

  res.json({
    success: true,
    message: 'Student details updated successfully',
    data: result.rows[0],
  });
}

export async function regenerateBarcode(req, res, next) {
  const { id } = req.params;
  const existingRes = await query(`SELECT * FROM students WHERE id = $1`, [id]);
  if (existingRes.rowCount === 0) {
    return next(new AppError('Student not found.', 404));
  }

  const student = existingRes.rows[0];
  const newBarcode = `CS${student.academic_level}-${Date.now().toString().slice(-6)}`;

  const result = await query(
    `UPDATE students SET barcode_value = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
    [newBarcode, id]
  );

  await logAudit(req, {
    action: 'REGENERATE_STUDENT_BARCODE',
    entityType: 'STUDENT',
    entityId: id,
    metadata: { previousBarcode: student.barcode_value, newBarcode },
  });

  res.json({
    success: true,
    message: 'New Code 128 barcode generated successfully',
    data: result.rows[0],
  });
}

export async function getStudentBarcodeImage(req, res, next) {
  const { id } = req.params;
  const { format = 'svg', type = 'code128' } = req.query;
  const user = req.session.user;

  // ABAC: If caller is a student, they may strictly generate/view only their own barcode
  if (user.role === 'student' && String(user.studentId) !== String(id)) {
    return next(new AppError('Access denied: You are not authorized to view or download another student\'s barcode.', 403));
  }

  const result = await query(`SELECT barcode_value, matric_number, full_name FROM students WHERE id = $1`, [id]);
  if (result.rowCount === 0) {
    return next(new AppError('Student not found.', 404));
  }

  const { barcode_value } = result.rows[0];

  try {
    if (format === 'png') {
      const pngBuffer = await generateBarcodeImage(barcode_value, 'png', type);
      res.setHeader('Content-Type', 'image/png');
      return res.send(pngBuffer);
    } else {
      const svg = await generateBarcodeImage(barcode_value, 'svg', type);
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }
  } catch (err) {
    next(new AppError('Error generating barcode image: ' + err.message, 500));
  }
}
