import { Router } from 'express';
import {
  getAcademicSessions, createAcademicSession, updateAcademicSession,
  getSemesters, createSemester, updateSemester,
} from '../controllers/academic.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

// Academic Sessions
router.get('/sessions', catchAsync(getAcademicSessions));
router.post('/sessions', requireRole('hod'), catchAsync(createAcademicSession));
router.patch('/sessions/:id', requireRole('hod'), catchAsync(updateAcademicSession));
router.put('/sessions/:id', requireRole('hod'), catchAsync(updateAcademicSession));

// Semesters
router.get('/semesters', catchAsync(getSemesters));
router.post('/semesters', requireRole('hod'), catchAsync(createSemester));
router.patch('/semesters/:id', requireRole('hod'), catchAsync(updateSemester));
router.put('/semesters/:id', requireRole('hod'), catchAsync(updateSemester));

export default router;
