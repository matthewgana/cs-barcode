import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { logAudit } from '../utils/audit.js';

export async function getUsers(req, res, next) {
  const { role, status } = req.query;
  const conditions = [];
  const params = [];

  if (role) {
    params.push(role);
    conditions.push(`role = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT id, full_name, username, email, role, status, created_at, updated_at
     FROM users
     ${whereClause}
     ORDER BY created_at DESC`,
    params
  );

  res.json({
    success: true,
    count: result.rowCount,
    data: result.rows,
  });
}

export async function createUser(req, res, next) {
  const { full_name, username, email, password, role } = req.body;

  if (!full_name || !username || !email || !password || !role) {
    return next(new AppError('All fields (full_name, username, email, password, role) are required.', 400));
  }

  if (!['hod', 'lecturer', 'secretary'].includes(role)) {
    return next(new AppError('Invalid role specified. Must be hod, lecturer, or secretary.', 400));
  }

  const existing = await query(
    `SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)`,
    [username.trim(), email.trim()]
  );

  if (existing.rowCount > 0) {
    return next(new AppError('A user with this username or email already exists.', 409));
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await query(
    `INSERT INTO users (full_name, username, email, password_hash, role, status)
     VALUES ($1, $2, $3, $4, $5, 'active')
     RETURNING id, full_name, username, email, role, status, created_at`,
    [full_name.trim(), username.trim().toLowerCase(), email.trim().toLowerCase(), passwordHash, role]
  );

  const createdUser = result.rows[0];

  await logAudit(req, {
    action: 'CREATE_USER',
    entityType: 'USER',
    entityId: createdUser.id,
    metadata: { username: createdUser.username, role: createdUser.role },
  });

  res.status(201).json({
    success: true,
    message: 'Staff user created successfully',
    data: createdUser,
  });
}

export async function updateUser(req, res, next) {
  const { id } = req.params;
  const { full_name, email, role, status, password } = req.body;

  const existingRes = await query(`SELECT * FROM users WHERE id = $1`, [id]);
  if (existingRes.rowCount === 0) {
    return next(new AppError('User not found.', 404));
  }
  const oldUser = existingRes.rows[0];

  // Prevent HOD from accidentally locking themselves out
  if (req.session.user.id === Number(id) && status === 'inactive') {
    return next(new AppError('You cannot deactivate your own account.', 400));
  }

  let passwordHash = oldUser.password_hash;
  if (password && password.trim().length > 0) {
    passwordHash = await bcrypt.hash(password.trim(), 10);
  }

  const result = await query(
    `UPDATE users
     SET full_name = COALESCE($1, full_name),
         email = COALESCE($2, email),
         role = COALESCE($3, role),
         status = COALESCE($4, status),
         password_hash = $5,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $6
     RETURNING id, full_name, username, email, role, status, updated_at`,
    [
      full_name ? full_name.trim() : null,
      email ? email.trim().toLowerCase() : null,
      role || null,
      status || null,
      passwordHash,
      id,
    ]
  );

  await logAudit(req, {
    action: 'UPDATE_USER',
    entityType: 'USER',
    entityId: id,
    metadata: { previousRole: oldUser.role, newRole: role, status },
  });

  res.json({
    success: true,
    message: 'User updated successfully',
    data: result.rows[0],
  });
}
