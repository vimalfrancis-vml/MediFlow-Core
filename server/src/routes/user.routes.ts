import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { getUsers, getUserById } from '../controllers/user.controller';

const router = Router();

// Only ADMIN can access user management routes
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

router.get('/', getUsers);
router.get('/:id', getUserById);

export default router;
