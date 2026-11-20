// RecommendationCard.jsx — which compressed file to use on a device, and why.
// Shows the chosen level, the rule that decided it (in plain words), the explanation naming the
// device, a "quality risk" warning, and the smallest / largest file that fits (rule 6).
// When no file fits (or nothing was measured) it shows what the device would need instead.
// The profile dropdown lives in the page; this card only shows one answer.
// The mobile app copies it with the same props. SRS: REQ-22, REQ-23. Owner: Huzaifah (WP-19).
import { AlertTriangle, Sparkles } from 'lucide-react';
import Badge from './Badge.jsx';

// recommendation: { chosenLevel, ruleFired, ruleText, explanation, qualityRisk,
//                   baselineSmallest, baselineLargest }   (null = none yet)
export default function RecommendationCard({ recommendation: rec, deviceName, picker, busy }) {
  return (
    <div className={`rec ${busy ? 'is-busy' : ''}`} aria-busy={busy}>
      <Sparkles size={22} className="rec__icon" aria-hidden />
      <div className="rec__body">
        <div className="rec__head">
          <h2 className="section-title">Recommendation</h2>
          {picker}
        </div>

        {!rec && (
          <p className="section-intro">
            No recommendation yet. Choose a device profile to see which file suits it.
          </p>
        )}

        {rec?.chosenLevel && (
          <>
            <p className="rec__choice">
              <strong className="num">{rec.chosenLevel}</strong>
              <span className="rec__for">for {deviceName ?? 'this device'}</span>
              {rec.qualityRisk && (
                <Badge tone="warning" icon={AlertTriangle}>
                  Quality risk
                </Badge>
              )}
            </p>
            <p className="rec__explanation">{rec.explanation}</p>
            <dl className="rec__facts">
              <div>
                <dt>Rule</dt>
                <dd>{rec.ruleText ?? rec.ruleFired}</dd>
              </div>
              <div>
                <dt>Smallest that fits</dt>
                <dd className="num">{rec.baselineSmallest ?? '—'}</dd>
              </div>
              <div>
                <dt>Largest that fits</dt>
                <dd className="num">{rec.baselineLargest ?? '—'}</dd>
              </div>
            </dl>
          </>
        )}

        {rec && !rec.chosenLevel && (
          <div className="alert alert--warning">
            <AlertTriangle size={20} className="alert__icon" aria-hidden />
            <div className="alert__body">
              <p className="alert__title">{rec.ruleText ?? 'No file can be recommended.'}</p>
              <p className="alert__hint">{rec.explanation}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
