// reporter.test.js — the database reporter updates the Job (status, stage text, progress,
// heartbeat) and saves JobEvents. Uses the in-memory MongoDB. Owner: Sibghatullah (WP-06).
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import JobEvent from '../models/JobEvent.js';
import { dbReporter, STAGE_PROGRESS } from '../worker/reporter.js';
import { clearTestDb, startTestDb, stopTestDb } from './helpers/testDb.js';

beforeAll(startTestDb);
afterEach(clearTestDb);
afterAll(stopTestDb);

const newJob = () =>
  Job.create({
    user: new mongoose.Types.ObjectId(),
    model: new mongoose.Types.ObjectId(),
    profile: new mongoose.Types.ObjectId(),
    quantLevels: ['Q4_K_M'],
  });

describe('dbReporter', () => {
  it('stage() updates status, stage text, progress and heartbeat, and logs an event', async () => {
    const job = await newJob();
    await dbReporter(job).stage('CONVERTING', 'Converting to an F16 GGUF file');

    const saved = await Job.findById(job._id);
    expect(saved.status).toBe('CONVERTING');
    expect(saved.stage).toBe('Converting to an F16 GGUF file');
    expect(saved.progressPct).toBe(STAGE_PROGRESS.CONVERTING);
    expect(saved.heartbeatAt).toBeInstanceOf(Date);

    const events = await JobEvent.find({ job: job._id });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ stage: 'CONVERTING', level: 'info' });
  });

  it('log() saves a line under the current stage with its level', async () => {
    const job = await newJob();
    const report = dbReporter(job);
    await report.stage('QUANTIZING', 'Quantizing to Q4_K_M');
    await report.log('Q4_K_M failed', 'error');

    const last = await JobEvent.findOne({ job: job._id }).sort({ _id: -1 });
    expect(last).toMatchObject({ stage: 'QUANTIZING', level: 'error', message: 'Q4_K_M failed' });
  });
});
