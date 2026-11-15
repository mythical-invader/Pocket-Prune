// JobSetupPage.jsx — step 3 "Preflight": choose the quantization levels (with expected sizes),
// accept the licence, and run the preflight checks on the server. Each check shows passed or
// failed with its reason, fix and error code. Starting the job arrives in WP-10.
// SRS: REQ-6 – REQ-10. Owner: Huzaifah.
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { CheckCircle2, Circle, ListChecks, Play, XCircle } from 'lucide-react';
import { useJobDraft } from '../context/JobDraftContext.jsx';
import { runPreflight } from '../services/api.js';
import { estimateSizeMb, formatMb, LEVEL_HINTS } from '../utils/format.js';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import CompressionLadder from '../components/CompressionLadder.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import JobSummary from '../components/JobSummary.jsx';

const LEVELS = ['Q5_K_M', 'Q4_K_M', 'Q8_0'];

// Shown before the first run, so the user knows what will be checked.
const PLANNED_CHECKS = [
  'Model is in the catalog',
  'Quantization levels are supported',
  'Device profile chosen',
  'Enough free disk space',
  'Enough free memory (RAM)',
  'Model licence accepted',
  'Hugging Face access',
  'llama.cpp installed',
  'Fewer than 2 jobs running',
];

export default function JobSetupPage() {
  const { draft, setLevels } = useJobDraft();
  const [licenceAccepted, setLicenceAccepted] = useState(false);
  const [result, setResult] = useState(null); // { passed, checks } from the server
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
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

  // Any change makes the last preflight result out of date.
  function toggleLevel(level) {
    setLevels(levels.includes(level) ? levels.filter((l) => l !== level) : [...levels, level]);
    setResult(null);
  }
  function toggleLicence(e) {
    setLicenceAccepted(e.target.checked);
    setResult(null);
  }

  async function preflight() {
    setRunning(true);
    setError(null);
    try {
      setResult(
        await runPreflight({
          modelId: model._id,
          profileId: profile._id,
          levels,
          licenseAccepted: licenceAccepted,
        })
      );
    } catch (err) {
      setError(err);
    } finally {
      setRunning(false);
    }
  }

  const failedCount = result ? result.checks.filter((c) => !c.passed).length : 0;

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
            <p className="field__error section-gap">Choose at least one level.</p>
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
            Before downloading anything, PocketPrune checks on the server that this job can finish:
            disk, memory, licence, tools and your running jobs.
          </p>

          <label className="checkbox">
            <input type="checkbox" checked={licenceAccepted} onChange={toggleLicence} />
            <span>
              I accept the <strong>{model.license}</strong> licence of {model.hfRepoId}.
            </span>
          </label>

          <div className="submit-row">
            <Button icon={ListChecks} variant="secondary" loading={running} onClick={preflight}>
              {result ? 'Run preflight again' : 'Run preflight'}
            </Button>
            {result && (
              <span className={`preflight-summary ${result.passed ? 'is-ok' : 'is-bad'}`}>
                {result.passed
                  ? `All ${result.checks.length} checks passed`
                  : `${failedCount} of ${result.checks.length} checks failed`}
              </span>
            )}
          </div>

          <ErrorAlert error={error} onRetry={preflight} />

          <ul className="checklist section-gap" aria-live="polite">
            {result
              ? result.checks.map((check) => (
                  <li key={check.id} className={check.passed ? 'is-ok' : 'is-bad'}>
                    {check.passed ? (
                      <CheckCircle2 size={18} aria-label="Passed" />
                    ) : (
                      <XCircle size={18} aria-label="Failed" />
                    )}
                    <div className="checklist__text">
                      <span className="checklist__label">{check.label}</span>
                      <span className="checklist__message">{check.message}</span>
                      {!check.passed && check.hint && (
                        <span className="checklist__hint">
                          {check.hint} <span className="num">({check.code})</span>
                        </span>
                      )}
                    </div>
                  </li>
                ))
              : PLANNED_CHECKS.map((label) => (
                  <li key={label}>
                    <Circle size={16} aria-hidden />
                    {label}
                  </li>
                ))}
          </ul>

          <div className="submit-row">
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
              {result?.passed
                ? 'Preflight passed. Starting the job is the next feature being added.'
                : 'Run preflight to check that this job can finish on this machine.'}
            </p>
          }
        />
      </aside>
    </div>
  );
}
