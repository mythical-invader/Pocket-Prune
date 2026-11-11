// catalogController.js — the list of models users can compress.
// Users see only active models; inactive ones stay in the database for old jobs.
// SRS: REQ-1, REQ-2. Owner: Huzaifah.
import CatalogModel from '../models/CatalogModel.js';
import { appError } from '../utils/errors.js';

// GET /api/catalog — demo models first, then smallest to largest.
export async function listCatalog(req, res, next) {
  try {
    const models = await CatalogModel.find({ isActive: true }).sort({
      isDemo: -1,
      paramsBillion: 1,
    });
    res.json(models);
  } catch (err) {
    next(err);
  }
}

// GET /api/catalog/:id — one model, or E-CAT-01 if it doesn't exist or is switched off.
export async function getCatalogModel(req, res, next) {
  try {
    const model = await CatalogModel.findOne({ _id: req.params.id, isActive: true });
    if (!model) throw appError('E-CAT-01');
    res.json(model);
  } catch (err) {
    // An id that isn't even a valid ObjectId also means "not in the catalog".
    next(err.name === 'CastError' ? appError('E-CAT-01') : err);
  }
}
