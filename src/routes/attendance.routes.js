import { Router } from 'express';
import {
  recordScan, getSessionAttendanceRecords, correctAttendanceRecord,
} from '../controllers/attendance.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

// Scan barcode (check-in / check-out)
router.post('/scan', requireRole('hod', 'lecturer'), catchAsync(recordScan));

// Get all attendance records for a specific session
router.get('/sessions/:id/records', catchAsync(getSessionAttendanceRecords));
router.get('/session/:id', catchAsync(getSessionAttendanceRecords));

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
