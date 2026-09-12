import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { getRoles, getRoleById, updateRole } from '../controllers/role.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['ADMIN']));

router.get('/', getRoles);
router.get('/:id', getRoleById);
router.put('/:id', updateRole);

export default router;
