// StatusBadge.jsx — a job's status (QUEUED, DOWNLOADING, …, COMPLETED, FAILED) as a Badge.
// Every running stage shows as blue "info"; the label is the readable stage name.
// Owner: Huzaifah.
import Badge from './Badge.jsx';

const TONES = { QUEUED: 'neutral', COMPLETED: 'success', FAILED: 'danger', CANCELLED: 'neutral' };

export default function StatusBadge({ status }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase(); // "DOWNLOADING" → "Downloading"
  return <Badge tone={TONES[status] || 'info'}>{label}</Badge>;
}
