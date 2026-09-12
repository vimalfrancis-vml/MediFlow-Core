import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  updateDepartmentHod,
  setDepartmentStatus,
} from '../controllers/department.controller';

const router = Router();

// Only ADMIN can access department management routes
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

router.get('/', getDepartments);
router.post('/', createDepartment);
router.get('/:id', getDepartmentById);
router.put('/:id', updateDepartment);
router.put('/:id/hod', updateDepartmentHod);
router.patch('/:id/status', setDepartmentStatus);

export default router;
