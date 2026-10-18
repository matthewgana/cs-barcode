import { Router } from 'express';
import { getAttendanceReport, exportReportCSV } from '../controllers/reports.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireRole('hod', 'lecturer', 'secretary'), catchAsync(getAttendanceReport));
router.get('/export/csv', requireRole('hod', 'lecturer', 'secretary'), catchAsync(exportReportCSV));

export default router;
