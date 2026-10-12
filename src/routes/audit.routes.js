import { Router } from 'express';
import { getAuditLogs, getAttendanceCorrections } from '../controllers/audit.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);
router.get('/logs', requireRole('hod'), catchAsync(getAuditLogs));
router.get('/corrections', requireRole('hod', 'secretary', 'lecturer'), catchAsync(getAttendanceCorrections));

export default router;
