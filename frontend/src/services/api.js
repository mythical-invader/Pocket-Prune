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

export default api;
