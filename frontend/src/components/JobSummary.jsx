// JobSummary.jsx — the "Your job" card on the right of every pipeline step: the chosen model,
// device and levels so far, the compression ladder of the chosen model, and the button to the
// next step. Owner: Huzaifah.
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Card from './Card.jsx';
import Button from './Button.jsx';
import CompressionLadder from './CompressionLadder.jsx';
import { useJobDraft } from '../context/JobDraftContext.jsx';
import { formatMb } from '../utils/format.js';

export default function JobSummary({ nextLabel, nextTo, nextDisabled, footer }) {
  const { draft } = useJobDraft();
  const navigate = useNavigate();
  const { model, profile, levels } = draft;

  return (
    <Card className="summary">
      <h2>Your job</h2>
      <dl className="summary__list">
        <div className="summary__row">
          <dt>Model</dt>
          <dd>{model ? model.displayName : <span className="summary__empty">Not chosen</span>}</dd>
        </div>
        <div className="summary__row">
          <dt>Device</dt>
          <dd>
            {profile ? (
              <>
                {profile.name}
                <span className="summary__sub num">
                  {formatMb(profile.ramMb)} RAM · {profile.cpuThreads} threads
                </span>
              </>
            ) : (
              <span className="summary__empty">Not chosen</span>
            )}
          </dd>
        </div>
        <div className="summary__row">
          <dt>Levels</dt>
          <dd>
            {levels.length ? levels.join(', ') : <span className="summary__empty">None</span>}
          </dd>
        </div>
      </dl>
      {model && levels.length > 0 && (
        <CompressionLadder f16SizeMb={model.f16SizeMb} levels={['F16', ...levels]} />
      )}
      {/* On phones this wrapper becomes a fixed bar at the bottom of the screen. */}
      {nextTo && (
        <div className="summary__cta">
          <Button
            className="btn--block"
            icon={ArrowRight}
            disabled={nextDisabled}
            onClick={() => navigate(nextTo)}
          >
            {nextLabel}
          </Button>
        </div>
      )}
      {footer}
    </Card>
  );
}
