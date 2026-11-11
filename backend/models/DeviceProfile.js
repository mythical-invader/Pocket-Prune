// DeviceProfile.js — the device a user wants to run the model on (RAM, disk, threads,
// what matters most). The recommender picks the best file for this profile.
// SRS: REQ-4. Owner: Huzaifah.
import mongoose from 'mongoose';

export const PREFERENCES = ['quality', 'speed', 'smallest', 'balanced'];

const deviceProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    ramMb: { type: Number, required: true, min: 256 },
    freeDiskMb: { type: Number, required: true, min: 0 },
    cpuThreads: { type: Number, required: true, min: 1 },
    preference: { type: String, enum: PREFERENCES, default: 'balanced' },
  },
  { timestamps: true }
);

export default mongoose.model('DeviceProfile', deviceProfileSchema);
