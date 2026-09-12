import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { getTerminologies, getTerminologyByKey, updateTerminology } from '../controllers/terminology.controller';

const router = Router();

// Viewing terminology can be done by any authenticated user; modifying requires ADMIN
router.use(requireAuth);

router.get('/', getTerminologies);
router.get('/:key', getTerminologyByKey);
router.put('/:key', requireRole(['ADMIN']), updateTerminology);

export default router;
