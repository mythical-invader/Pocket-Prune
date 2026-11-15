// jobRoutes.js — /api/jobs addresses; all need a user. SRS: REQ-6 – REQ-10, REQ-26, REQ-28.
// Owner: Huzaifah.
import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { preflight, createJob, listJobs, getJob } from '../controllers/jobController.js';
import { getResults } from '../controllers/resultController.js';

const router = Router();

router.use(protect);
router.post('/preflight', preflight); // must stay above '/:id'
router.post('/', createJob);
router.get('/', listJobs);
router.get('/:id', getJob);
router.get('/:id/results', getResults);

export default router;
