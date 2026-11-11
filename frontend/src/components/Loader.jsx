// Loader.jsx — a spinner with a label, for "Loading the catalog…" moments. Owner: Huzaifah.
import { Loader2 } from 'lucide-react';

export default function Loader({ label = 'Loading…' }) {
  return (
    <div className="loader" role="status">
      <Loader2 size={20} className="spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
