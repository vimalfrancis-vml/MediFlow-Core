import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  getDepartmentEmployees,
  createDepartmentEmployee,
  updateDepartmentEmployee,
  checkDeactivationImpact,
  deactivateDepartmentEmployee,
  assignEmployeePosition,
  getEmployeePositionHistory,
  getDepartmentPositions,
  createPosition,
  updatePosition,
  deactivatePosition,
  getAdminDepartmentOverview,
  getAllPositions,
} from '../controllers/department-management.controller';

const router = Router();

router.use(requireAuth);

// Admin-only oversight endpoints
router.get('/admin/overview', requireRole(['ADMIN']), getAdminDepartmentOverview);
router.get('/admin/all-positions', requireRole(['ADMIN']), getAllPositions);

// HOD & Admin Department Management routes
router.use(requireRole(['HOD', 'ADMIN']));

// Employee Management
router.get('/employees', getDepartmentEmployees);
router.post('/employees', createDepartmentEmployee);
router.patch('/employees/:id', updateDepartmentEmployee);
router.get('/employees/:id/deactivation-impact', checkDeactivationImpact);
router.post('/employees/:id/deactivate', deactivateDepartmentEmployee);
router.post('/employees/:id/position', assignEmployeePosition);
router.get('/employees/:id/position-history', getEmployeePositionHistory);

// Position Management
router.get('/positions', getDepartmentPositions);
router.post('/positions', createPosition);
router.put('/positions/:id', updatePosition);
router.delete('/positions/:id', deactivatePosition);

export default router;

