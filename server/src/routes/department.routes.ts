import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { getDepartments, getDepartmentById } from '../controllers/department.controller';

const router = Router();

// Only ADMIN can access department management routes
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

router.get('/', getDepartments);
router.get('/:id', getDepartmentById);

export default router;
