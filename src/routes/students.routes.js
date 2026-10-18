import { Router } from 'express';
import {
  getStudents, getStudentById, createStudent, updateStudent,
  regenerateBarcode, getStudentBarcodeImage,
} from '../controllers/students.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { catchAsync } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

router.get('/', requireRole('hod', 'secretary', 'lecturer'), catchAsync(getStudents));
router.get('/:id', catchAsync(getStudentById));
router.get('/:id/barcode', catchAsync(getStudentBarcodeImage));
router.post('/', requireRole('hod', 'secretary'), catchAsync(createStudent));
router.patch('/:id', requireRole('hod', 'secretary'), catchAsync(updateStudent));
router.post('/:id/regenerate-barcode', requireRole('hod', 'secretary'), catchAsync(regenerateBarcode));

export default router;
