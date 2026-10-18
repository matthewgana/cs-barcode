import { Router } from 'express';
import { login, logout, getMe, register, getProfile, updateProfile } from '../controllers/auth.controller.js';
import { loginLimiter } from '../middleware/rate-limiter.js';
import { requireAuth } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.post('/login', loginLimiter, catchAsync(login));
router.post('/register', loginLimiter, catchAsync(register));
router.post('/logout', requireAuth, catchAsync(logout));
router.get('/me', catchAsync(getMe));

// Profile management
router.get('/profile', requireAuth, catchAsync(getProfile));
router.patch('/profile', requireAuth, catchAsync(updateProfile));

export default router;
