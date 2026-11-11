// EmptyState.jsx — shown when a list has nothing in it yet: what is missing and what to do.
// Owner: Huzaifah.
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty">
      {Icon && <Icon size={28} className="empty__icon" aria-hidden />}
      <h2>{title}</h2>
      {description && <p className="empty__description">{description}</p>}
      {action}
    </div>
  );
}
