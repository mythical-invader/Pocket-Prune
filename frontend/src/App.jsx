// App.jsx — the website's pages and their addresses (React Router).
// Every page renders inside AppLayout (top bar + pipeline rail). Owner: Huzaifah.
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { FileQuestion, HelpCircle, History } from 'lucide-react';
import { JobDraftProvider } from './context/JobDraftContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import ProfilesPage from './pages/ProfilesPage.jsx';
import JobSetupPage from './pages/JobSetupPage.jsx';
import JobProgressPage from './pages/JobProgressPage.jsx';
import ResultsPage from './pages/ResultsPage.jsx';
import DownloadsPage from './pages/DownloadsPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import './pages/pages.css';

export default function App() {
  return (
    <BrowserRouter>
      <JobDraftProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/catalog" replace />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/profiles" element={<ProfilesPage />} />
            <Route path="/job/new" element={<JobSetupPage />} />
            <Route path="/jobs/:id" element={<JobProgressPage />} />
            <Route path="/jobs/:id/results" element={<ResultsPage />} />
            <Route
              path="/history"
              element={
                <PlaceholderPage
                  title="History"
                  description="Every compression job you have run, newest first."
                  icon={History}
                  emptyTitle="No jobs yet"
                  emptyText="Jobs you start appear here with their status, and you can open their results or retry a failed one."
                />
              }
            />
            <Route path="/downloads" element={<DownloadsPage />} />
            <Route
              path="/help"
              element={
                <PlaceholderPage
                  title="Help"
                  description="What GGUF, quantization levels, perplexity and tok/s mean, how the recommendation works, and every error code."
                  icon={HelpCircle}
                  emptyTitle="The help guide is being written"
                  emptyText="Until then, every error message on the site already says what failed and how to fix it."
                />
              }
            />
            <Route
              path="*"
              element={
                <PlaceholderPage
                  title="Page not found"
                  icon={FileQuestion}
                  emptyTitle="There is nothing at this address"
                  emptyText="Check the link, or go back to the catalog."
                />
              }
            />
          </Route>
        </Routes>
      </JobDraftProvider>
    </BrowserRouter>
  );
}
