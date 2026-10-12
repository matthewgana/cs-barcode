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

// Authorized correction of attendance records
router.post('/correct', requireRole('hod', 'lecturer', 'secretary'), catchAsync(correctAttendanceRecord));

export default router;
