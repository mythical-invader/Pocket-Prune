// CatalogPage.jsx — step 1 "Model": every model PocketPrune can compress, each with its
// compression ladder (estimated F16 → Q5_K_M → Q4_K_M sizes). Selecting one stores it in the
// job draft. SRS: REQ-1. Owner: Huzaifah.
import { Check, KeyRound, Library, Zap } from 'lucide-react';
import { getCatalog } from '../services/api.js';
import { useLoad } from '../utils/useLoad.js';
import { useJobDraft } from '../context/JobDraftContext.jsx';
import { formatParams } from '../utils/format.js';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import CompressionLadder from '../components/CompressionLadder.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Loader from '../components/Loader.jsx';
import JobSummary from '../components/JobSummary.jsx';

export default function CatalogPage() {
  const { data, error, reload } = useLoad(getCatalog);
  const { draft, setModel } = useJobDraft();
  const models = data && data.filter((m) => m.isActive !== false);
  // One scale for every card: the biggest F16 file in the catalog is a full-width bar.
  const scaleMaxMb = models && Math.max(...models.map((m) => m.f16SizeMb || 0));

  return (
    <div className="workspace">
      <section className="workspace__main">
        <PageHeader
          title="Pick a model to compress"
          description="Open models from Hugging Face, each pinned to a fixed version so results can be repeated. Bars on the model cards share one scale, so you can compare models; sizes are estimates until a job measures them."
        />

        <ErrorAlert error={error} onRetry={reload} />
        {!models && !error && <Loader label="Loading the catalog…" />}
        {models?.length === 0 && (
          <EmptyState
            icon={Library}
            title="The catalog is empty"
            description="Run npm run seed to add the demo models, then reload this page."
          />
        )}

        {models?.length > 0 && (
          <div className="model-grid">
            {models.map((model) => {
              const selected = draft.model?._id === model._id;
              return (
                <Card key={model._id} selected={selected} className="model-card">
                  <div className="model-card__head">
                    <div className="model-card__title">
                      <h2>{model.displayName}</h2>
                      {model.isDemo && (
                        <Badge tone="success" icon={Zap}>
                          Quick to demo
                        </Badge>
                      )}
                      {model.gated && (
                        <Badge tone="warning" icon={KeyRound}>
                          Needs token
                        </Badge>
                      )}
                    </div>
                    <span className="model-card__repo">{model.hfRepoId}</span>
                  </div>

                  <dl className="meta">
                    <div>
                      <dt>Parameters</dt>
                      <dd className="num">{formatParams(model.paramsBillion)}</dd>
                    </div>
                    <div>
                      <dt>Licence</dt>
                      <dd>{model.license}</dd>
                    </div>
                  </dl>

                  <CompressionLadder f16SizeMb={model.f16SizeMb} scaleMaxMb={scaleMaxMb} />

                  <div className="model-card__foot">
                    <span className="model-card__estimate">
                      {model.isDemo && 'One of the smallest models, so it compresses fastest. '}
                      {model.gated && 'Gated on Hugging Face: set HF_TOKEN in .env first.'}
                    </span>
                    <Button
                      variant={selected ? 'primary' : 'secondary'}
                      size="sm"
                      icon={selected ? Check : undefined}
                      aria-pressed={selected}
                      onClick={() => setModel(model)}
                    >
                      {selected ? 'Selected' : 'Select'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <aside className="workspace__side">
        <JobSummary
          nextLabel={draft.profile ? 'Next: check device' : 'Next: choose device'}
          nextTo="/profiles"
          nextDisabled={!draft.model}
        />
      </aside>
    </div>
  );
}
