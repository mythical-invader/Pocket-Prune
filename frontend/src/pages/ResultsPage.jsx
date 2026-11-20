// ResultsPage.jsx — step 5 "Results": what the job produced, compared with the F16 baseline.
// Shows the recommendation (when the recommender has run), the comparison table with the change
// vs F16 for every measured number, and the settings the results belong to (llama.cpp version,
// machine, device, demo mode), three bar charts and the files with their downloads (WP-17).
// The full recommendation card arrives in WP-19.
// SRS: REQ-17, REQ-20, REQ-21, REQ-28, REQ-30. Owner: Huzaifah (WP-15, WP-17).
import { Link, useParams } from 'react-router-dom';
import { Activity, Download, FlaskConical, Info, SearchX, Sparkles, Zap } from 'lucide-react';
import { artifactDownloadUrl, getResults } from '../services/api.js';
import { useLoad } from '../utils/useLoad.js';
import { formatDate, formatMb } from '../utils/format.js';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import MetricsTable from '../components/MetricsTable.jsx';
import MetricsChart from '../components/MetricsChart.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Loader from '../components/Loader.jsx';

export default function ResultsPage() {
  const { id } = useParams();
  // useLoad needs a stable function; the id is part of the URL, so build it once per id.
  const { data: results, error, reload } = useLoad(fetchResultsFor(id));

  if (error) {
    return error.code === 'E-NOTFOUND-01' ? (
      <EmptyState
        icon={SearchX}
        title="No results to show"
        description={error.message}
        action={
          <Link to={`/jobs/${id}`}>
            <Button variant="secondary" icon={Activity}>
              Follow the job
            </Button>
          </Link>
        }
      />
    ) : (
      <ErrorAlert error={error} onRetry={reload} />
    );
  }
  if (!results) return <Loader label="Loading the results…" />;

  const notMeasuredYet = results.metrics.filter((m) => !results.measured.includes(m.key));
  const rec = results.recommendation;
  const charts = chartsFor(results.rows);

  return (
    <div className="stack">
      <PageHeader
        title={`Results: ${results.model?.displayName ?? 'model'}`}
        description={`Every file compared with the uncompressed F16 baseline. Device: ${results.profile?.name ?? '—'}.`}
        actions={
          <span className="badge-row">
            {results.fake && (
              <Badge tone="warning" icon={FlaskConical}>
                FAKE DATA
              </Badge>
            )}
            {results.demoMode && (
              <Badge tone="info" icon={Zap}>
                Demo mode
              </Badge>
            )}
          </span>
        }
      />

      {results.fake && (
        <p className="fake-note">
          Made by the <strong>fake pipeline</strong>: the numbers are realistic examples from a
          hand-measured run, not a measurement of this job.
        </p>
      )}

      <Card>
        <div className="rec">
          <Sparkles size={22} className="rec__icon" aria-hidden />
          <div>
            <h2 className="section-title">Recommendation</h2>
            {rec ? (
              <>
                <p className="rec__choice">
                  <strong>{rec.chosenLevel}</strong> for {results.profile?.name ?? 'this device'}
                  {rec.qualityRisk && <Badge tone="warning">Quality risk</Badge>}
                </p>
                <p className="section-intro">{rec.explanation}</p>
                <p className="rec__rule num">Rule: {rec.ruleFired}</p>
              </>
            ) : (
              <p className="section-intro">
                The recommendation is added once the recommender runs on real measurements.
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="section-title">Comparison with F16</h2>
        <p className="section-intro">
          Green means better than F16 (smaller, faster, less memory, lower perplexity, higher
          accuracy), red means worse. &ldquo;±&rdquo; is the range the quality test reports: a gap
          smaller than it may just be noise. &ldquo;est.&rdquo; is the size predicted before the
          job.
        </p>
        <MetricsTable metrics={results.metrics} measured={results.measured} rows={results.rows} />

        {notMeasuredYet.length > 0 && (
          <div className="alert alert--info section-gap">
            <Info size={20} className="alert__icon" aria-hidden />
            <div className="alert__body">
              <p className="alert__title">
                Not measured for this job: {notMeasuredYet.map((m) => m.label).join(', ')}
              </p>
              <p className="alert__hint">
                Speed and memory are measured by the benchmark step and perplexity by the evaluation
                step; jobs run after those steps are added show them here.
              </p>
            </div>
          </div>
        )}
      </Card>

      {charts.length > 0 && (
        <Card>
          <h2 className="section-title">At a glance</h2>
          <p className="section-intro">Grey is the F16 baseline, blue the compressed files.</p>
          <div className="chart-grid">
            {charts.map((c) => (
              <MetricsChart key={c.title} {...c} />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="section-title">Files</h2>
        <p className="section-intro">
          GGUF files you can run with llama.cpp. Check the SHA-256 after downloading to be sure the
          file arrived intact.
        </p>
        <ul className="file-list">
          {results.rows.map((row) => (
            <li key={row.level} className="file-list__item">
              <div className="file-list__info">
                <span className="file-list__level">{row.level}</span>
                <span className="file-list__meta num">{formatMb(row.values.fileSizeMb)}</span>
                {row.sha256 && <span className="file-list__hash num">SHA-256 {row.sha256}</span>}
              </div>
              <FileAction row={row} jobId={results.jobId} />
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="section-title">How these were measured</h2>
        <dl className="meta">
          <div>
            <dt>Machine</dt>
            <dd>
              {results.machine
                ? `${results.machine.cpu}${results.machine.threads ? ` · ${results.machine.threads} threads` : ''}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{results.model?.hfRepoId}</dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd className="num">{results.model?.revision?.slice(0, 7)}</dd>
          </div>
          <div>
            <dt>llama.cpp</dt>
            <dd className="num">{results.llamaCppRef ?? '—'}</dd>
          </div>
          <div>
            <dt>Finished</dt>
            <dd>{results.finishedAt ? formatDate(results.finishedAt) : '—'}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

// The three charts (CLAUDE.md §8): size, generation speed and peak RAM. A chart without any
// measured number is left out (MetricsChart returns nothing).
function chartsFor(rows) {
  const series = (key) => rows.map((r) => ({ level: r.level, value: r.values[key] }));
  return [
    {
      title: 'File size',
      description: 'smaller is better',
      data: series('fileSizeMb'),
      format: formatMb,
    },
    {
      title: 'Generation speed',
      description: 'tokens per second, higher is better',
      data: series('tpsGen'),
      format: (v) => String(Math.round(v)), // the caption says "tokens per second"
    },
    {
      title: 'Peak RAM',
      description: 'smaller is better',
      data: series('peakRamMb'),
      format: formatMb,
    },
  ].filter((c) => c.data.some((d) => d.value !== null && d.value !== undefined));
}

// What can be done with one file: download it, or why not.
function FileAction({ row, jobId }) {
  if (row.fileDeleted) {
    return <span className="file-list__note">Deleted after evaluation · numbers kept</span>;
  }
  if (!row.smokePassed)
    return <span className="file-list__note is-bad">Failed the smoke test</span>;
  if (!row.onThisServer) {
    return <span className="file-list__note">On the model machine · download it there</span>;
  }
  return (
    <a className="btn btn--secondary btn--sm" href={artifactDownloadUrl(jobId, row.level)} download>
      <Download size={16} aria-hidden /> Download
    </a>
  );
}

// useLoad wants the SAME function on every render (otherwise it reloads forever), so keep one
// small function per job id.
const fetchers = new Map();
function fetchResultsFor(id) {
  if (!fetchers.has(id)) fetchers.set(id, () => getResults(id));
  return fetchers.get(id);
}
