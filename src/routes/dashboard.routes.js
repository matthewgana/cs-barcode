import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);
router.get('/', catchAsync(getDashboardStats));
router.get('/stats', catchAsync(getDashboardStats));

export default router;
