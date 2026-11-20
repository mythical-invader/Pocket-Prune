// api.js — the ONLY place the website talks to the backend. One axios instance and one small
// function per endpoint, so pages never build URLs themselves. The mobile app has the same
// functions. Errors always come out as { code, message, hint } (see backend utils/errors.js).
// Owner: Huzaifah.
import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 15000 });

// Turn any failure (API error, server down, timeout) into our standard error object.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const body = error.response?.data;
    if (body?.code) return Promise.reject(body);
    return Promise.reject({
      code: 'E-NETWORK',
      message: 'Cannot reach the PocketPrune API.',
      hint: 'Check that `npm run dev` is running, then try again.',
    });
  }
);

// System
export const getHealth = () => api.get('/system/health').then((r) => r.data);
export const getHostProfile = () => api.get('/system/host-profile').then((r) => r.data);

// Catalog (WP-05)
export const getCatalog = () => api.get('/catalog').then((r) => r.data);

// Device profiles (WP-05)
export const getProfiles = () => api.get('/profiles').then((r) => r.data);
export const createProfile = (profile) => api.post('/profiles', profile).then((r) => r.data);
export const updateProfile = (id, profile) =>
  api.put(`/profiles/${id}`, profile).then((r) => r.data);
export const deleteProfile = (id) => api.delete(`/profiles/${id}`).then((r) => r.data);

// Jobs. body for both: { modelId, levels, profileId, licenseAccepted }
export const runPreflight = (body) => api.post('/jobs/preflight', body).then((r) => r.data); // → { passed, checks[] }
export const createJob = (body) => api.post('/jobs', body).then((r) => r.data); // → { jobId }
export const getJobs = () => api.get('/jobs').then((r) => r.data);
export const getJob = (id) => api.get(`/jobs/${id}`).then((r) => r.data); // + queuePosition, events
export const getResults = (id) => api.get(`/jobs/${id}/results`).then((r) => r.data); // WP-15
// WP-19: the recommendation for another of your device profiles (nothing is saved)
export const recommendFor = (id, profileId) =>
  api.post(`/jobs/${id}/recommend`, { profileId }).then((r) => r.data);
export const exportUrl = (id, format) => `/api/jobs/${id}/export?format=${format}`;

// Downloads (WP-17). The download itself is a normal link, so the browser shows its own
// progress bar and can resume; this only builds the address.
export const getArtifacts = () => api.get('/artifacts').then((r) => r.data);
export const artifactDownloadUrl = (jobId, level) => `/api/artifacts/${jobId}/${level}/download`;

export default api;
