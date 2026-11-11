// CatalogModel.js — one Hugging Face model that PocketPrune is allowed to compress.
// The revision is a fixed commit hash, so every run downloads exactly the same files.
// SRS: REQ-1, REQ-2, REQ-3, REQ-5. Owner: Huzaifah.
import mongoose from 'mongoose';

const catalogModelSchema = new mongoose.Schema(
  {
    hfRepoId: { type: String, required: true, unique: true, trim: true }, // e.g. "Qwen/Qwen2.5-0.5B-Instruct"
    revision: { type: String, required: true, trim: true }, // pinned commit hash
    displayName: { type: String, required: true, trim: true },
    paramsBillion: { type: Number, required: true, min: 0 },
    license: { type: String, required: true, trim: true },
    gated: { type: Boolean, default: false }, // needs a Hugging Face token
    isActive: { type: Boolean, default: true }, // admins can switch a model off
    isDemo: { type: Boolean, default: false }, // small model for 2–3 minute demo jobs
    f16SizeMb: { type: Number, min: 0 },
    lastValidatedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('CatalogModel', catalogModelSchema);
