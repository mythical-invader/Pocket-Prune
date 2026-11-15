// jobRoutes.js — /api/jobs addresses; all need a user. SRS: REQ-6 – REQ-10. Owner: Huzaifah.
import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { preflight } from '../controllers/jobController.js';

const router = Router();

router.use(protect);
router.post('/preflight', preflight);

export default router;
