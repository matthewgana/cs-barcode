import { AppError } from '../utils/errors.js';
import { query } from '../config/db.js';

export function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return next(new AppError('Authentication required. Please log in.', 401));
  }
  next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return next(new AppError('Authentication required. Please log in.', 401));
    }
    const userRole = req.session.user.role;
    if (!allowedRoles.includes(userRole)) {
      return next(new AppError(`Access denied. Role "${userRole}" is not authorized for this action.`, 403));
    }
    next();
  };
}

/**
 * Checks if the user is authorized to manage an attendance session.
 * HOD can manage any session. Lecturers can only manage sessions assigned to them.
 */
export async function requireSessionLecturerOrHod(req, res, next) {
  const user = req.session?.user;
  if (!user) {
    return next(new AppError('Authentication required.', 401));
  }

  if (user.role === 'hod') {
    return next();
  }

  if (user.role !== 'lecturer') {
    return next(new AppError('Only lecturers and HOD can manage attendance sessions.', 403));
  }

  const sessionId = req.params.sessionId || req.params.id || req.body.session_id;
  if (!sessionId) {
    return next(new AppError('Session ID is required for authorization check.', 400));
  }

  try {
    const sessionRes = await query(
      `SELECT lecturer_id FROM attendance_sessions WHERE id = $1`,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      return next(new AppError('Attendance session not found.', 404));
    }

    if (sessionRes.rows[0].lecturer_id !== user.id) {
      return next(new AppError('You are not authorized to manage this course attendance session.', 403));
    }

    next();
  } catch (err) {
    next(err);
  }
}
