// JobDraftContext.jsx — remembers what the user has picked so far while moving through the
// pipeline steps (model on Catalog, device on Profiles, levels on Job Setup), so every page and
// the "Your job" summary see the same choices. Kept in sessionStorage so a page refresh keeps
// them. Owner: Huzaifah.
import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'pocketprune.jobDraft';
const EMPTY_DRAFT = { model: null, profile: null, levels: ['Q5_K_M', 'Q4_K_M'] };

const JobDraftContext = createContext(null);

function loadDraft() {
  try {
    return { ...EMPTY_DRAFT, ...JSON.parse(sessionStorage.getItem(STORAGE_KEY)) };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function JobDraftProvider({ children }) {
  const [draft, setDraft] = useState(loadDraft);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Private mode or storage blocked: the draft just won't survive a refresh.
    }
  }, [draft]);

  const value = {
    draft,
    setModel: (model) => setDraft((d) => ({ ...d, model })),
    setProfile: (profile) => setDraft((d) => ({ ...d, profile })),
    setLevels: (levels) => setDraft((d) => ({ ...d, levels })),
    clearDraft: () => setDraft(EMPTY_DRAFT),
  };

  return <JobDraftContext.Provider value={value}>{children}</JobDraftContext.Provider>;
}

export function useJobDraft() {
  return useContext(JobDraftContext);
}
