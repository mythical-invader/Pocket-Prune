// settings.js — every setting the backend uses, read once from the root .env.
// Other files import `settings` instead of reading process.env themselves, so all names and
// default values live in one place. SRS: Section 3, REQ-21. Owner: Huzaifah.
import path from 'node:path';
import dotenv from 'dotenv';

// The repo root (one level above backend/). The single .env file lives there.
export const ROOT_DIR = path.join(import.meta.dirname, '..', '..');
dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

const env = process.env;
const number = (value, fallback) =>
  value === undefined || value === '' ? fallback : Number(value);

export const settings = {
  port: number(env.PORT, 8000),
  nodeEnv: env.NODE_ENV || 'development',
  mongoUri: env.MONGO_URI || 'mongodb://127.0.0.1:27017/pocketprune',

  jwtSecret: env.JWT_SECRET || 'dev-only-secret',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  // Until login exists (WP-21) every request acts as this seeded demo user.
  demoUserEmail: env.DEMO_USER_EMAIL || 'demo@pocketprune.local',

  llamaCppDir: env.LLAMA_CPP_DIR || '',
  llamaCppRef: env.LLAMA_CPP_REF || 'unknown',
  hfToken: env.HF_TOKEN || '',

  dataDir: path.resolve(ROOT_DIR, env.DATA_DIR || 'data'),
  demoMode: env.DEMO_MODE === 'true',
  fakePipeline: env.FAKE_PIPELINE === 'true', // ⏳ temporary, removed in WP-20

  maxActiveJobsPerUser: number(env.MAX_ACTIVE_JOBS_PER_USER, 2),
  userStorageLimitMb: number(env.USER_STORAGE_LIMIT_MB, 3072),
  artifactExpiryDays: number(env.ARTIFACT_EXPIRY_DAYS, 7),
  maxParamsBillion: number(env.MAX_PARAMS_BILLION, 4),
  diskReserveMb: number(env.DISK_RESERVE_MB, 2048),

  // Stage time limits in minutes.
  timeoutsMin: {
    download: number(env.TIMEOUT_DOWNLOAD_MIN, 60),
    convert: number(env.TIMEOUT_CONVERT_MIN, 30),
    quantize: number(env.TIMEOUT_QUANTIZE_MIN, 20),
    smoke: number(env.TIMEOUT_SMOKE_MIN, 2),
    bench: number(env.TIMEOUT_BENCH_MIN, 15),
    perplexity: number(env.TIMEOUT_PERPLEXITY_MIN, 30),
  },
};
