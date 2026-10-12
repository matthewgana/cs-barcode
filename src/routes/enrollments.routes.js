import { Router } from 'express';
import {
  getEnrollments, enrollStudent, bulkEnrollByLevel, dropEnrollment,
} from '../controllers/enrollments.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

router.get('/', catchAsync(getEnrollments));
router.post('/', requireRole('hod', 'secretary'), catchAsync(enrollStudent));
router.post('/bulk', requireRole('hod', 'secretary'), catchAsync(bulkEnrollByLevel));
router.delete('/:id', requireRole('hod', 'secretary'), catchAsync(dropEnrollment));

export default router;
