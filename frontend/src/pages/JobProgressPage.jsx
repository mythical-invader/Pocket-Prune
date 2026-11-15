// JobProgressPage.jsx — step 4 "Run": live progress of one job. It asks the API every 2 s
// (polling) while the job is waiting or running, and stops when it is finished. Shows the
// stage stepper, progress bar, elapsed time, queue position, the latest log lines, the error
// (code, message, how to fix) and a "FAKE DATA" badge for jobs made by the fake pipeline.
// SRS: REQ-26. Owner: Huzaifah (WP-12).
import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BarChart3, CheckCircle2, Clock, FlaskConical, SearchX } from 'lucide-react';
import { getJob } from '../services/api.js';
import { usePolling } from '../utils/usePolling.js';
import { formatDuration, formatMb, formatTime } from '../utils/format.js';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import StageStepper from '../components/StageStepper.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Loader from '../components/Loader.jsx';
import Button from '../components/Button.jsx';

const POLL_MS = 2000;
const FINISHED = ['COMPLETED', 'FAILED', 'CANCELLED'];

// The stages a job goes through, in order (same names as the worker uses).
const STAGES = [
  { key: 'QUEUED', label: 'Queued' },
  { key: 'DOWNLOADING', label: 'Download' },
  { key: 'CONVERTING', label: 'Convert' },
  { key: 'QUANTIZING', label: 'Quantize' },
  { key: 'VALIDATING', label: 'Smoke test' },
  { key: 'BENCHMARKING', label: 'Benchmark' },
  { key: 'EVALUATING', label: 'Evaluate' },
  { key: 'RECOMMENDING', label: 'Recommend' },
  { key: 'COMPLETED', label: 'Done' },
];
const stageIndex = (key) => STAGES.findIndex((s) => s.key === key);

// How far the job got: the furthest stage seen in its status or its log. A stage the pipeline
// never ran (e.g. Benchmark before WP-14) stays grey instead of getting a false tick.
function furthestStage(job) {
  const seen = [job.status, ...job.events.map((e) => e.stage)]
    .map(stageIndex)
    .filter((i) => i >= 0 && i < stageIndex('COMPLETED'));
  if (job.variants?.length) seen.push(stageIndex('VALIDATING')); // files exist → smoke test ran
  return Math.max(0, ...seen);
}

function stepperSteps(job) {
  const reached = furthestStage(job);
  return STAGES.map((stage, i) => {
    if (stage.key === 'COMPLETED') return { ...stage, done: job.status === 'COMPLETED' };
    if (FINISHED.includes(job.status) && job.status !== 'COMPLETED' && i === reached)
      return { ...stage, failed: true }; // where a failed / cancelled job stopped
    return { ...stage, done: i < reached || (job.status === 'COMPLETED' && i === reached) };
  });
}

