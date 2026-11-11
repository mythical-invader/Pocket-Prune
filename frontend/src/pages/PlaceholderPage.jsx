// PlaceholderPage.jsx — History, Downloads and Help before their work packages are built
// (WP-23, WP-17, WP-25). Says what will appear here instead of showing a broken page.
// Owner: Huzaifah.
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Button from '../components/Button.jsx';

export default function PlaceholderPage({ title, description, icon, emptyTitle, emptyText }) {
  return (
    <div className="stack">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon}
        title={emptyTitle}
        description={emptyText}
        action={
          <Link to="/catalog">
            <Button variant="secondary">Start with a model</Button>
          </Link>
        }
      />
    </div>
  );
}
