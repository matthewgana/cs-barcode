import { Router } from 'express';
import { getUsers, createUser, updateUser } from '../controllers/users.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

router.get('/', requireRole('hod', 'secretary'), catchAsync(getUsers));
router.post('/', requireRole('hod'), catchAsync(createUser));
router.patch('/:id', requireRole('hod'), catchAsync(updateUser));

export default router;
