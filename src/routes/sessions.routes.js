import { Router } from 'express';
import {
  getSessions, getSessionById, createSession,
  openSession, closeSession, finalizeSession,
} from '../controllers/sessions.controller.js';
import { requireAuth, requireRole, requireSessionLecturerOrHod } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

router.get('/', catchAsync(getSessions));
router.get('/:id', catchAsync(getSessionById));
router.post('/', requireRole('hod', 'lecturer'), catchAsync(createSession));
router.patch('/:id/open', requireSessionLecturerOrHod, catchAsync(openSession));
router.patch('/:id/close', requireSessionLecturerOrHod, catchAsync(closeSession));
router.patch('/:id/finalize', requireSessionLecturerOrHod, catchAsync(finalizeSession));

export default router;
