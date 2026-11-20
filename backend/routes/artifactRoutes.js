// artifactRoutes.js — /api/artifacts addresses (GGUF downloads); all need a user.
// SRS: REQ-30. Owner: Huzaifah (WP-17).
import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { listArtifacts, downloadArtifact } from '../controllers/artifactController.js';

const router = Router();

router.use(protect);
router.get('/', listArtifacts);
router.get('/:jobId/:level/download', downloadArtifact);

export default router;