export default function JobProgressPage() {
  const { id } = useParams();
  const logBox = useRef(null);

  // Ask every 2 s; stop for good once the job is finished.
  const {
    data: job,
    fetchedAt, // when the latest answer arrived; "now" for the elapsed-time display
    error,
    refresh,
  } = usePolling(
    () => getJob(id),
    POLL_MS,
    (j) => FINISHED.includes(j.status)
  );
  const finished = job && FINISHED.includes(job.status);

  // Scroll the log panel to the newest line when new lines arrive.
  const lineCount = job?.events.length ?? 0;
  useEffect(() => {
    // Only the log box scrolls (not the whole page), so reading the top of the page isn't interrupted.
    if (logBox.current) logBox.current.scrollTop = logBox.current.scrollHeight;
  }, [lineCount]);

  if (error && !job) {
    return error.code === 'E-NOTFOUND-01' ? (
      <EmptyState
        icon={SearchX}
        title="Job not found"
        description="It may belong to another user, or the link is wrong."
        action={
          <Link to="/catalog">
            <Button>Go to the catalog</Button>
          </Link>
        }
      />
    ) : (
      <ErrorAlert error={error} onRetry={refresh} />
    );
  }
  if (!job) return <Loader label="Loading the job…" />;

  const isFake = job.fake || /\(FAKE\)/.test(job.stage);
  // Times in ms. While running, "now" is when the latest update arrived (every 2 s).
  const started = job.startedAt ? Date.parse(job.startedAt) : null;
  const ended = job.finishedAt ? Date.parse(job.finishedAt) : fetchedAt;
  const elapsedSec = started ? (ended - started) / 1000 : null;
  const waitingSec = (fetchedAt - Date.parse(job.createdAt)) / 1000;
  const stepper = stepperSteps(job);
  const currentIndex = finished ? -1 : stageIndex(job.status);

  return (
    <div className="stack">
      <PageHeader
        title={`Compressing ${job.model?.displayName ?? 'model'}`}
        description={`${job.quantLevels.join(', ')} · device ${job.profile?.name ?? '—'} · job ${job._id}`}
        actions={
          <span className="badge-row">
            {isFake && (
              <Badge tone="warning" icon={FlaskConical}>
                FAKE DATA
              </Badge>
            )}
            <StatusBadge status={job.status} />
          </span>
        }
      />

      {isFake && (
        <p className="fake-note">
          This job was made by the <strong>fake pipeline</strong> (no llama.cpp): the steps and
          numbers are realistic examples, not a real result.
        </p>
      )}

      <Card className="progress-card">
        <StageStepper steps={stepper} currentIndex={currentIndex} label="Job stages" />
        <div className="progress-card__row">
          <ProgressBar value={job.progressPct} label="Job progress" />
        </div>
        <dl className="meta">
          <div>
            <dt>Now</dt>
            <dd>{job.stage}</dd>
          </div>
          <div>
            <dt>Elapsed</dt>
            <dd className="num">{formatDuration(elapsedSec)}</dd>
          </div>
          {job.queuePosition && (
            <div>
              <dt>Queue position</dt>
              <dd className="num">{job.queuePosition}</dd>
            </div>
          )}
          {!finished && (
            <div>
              <dt>Updates</dt>
              <dd>every 2 s</dd>
            </div>
          )}
        </dl>

        {job.status === 'QUEUED' && (
          <div className="alert alert--info">
            <Clock size={20} className="alert__icon" aria-hidden />
            <div className="alert__body">
              <p className="alert__title">Waiting for the worker</p>
              <p className="alert__hint">
                The worker on the model machine picks up queued jobs one at a time.
                {waitingSec > 30 &&
                  ' If this takes long, check that it is running: npm run dev:worker.'}
              </p>
            </div>
          </div>
        )}

        {job.status === 'FAILED' && (
          <ErrorAlert
            error={{ code: job.errorCode, message: job.errorMessage, hint: job.errorHint }}
          />
        )}

        {job.status === 'CANCELLED' && (
          <p className="fake-note">This job was cancelled. Files made so far were removed.</p>
        )}
      </Card>

      {job.status === 'COMPLETED' && (
        <Card>
          <div className="form-head">
            <h2 className="section-title">Files made</h2>
            <Link to={`/jobs/${job._id}/results`}>
              <Button icon={BarChart3}>See results</Button>
            </Link>
          </div>
          <p className="section-intro">
            The Results page compares every file with F16: size, speed, memory and quality.
          </p>
          <table className="files-table">
            <thead>
              <tr>
                <th scope="col">Level</th>
                <th scope="col">Size</th>
                <th scope="col">Smoke test</th>
                <th scope="col">SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {job.variants.map((v) => (
                <tr key={v.level}>
                  <th scope="row">{v.level}</th>
                  <td className="num">{formatMb(v.fileSizeMb)}</td>
                  <td>
                    {v.smokePassed ? (
                      <span className="is-ok">
                        <CheckCircle2 size={16} aria-hidden /> Passed
                      </span>
                    ) : (
                      <span className="is-bad">Failed</span>
                    )}
                  </td>
                  <td className="num files-table__hash" title={v.sha256}>
                    {v.sha256?.slice(0, 12)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <h2 className="section-title">Log</h2>
        <p className="section-intro">The latest {job.events.length} lines from the worker.</p>
        <ol className="log" ref={logBox} aria-live="polite">
          {job.events.map((e) => (
            <li key={e._id} className={`log__line log__line--${e.level}`}>
              <span className="log__time num">{formatTime(e.createdAt)}</span>
              <span className="log__stage">{e.stage}</span>
              <span className="log__message">{e.message}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
