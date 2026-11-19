import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  getOverview,
  getAttentionList,
  getBottlenecks,
  getDailyBriefing,
  getRequestSummary,
  processChatQuery,
} from '../controllers/approval-intelligence.controller';

const router = Router();

// Strictly Admin-only protection across all Approval Intelligence endpoints
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

router.get('/overview', getOverview);
router.get('/attention-list', getAttentionList);
router.get('/bottlenecks', getBottlenecks);
router.get('/daily-briefing', getDailyBriefing);
router.get('/requests/:id/summary', getRequestSummary);
router.post('/chat', processChatQuery);

export default router;
