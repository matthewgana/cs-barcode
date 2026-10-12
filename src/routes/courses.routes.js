import { Router } from 'express';
import {
  getCourses, getCourseById, createCourse, updateCourse,
} from '../controllers/courses.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

router.get('/', catchAsync(getCourses));
router.get('/:id', catchAsync(getCourseById));
router.post('/', requireRole('hod', 'secretary'), catchAsync(createCourse));
router.patch('/:id', requireRole('hod', 'secretary'), catchAsync(updateCourse));

export default router;
