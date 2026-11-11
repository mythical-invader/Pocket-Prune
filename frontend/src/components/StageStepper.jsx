// StageStepper.jsx — numbered steps joined by lines; finished steps show a tick, the
// current one is filled blue. Used as the pipeline rail at the top of every job page
// (Model → Device → Preflight → Run → Results) and later for job progress stages.
// A step with `to` becomes a link. A step may say `done: true/false` itself (e.g. "a model is
// chosen"); otherwise every step before the current one counts as done. Owner: Huzaifah.
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

export default function StageStepper({ steps, currentIndex, label = 'Steps' }) {
  return (
    <nav className="stepper" aria-label={label}>
      <ol className="stepper__list">
        {steps.map((step, i) => {
          const done = step.done ?? i < currentIndex;
          const state = i === currentIndex ? 'current' : done ? 'done' : 'todo';
          // The line after a step turns blue only when it leads to a step already reached,
          // so a blue line never points at an unfinished step.
          const next = steps[i + 1];
          const nextReached =
            next && ((next.done ?? i + 1 < currentIndex) || i + 1 === currentIndex);
          const lineDone = done && nextReached;
          const ariaCurrent = state === 'current' ? 'step' : undefined;
          const content = (
            <>
              <span className="stepper__dot num" aria-hidden>
                {state === 'done' ? <Check size={16} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className="stepper__label">{step.label}</span>
            </>
          );
          return (
            <li
              key={step.key}
              className={`stepper__step stepper__step--${state} ${lineDone ? 'stepper__step--line-done' : ''}`}
            >
              {step.to ? (
                <Link to={step.to} className="stepper__item" aria-current={ariaCurrent}>
                  {content}
                </Link>
              ) : (
                <span className="stepper__item" aria-current={ariaCurrent}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
