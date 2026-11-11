// Badge.jsx — a small coloured label: "Demo", "Gated", "FAKE DATA"…
// tone: "neutral" | "info" | "success" | "warning" | "danger". Owner: Huzaifah.
export default function Badge({ tone = 'neutral', icon: Icon, children }) {
  return (
    <span className={`badge badge--${tone}`}>
      {Icon && <Icon size={13} aria-hidden />}
      {children}
    </span>
  );
}
