// ProfilesPage.jsx — step 2 "Device": the user's device profiles (RAM, free disk, threads,
// what matters most). Pick one for the job, add a new one, edit or delete. "Use this
// computer's values" fills the form from /api/system/host-profile. SRS: REQ-4. Owner: Huzaifah.
import { useState } from 'react';
import { useLoad } from '../utils/useLoad.js';
import { Check, Cpu, Laptop, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  createProfile,
  deleteProfile,
  getHostProfile,
  getProfiles,
  updateProfile,
} from '../services/api.js';
import { useJobDraft } from '../context/JobDraftContext.jsx';
import { formatMb } from '../utils/format.js';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import Field from '../components/Field.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Loader from '../components/Loader.jsx';
import JobSummary from '../components/JobSummary.jsx';

const PREFERENCES = [
  { value: 'balanced', label: 'Balanced', hint: 'A bit of everything' },
  { value: 'quality', label: 'Quality', hint: 'Answers closest to the original' },
  { value: 'speed', label: 'Speed', hint: 'Fastest replies' },
  { value: 'smallest', label: 'Smallest', hint: 'Least disk and memory' },
];

// The form works in GB (easier to type); the API stores MB.
const EMPTY_FORM = { name: '', ramGb: '', diskGb: '', cpuThreads: '', preference: 'balanced' };
const toGb = (mb) => String(Math.round((mb / 1024) * 10) / 10);

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Give the device a name, e.g. "My laptop".';
  if (!(Number(form.ramGb) >= 0.5)) errors.ramGb = 'Enter the RAM in GB (at least 0.5).';
  if (form.diskGb === '' || !(Number(form.diskGb) >= 0))
    errors.diskGb = 'Enter the free disk space in GB.';
  if (!Number.isInteger(Number(form.cpuThreads)) || Number(form.cpuThreads) < 1)
    errors.cpuThreads = 'Enter a whole number of threads (1 or more).';
  return errors;
}

