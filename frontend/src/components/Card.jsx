// Card.jsx — a white box with a soft border; pages are built from stacked cards.
// `selected` draws the blue selected border (e.g. the chosen model). Owner: Huzaifah.
export default function Card({ selected = false, className = '', children, ...props }) {
  return (
    <div className={`card ${selected ? 'card--selected' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
}
