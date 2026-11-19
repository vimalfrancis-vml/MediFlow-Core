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
  resetPassword,
  getMyProfile,
  updateMyProfile,
} from '../controllers/user.controller';

const router = Router();

// Self-service profile routes (accessible to any authenticated user)
router.get('/profile/me', requireAuth, getMyProfile);
router.patch('/profile/me', requireAuth, updateMyProfile);

// Administrator-only user management routes
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

router.get('/', getUsers);
router.post('/', createUser);
router.post('/:id/reset-password', resetPassword);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.patch('/:id/status', setUserStatus);
router.patch('/:id/role', assignRole);
router.patch('/:id/department', assignDepartment);

export default router;
