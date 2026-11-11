// systemRoutes.js — /api/system/... addresses. SRS: Section 3. Owner: Huzaifah.
import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getHealth, getHostProfileHandler } from '../controllers/systemController.js';

const router = Router();

router.get('/health', getHealth); // public
router.get('/host-profile', protect, getHostProfileHandler);

export default router;
