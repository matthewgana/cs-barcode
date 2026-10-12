import { Router } from 'express';
import {
  getLecturerAssignments, createLecturerAssignment, revokeLecturerAssignment,
} from '../controllers/lecturer-assignments.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

router.get('/', requireRole('hod', 'secretary', 'lecturer'), catchAsync(getLecturerAssignments));
router.post('/', requireRole('hod'), catchAsync(createLecturerAssignment));
router.delete('/:id', requireRole('hod'), catchAsync(revokeLecturerAssignment));

export default router;
