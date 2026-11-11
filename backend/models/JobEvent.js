// JobEvent.js — one log line of a job ("Quantizing to Q4_K_M…", tool output, errors).
// The Job Progress page shows the latest ones. SRS: REQ-14, REQ-26. Owner: Huzaifah.
import mongoose from 'mongoose';

const jobEventSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    stage: { type: String, required: true },
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model('JobEvent', jobEventSchema);
