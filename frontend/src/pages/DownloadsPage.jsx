// DownloadsPage.jsx — every GGUF file from the user's finished jobs, grouped by job, newest first:
// level, size, full SHA-256 (to check the download), expiry, and a Download button — or the reason
// there is none (F16 deleted after evaluation, or the file is on the model machine).
// SRS: REQ-30. Owner: Huzaifah (WP-17).
import { Link } from 'react-router-dom';
import { BarChart3, Download, FlaskConical, PackageOpen } from 'lucide-react';
import { artifactDownloadUrl, getArtifacts } from '../services/api.js';
import { useLoad } from '../utils/useLoad.js';
import { formatDate, formatMb } from '../utils/format.js';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Loader from '../components/Loader.jsx';

// [{ jobId, model, level, … }] → [{ jobId, model, finishedAt, fake, files: [...] }]
function groupByJob(files) {
  const jobs = new Map();
  for (const f of files) {
    if (!jobs.has(f.jobId)) {
      jobs.set(f.jobId, {
        jobId: f.jobId,
        model: f.model,
        license: f.license,
        finishedAt: f.finishedAt,
        fake: f.fake,
        files: [],
      });
    }
    jobs.get(f.jobId).files.push(f);
  }
  return [...jobs.values()];
}

export default function DownloadsPage() {
  const { data, error, reload } = useLoad(getArtifacts);

  return (
    <div className="stack">
      <PageHeader
        title="Downloads"
        description="Compressed GGUF files from your finished jobs. Check the SHA-256 after downloading to be sure a file arrived intact."
      />

      <ErrorAlert error={error} onRetry={reload} />
      {!data && !error && <Loader label="Loading your files…" />}
      {data?.length === 0 && (
        <EmptyState
          icon={PackageOpen}
          title="No files yet"
          description="Files appear here when a compression job finishes."
          action={
            <Link to="/catalog">
              <Button variant="secondary">Start with a model</Button>
            </Link>
          }
        />
      )}

      {data &&
        groupByJob(data).map((job) => (
          <Card key={job.jobId}>
            <div className="form-head">
              <div>
                <h2 className="section-title">
                  {job.model}{' '}
                  {job.fake && (
                    <Badge tone="warning" icon={FlaskConical}>
                      FAKE DATA
                    </Badge>
                  )}
                </h2>
                <p className="file-list__meta">
                  Finished {formatDate(job.finishedAt)}
                  {job.license && ` · licence ${job.license}`}
                </p>
              </div>
              <Link to={`/jobs/${job.jobId}/results`}>
                <Button variant="ghost" size="sm" icon={BarChart3}>
                  Results
                </Button>
              </Link>
            </div>
            <ul className="file-list">
              {job.files.map((f) => (
                <li key={f.level} className="file-list__item">
                  <div className="file-list__info">
                    <span className="file-list__level">{f.level}</span>
                    <span className="file-list__meta num">
                      {formatMb(f.fileSizeMb)}
                      {f.expiresAt ? ` · kept until ${formatDate(f.expiresAt)}` : ''}
                    </span>
                    {f.sha256 && <span className="file-list__hash num">SHA-256 {f.sha256}</span>}
                  </div>
                  {f.fileDeleted ? (
                    <span className="file-list__note">Deleted after evaluation · numbers kept</span>
                  ) : f.onThisServer ? (
                    <a
                      className="btn btn--secondary btn--sm"
                      href={artifactDownloadUrl(f.jobId, f.level)}
                      download
                    >
                      <Download size={16} aria-hidden /> Download
                    </a>
                  ) : (
                    <span className="file-list__note">
                      On the model machine · download it there
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
    </div>
  );
}