export default function ProfilesPage() {
  const {
    data: profiles,
    error: loadError,
    reload,
    setData: setProfiles,
    setError: setLoadError,
  } = useLoad(getProfiles);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [readingHost, setReadingHost] = useState(false);
  const { draft, setProfile } = useJobDraft();

  const change = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  function openNew() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setErrors({});
    setSaveError(null);
    setFormOpen(true);
  }

  function openEdit(profile) {
    setForm({
      name: profile.name,
      ramGb: toGb(profile.ramMb),
      diskGb: toGb(profile.freeDiskMb),
      cpuThreads: String(profile.cpuThreads),
      preference: profile.preference,
    });
    setEditingId(profile._id);
    setErrors({});
    setSaveError(null);
    setFormOpen(true);
  }

  async function fillFromThisComputer() {
    setReadingHost(true);
    try {
      const host = await getHostProfile();
      setForm((f) => ({
        ...f,
        name: f.name || host.machineName,
        ramGb: toGb(host.ramMb),
        diskGb: toGb(host.freeDiskMb),
        cpuThreads: String(host.cpuThreads),
      }));
    } catch (err) {
      setSaveError(err);
    } finally {
      setReadingHost(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    const body = {
      name: form.name.trim(),
      ramMb: Math.round(Number(form.ramGb) * 1024),
      freeDiskMb: Math.round(Number(form.diskGb) * 1024),
      cpuThreads: Number(form.cpuThreads),
      preference: form.preference,
    };
    setSaving(true);
    setSaveError(null);
    try {
      const saved = editingId ? await updateProfile(editingId, body) : await createProfile(body);
      setProfiles((list) =>
        editingId ? list.map((p) => (p._id === saved._id ? saved : p)) : [...list, saved]
      );
      if (draft.profile?._id === saved._id || !draft.profile) setProfile(saved);
      setFormOpen(false);
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  async function remove(profile) {
    if (!window.confirm(`Delete the profile "${profile.name}"?`)) return;
    try {
      await deleteProfile(profile._id);
      setProfiles((list) => list.filter((p) => p._id !== profile._id));
      if (draft.profile?._id === profile._id) setProfile(null);
    } catch (err) {
      setLoadError(err);
    }
  }

  return (
    <div className="workspace">
      <section className="workspace__main">
        <PageHeader
          title="Which device will run the model?"
          description="The recommendation picks the file that fits this device's memory and disk and matches what matters most to you."
          actions={
            !formOpen && (
              <Button variant="secondary" icon={Plus} onClick={openNew}>
                Add device
              </Button>
            )
          }
        />

        <ErrorAlert error={loadError} onRetry={reload} />

        {formOpen && (
          <Card>
            <form onSubmit={save} noValidate>
              <div className="form-head">
                <h2>{editingId ? 'Edit device' : 'New device'}</h2>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Laptop}
                  loading={readingHost}
                  onClick={fillFromThisComputer}
                >
                  {"Use this computer's values"}
                </Button>
              </div>

              <div className="form-grid">
                <div className="form-grid__wide">
                  <Field label="Name" htmlFor="p-name" error={errors.name}>
                    <input
                      id="p-name"
                      className="input"
                      value={form.name}
                      onChange={change('name')}
                      placeholder="My laptop"
                      maxLength={60}
                    />
                  </Field>
                </div>
                <Field label="RAM" unit="GB" htmlFor="p-ram" error={errors.ramGb}>
                  <input
                    id="p-ram"
                    className="input"
                    type="number"
                    inputMode="decimal"
                    min="0.5"
                    step="0.1"
                    value={form.ramGb}
                    onChange={change('ramGb')}
                  />
                </Field>
                <Field label="Free disk" unit="GB" htmlFor="p-disk" error={errors.diskGb}>
                  <input
                    id="p-disk"
                    className="input"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={form.diskGb}
                    onChange={change('diskGb')}
                  />
                </Field>
                <Field label="CPU threads" htmlFor="p-threads" error={errors.cpuThreads}>
                  <input
                    id="p-threads"
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={form.cpuThreads}
                    onChange={change('cpuThreads')}
                  />
                </Field>
                <fieldset className="form-grid__wide choice-group" aria-label="What matters most">
                  {PREFERENCES.map((p) => (
                    <label key={p.value} className="choice">
                      <input
                        type="radio"
                        name="preference"
                        value={p.value}
                        checked={form.preference === p.value}
                        onChange={change('preference')}
                      />
                      <span className="choice__title">{p.label}</span>
                      <span className="choice__hint">{p.hint}</span>
                    </label>
                  ))}
                </fieldset>
              </div>

              {saveError && (
                <div style={{ marginTop: 'var(--space-md)' }}>
                  <ErrorAlert error={saveError} />
                </div>
              )}

              <div className="form-actions">
                <Button type="submit" loading={saving}>
                  {editingId ? 'Save changes' : 'Save device'}
                </Button>
                <Button variant="ghost" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {!profiles && !loadError && <Loader label="Loading your devices…" />}

        {profiles?.length === 0 && !formOpen && (
          <EmptyState
            icon={Cpu}
            title="No devices yet"
            description="Add the computer or phone you want to run the model on. You can fill it from this computer in one click."
            action={
              <Button icon={Plus} onClick={openNew}>
                Add device
              </Button>
            }
          />
        )}

        {profiles?.length > 0 && (
          <div className="profile-list">
            {profiles.map((profile) => {
              const selected = draft.profile?._id === profile._id;
              const priority =
                PREFERENCES.find((p) => p.value === profile.preference) || PREFERENCES[0];
              return (
                <Card key={profile._id} selected={selected} className="profile-card">
                  <h2>{profile.name}</h2>
                  <dl className="meta">
                    <div>
                      <dt>RAM</dt>
                      <dd className="num">{formatMb(profile.ramMb)}</dd>
                    </div>
                    <div>
                      <dt>Disk</dt>
                      <dd className="num">{formatMb(profile.freeDiskMb)}</dd>
                    </div>
                    <div>
                      <dt>Threads</dt>
                      <dd className="num">{profile.cpuThreads}</dd>
                    </div>
                  </dl>
                  <p className="profile-card__priority">
                    <span>Priority</span> {priority.label} · {priority.hint.toLowerCase()}
                  </p>
                  <div className="profile-card__actions">
                    <Button
                      size="sm"
                      variant={selected ? 'primary' : 'secondary'}
                      icon={selected ? Check : undefined}
                      aria-pressed={selected}
                      onClick={() => setProfile(profile)}
                    >
                      {selected ? 'Selected' : 'Use for this job'}
                    </Button>
                    <span className="profile-card__tools">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Pencil}
                        aria-label={`Edit ${profile.name}`}
                        onClick={() => openEdit(profile)}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Trash2}
                        aria-label={`Delete ${profile.name}`}
                        onClick={() => remove(profile)}
                      />
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <aside className="workspace__side">
        <JobSummary
          nextLabel="Next: levels and preflight"
          nextTo="/job/new"
          nextDisabled={!draft.model || !draft.profile}
        />
      </aside>
    </div>
  );
}
