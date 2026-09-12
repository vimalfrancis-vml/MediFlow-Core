import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  setUserStatus,
  assignRole,
  assignDepartment,
} from '../controllers/user.controller';

const router = Router();

// Only ADMIN can access user management routes
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

router.get('/', getUsers);
router.post('/', createUser);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.patch('/:id/status', setUserStatus);
router.patch('/:id/role', assignRole);
router.patch('/:id/department', assignDepartment);

export default router;
