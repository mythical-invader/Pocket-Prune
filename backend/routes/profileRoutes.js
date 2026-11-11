// profileRoutes.js — /api/profiles addresses; all need a user. SRS: REQ-4. Owner: Huzaifah.
import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
} from '../controllers/profileController.js';

const router = Router();

router.use(protect); // every route below acts for req.user
router.get('/', listProfiles);
router.post('/', createProfile);
router.get('/:id', getProfile);
router.put('/:id', updateProfile);
router.delete('/:id', deleteProfile);

export default router;
