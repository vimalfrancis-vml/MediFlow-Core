import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  getTemplates,
  getTemplateById,
  createTemplate,
  createNewVersion,
  archiveTemplate,
  activateTemplate,
} from '../controllers/workflow.controller';

const router = Router();

router.use(requireAuth);

// All authenticated users can inspect workflow templates; creating/editing/archiving requires ADMIN
router.get('/', getTemplates);
router.get('/:id', getTemplateById);

router.post('/', requireRole(['ADMIN']), createTemplate);
router.post('/:id/version', requireRole(['ADMIN']), createNewVersion);
router.post('/:id/activate', requireRole(['ADMIN']), activateTemplate);
router.delete('/:id', requireRole(['ADMIN']), archiveTemplate);

export default router;
