import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { getAuditLogs } from '../controllers/audit.controller';

const router = Router();

// Strictly ADMIN protected
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

router.get('/', getAuditLogs);

export default router;
