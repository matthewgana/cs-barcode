import { Router } from 'express';
import { getAttendanceReport, exportReportCSV } from '../controllers/reports.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);
router.get('/', catchAsync(getAttendanceReport));
router.get('/export/csv', catchAsync(exportReportCSV));

export default router;
