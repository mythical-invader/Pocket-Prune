// ResultsPage.jsx — step 5 "Results": what the job produced, compared with the F16 baseline.
// Shows the recommendation (when the recommender has run), the comparison table with the change
// vs F16 for every measured number, and the settings the results belong to (llama.cpp version,
// device, demo mode). Charts and downloads arrive in WP-17, the recommendation card in WP-19.
// SRS: REQ-17, REQ-20, REQ-28. Owner: Huzaifah (WP-15).
import { Link, useParams } from 'react-router-dom';
import { Activity, FlaskConical, Info, SearchX, Sparkles, Zap } from 'lucide-react';
import { getResults } from '../services/api.js';
import { useLoad } from '../utils/useLoad.js';
import { formatDate } from '../utils/format.js';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import MetricsTable from '../components/MetricsTable.jsx';
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
          Green means better than F16 (smaller, faster, less memory, lower perplexity), red means
          worse. &ldquo;est.&rdquo; is the size the site predicted before the job.
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

      <Card>
        <h2 className="section-title">How these were measured</h2>
        <dl className="meta">
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

// useLoad wants the SAME function on every render (otherwise it reloads forever), so keep one
// small function per job id.
const fetchers = new Map();
function fetchResultsFor(id) {
  if (!fetchers.has(id)) fetchers.set(id, () => getResults(id));
  return fetchers.get(id);
}
