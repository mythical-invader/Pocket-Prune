// catalogRoutes.js — /api/catalog addresses. SRS: REQ-1. Owner: Huzaifah.
import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { listCatalog, getCatalogModel } from '../controllers/catalogController.js';

const router = Router();

router.get('/', protect, listCatalog);
router.get('/:id', protect, getCatalogModel);

export default router;
