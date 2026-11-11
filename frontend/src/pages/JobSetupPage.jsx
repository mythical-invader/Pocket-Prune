// JobSetupPage.jsx — step 3 "Preflight": choose the quantization levels (with expected sizes),
// see the checks that run before any heavy work, accept the licence, and submit.
// The real preflight call arrives in WP-08 and job submission in WP-10; until then the checks
// are listed and the buttons stay disabled with a clear note. SRS: REQ-6 – REQ-9. Owner: Huzaifah.
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Circle, Info, ListChecks, Play } from 'lucide-react';
import { useJobDraft } from '../context/JobDraftContext.jsx';
import { estimateSizeMb, formatMb, LEVEL_HINTS } from '../utils/format.js';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import CompressionLadder from '../components/CompressionLadder.jsx';
import EmptyState from '../components/EmptyState.jsx';
import JobSummary from '../components/JobSummary.jsx';

const LEVELS = ['Q5_K_M', 'Q4_K_M', 'Q8_0'];

// What preflight will check (CLAUDE.md §7.2) — shown so the user knows what happens next.
const CHECKS = [
  'Model is active in the catalog',
  'Enough free disk for the download, F16 and every level',
  'Enough free RAM to convert the model',
  'Model licence accepted',
  'llama.cpp found at the pinned version',
  'Fewer than 2 of your jobs already running',
];

export default function JobSetupPage() {
  const { draft, setLevels } = useJobDraft();
  const [licenceAccepted, setLicenceAccepted] = useState(false);
  const { model, profile, levels } = draft;

  if (!model || !profile) {
    return (
      <EmptyState
        icon={ListChecks}
        title={!model ? 'Choose a model first' : 'Choose a device first'}
        description="Job setup needs a model from the catalog and a device profile."
        action={
          <Link to={!model ? '/catalog' : '/profiles'}>
            <Button>{!model ? 'Go to the catalog' : 'Go to devices'}</Button>
          </Link>
        }
      />
    );
  }

  function toggleLevel(level) {
    setLevels(levels.includes(level) ? levels.filter((l) => l !== level) : [...levels, level]);
  }

  return (
    <div className="workspace">
      <section className="workspace__main">
        <PageHeader
          title="Levels and preflight"
          description={`Choose how strongly to compress ${model.displayName}. An F16 file is always made first as the quality baseline.`}
        />

        <Card>
          <h2 className="section-title">Quantization levels</h2>
          <p className="section-intro">
            Fewer bits per weight make a smaller, faster file with a small loss in quality.
          </p>
          <fieldset className="choice-group" aria-label="Quantization levels">
            {LEVELS.map((level) => (
              <label key={level} className="choice">
                <input
                  type="checkbox"
                  checked={levels.includes(level)}
                  onChange={() => toggleLevel(level)}
                />
                <span className="choice__title">{level}</span>
                <span className="choice__size num">
                  ≈ {formatMb(estimateSizeMb(model.f16SizeMb, level))}
                </span>
                <span className="choice__hint">
                  {LEVEL_HINTS[level]}
                  {level === 'Q8_0' && ' · optional'}
                </span>
              </label>
            ))}
          </fieldset>
          {levels.length === 0 && (
            <p className="field__error" style={{ marginTop: 'var(--space-sm)' }}>
              Choose at least one level.
            </p>
          )}
        </Card>

        {levels.length > 0 && (
          <Card>
            <h2 className="section-title">Expected files</h2>
            <p className="section-intro">
              Estimated from the F16 size; the job measures the real sizes.
            </p>
            <CompressionLadder
              f16SizeMb={model.f16SizeMb}
              levels={['F16', ...LEVELS.filter((l) => levels.includes(l))]}
              showHints
            />
          </Card>
        )}

        <Card>
          <h2 className="section-title">Preflight checks</h2>
          <p className="section-intro">
            Before downloading anything, PocketPrune checks that this job can finish on this
            machine.
          </p>
          <ul className="checklist">
            {CHECKS.map((check) => (
              <li key={check}>
                <Circle size={16} aria-hidden />
                {check}
              </li>
            ))}
          </ul>
          <div className="alert alert--info">
            <Info size={20} className="alert__icon" aria-hidden />
            <div className="alert__body">
              <p className="alert__title">Preflight is not connected yet</p>
              <p className="alert__hint">
                The checks run on the server once the preflight API is added. Your choices are kept
                until then.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={licenceAccepted}
              onChange={(e) => setLicenceAccepted(e.target.checked)}
            />
            <span>
              I accept the <strong>{model.license}</strong> licence of {model.hfRepoId}.
            </span>
          </label>
          <div className="submit-row">
            <Button icon={ListChecks} variant="secondary" disabled>
              Run preflight
            </Button>
            <Button icon={Play} disabled>
              Start compression
            </Button>
          </div>
        </Card>
      </section>

      <aside className="workspace__side">
        <JobSummary
          footer={
            <p className="summary__note">
              Starting a job becomes available after a successful preflight.
            </p>
          }
        />
      </aside>
    </div>
  );
}
