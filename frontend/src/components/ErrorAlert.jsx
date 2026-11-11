// ErrorAlert.jsx — shows an API error the PocketPrune way: what failed, how to fix it, and
// its code (e.g. E-DISK-01, explained on the Help page). `error` is { code, message, hint }.
// Owner: Huzaifah.
import { AlertTriangle, RotateCw } from 'lucide-react';
import Button from './Button.jsx';

export default function ErrorAlert({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert--danger" role="alert">
      <AlertTriangle size={20} className="alert__icon" aria-hidden />
      <div className="alert__body">
        <p className="alert__title">{error.message}</p>
        {error.hint && <p className="alert__hint">{error.hint}</p>}
        {error.code && <p className="alert__code num">Error code {error.code}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RotateCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
