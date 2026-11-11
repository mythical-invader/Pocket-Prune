// PageHeader.jsx — the page title, one line saying what the page is for, and optional
// buttons on the right. Owner: Huzaifah.
export default function PageHeader({ title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}
