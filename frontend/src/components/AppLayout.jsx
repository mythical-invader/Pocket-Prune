// AppLayout.jsx — the frame around every page: the top bar (brand + History, Downloads, Help)
// and, on job pages, the pipeline rail showing which step the user is on.
// Pages render inside <Outlet />. Owner: Huzaifah.
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Download, HelpCircle, History, Layers } from 'lucide-react';
import StageStepper from './StageStepper.jsx';
import { useJobDraft } from '../context/JobDraftContext.jsx';

// The five steps of a compression job. Run and Results get their pages in WP-12 / WP-15.
export const PIPELINE_STEPS = [
  { key: 'model', label: 'Model', to: '/catalog' },
  { key: 'device', label: 'Device', to: '/profiles' },
  { key: 'preflight', label: 'Preflight', to: '/job/new' },
  { key: 'run', label: 'Run' },
  { key: 'results', label: 'Results' },
];

const NAV = [
  { to: '/history', label: 'History', icon: History },
  { to: '/downloads', label: 'Downloads', icon: Download },
  { to: '/help', label: 'Help', icon: HelpCircle },
];

export default function AppLayout() {
  const { pathname } = useLocation();
  const { draft } = useJobDraft();
  const stepIndex = PIPELINE_STEPS.findIndex((step) => step.to === pathname);
  // A tick means the step is really finished, not just that it comes earlier.
  const doneByStep = { model: !!draft.model, device: !!draft.profile };
  const steps = PIPELINE_STEPS.map((step) => ({ ...step, done: doneByStep[step.key] ?? false }));

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <Link to="/catalog" className="brand">
            <Layers size={22} className="brand__mark" aria-hidden />
            <span>
              <span className="brand__first">Pocket</span>Prune
            </span>
          </Link>
          <nav className="topnav" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className="topnav__link" aria-label={label}>
                <Icon size={18} aria-hidden />
                <span className="topnav__text">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="shell">
        {stepIndex >= 0 && (
          <div className="rail">
            <StageStepper steps={steps} currentIndex={stepIndex} label="Job steps" />
          </div>
        )}
        <Outlet />
      </main>
    </>
  );
}
