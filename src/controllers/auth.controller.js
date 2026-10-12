import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { logAudit } from '../utils/audit.js';

export async function login(req, res, next) {
  const { username, password } = req.body;

  if (!username || !password) {
    return next(new AppError('Please provide both username and password.', 400));
  }

  const result = await query(
    `SELECT id, full_name, username, email, password_hash, role, status
     FROM users
     WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1))`,
    [username.trim()]
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

export function getMe(req, res) {
  if (!req.session?.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  res.json({
    success: true,
    user: req.session.user,
  });
}
