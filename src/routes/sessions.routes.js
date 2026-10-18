import { Router } from 'express';
import {
  getSessions, getSessionById, createSession,
  openSession, closeSession, finalizeSession,
  getSessionQrCodeImage,
} from '../controllers/sessions.controller.js';
import { requireAuth, requireRole, requireSessionLecturerOrHod } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

// All authenticated users may list sessions (controller applies ABAC per role)
router.get('/', catchAsync(getSessions));

// All authenticated users may get a single session (controller applies ABAC per role)
router.get('/:id', catchAsync(getSessionById));

// RBAC: QR code is for projection by staff. Students must NOT access QR codes directly.
router.get('/:id/qrcode', requireRole('hod', 'lecturer', 'secretary'), catchAsync(getSessionQrCodeImage));

// Session lifecycle — restricted to HOD and assigned lecturer only
router.post('/', requireRole('hod', 'lecturer'), catchAsync(createSession));
router.patch('/:id/open', requireSessionLecturerOrHod, catchAsync(openSession));
router.post('/:id/open', requireSessionLecturerOrHod, catchAsync(openSession));
router.patch('/:id/close', requireSessionLecturerOrHod, catchAsync(closeSession));
router.post('/:id/close', requireSessionLecturerOrHod, catchAsync(closeSession));
router.patch('/:id/finalize', requireSessionLecturerOrHod, catchAsync(finalizeSession));
router.post('/:id/finalize', requireSessionLecturerOrHod, catchAsync(finalizeSession));

export default router;
