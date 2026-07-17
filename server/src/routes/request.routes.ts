// src/routes/request.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as requestController from '../controllers/request.controller';

const router = Router();

// All request endpoints are versioned via the /api/v1 prefix in app.ts
router.post('/requests', requireAuth, requestController.createRequest);
router.put('/requests/:id', requireAuth, requestController.editRequest);
router.post('/requests/:id/submit', requireAuth, requestController.submitRequest);
router.post('/requests/:id/cancel', requireAuth, requestController.cancelRequest);
router.get('/requests/analytics', requireAuth, requestController.getAnalytics);
router.get('/requests/:id', requireAuth, requestController.getRequestById);
router.get('/requests', requireAuth, requestController.listRequests);

// Comments endpoints
router.post('/requests/:id/comments', requireAuth, requestController.addComment);
router.get('/requests/:id/comments', requireAuth, requestController.getComments);

// Documents endpoints
router.post('/requests/:id/documents', requireAuth, requestController.uploadDocument);
router.get('/requests/:id/documents', requireAuth, requestController.getDocuments);

router.post('/requests/:id/approve', requireAuth, requestController.approve);
router.post('/requests/:id/reject', requireAuth, requestController.reject);
router.post('/requests/:id/return', requireAuth, requestController.returnForCorrection);

export default router;
