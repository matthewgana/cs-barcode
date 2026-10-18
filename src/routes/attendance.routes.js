import { Router } from 'express';
import {
  recordScan, getSessionAttendanceRecords, correctAttendanceRecord,
} from '../controllers/attendance.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

// Scan barcode (check-in / check-out) — HOD, Lecturer, and Student (self-mark only, ABAC enforced in controller)
router.post('/scan', requireRole('hod', 'lecturer', 'student'), catchAsync(recordScan));

// Get all attendance records for a specific session
// RBAC: Students are STRICTLY blocked. They see their own status on the scanner page.
// The controller also enforces ABAC (student sees only own record), but defence-in-depth requires route-level block.
router.get('/sessions/:id/records', requireRole('hod', 'lecturer', 'secretary'), catchAsync(getSessionAttendanceRecords));
router.get('/session/:id', requireRole('hod', 'lecturer', 'secretary'), catchAsync(getSessionAttendanceRecords));

// Authorized correction of attendance records
router.post('/correct', requireRole('hod', 'lecturer', 'secretary'), catchAsync(correctAttendanceRecord));
router.put('/record/:id/correct', requireRole('hod', 'lecturer', 'secretary'), catchAsync(async (req, res, next) => {
  req.body.attendance_record_id = req.body.attendance_record_id || req.params.id;
  return correctAttendanceRecord(req, res, next);
}));
router.post('/record/:id/correct', requireRole('hod', 'lecturer', 'secretary'), catchAsync(async (req, res, next) => {
  req.body.attendance_record_id = req.body.attendance_record_id || req.params.id;
  return correctAttendanceRecord(req, res, next);
}));

export default router;
