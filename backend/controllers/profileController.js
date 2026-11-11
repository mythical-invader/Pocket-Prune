// profileController.js — the user's own device profiles (RAM, free disk, threads, preference).
// Every query includes `user: req.user._id`, so nobody can read or change another user's
// profiles; someone else's profile simply looks "not found". The schema in
// models/DeviceProfile.js checks the values; bad input becomes E-INPUT-01 in the error handler.
// SRS: REQ-4, REQ-32. Owner: Huzaifah.
import DeviceProfile from '../models/DeviceProfile.js';
import { appError } from '../utils/errors.js';

// Copy only the fields a user may set (never `user` or `_id` from the request body).
function pickProfileFields(body) {
  const { name, ramMb, freeDiskMb, cpuThreads, preference } = body;
  return { name, ramMb, freeDiskMb, cpuThreads, preference };
}

// GET /api/profiles — oldest first, so the list doesn't jump around.
export async function listProfiles(req, res, next) {
  try {
    const profiles = await DeviceProfile.find({ user: req.user._id }).sort({ createdAt: 1 });
    res.json(profiles);
  } catch (err) {
    next(err);
  }
}

// GET /api/profiles/:id
export async function getProfile(req, res, next) {
  try {
    const profile = await DeviceProfile.findOne({ _id: req.params.id, user: req.user._id });
    if (!profile) throw appError('E-NOTFOUND-01', { message: 'Device profile not found.' });
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

// POST /api/profiles → 201 with the new profile.
export async function createProfile(req, res, next) {
  try {
    const profile = await DeviceProfile.create({
      ...pickProfileFields(req.body),
      user: req.user._id,
    });
    res.status(201).json(profile);
  } catch (err) {
    next(err);
  }
}

// PUT /api/profiles/:id — replaces the editable fields.
export async function updateProfile(req, res, next) {
  try {
    const profile = await DeviceProfile.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      pickProfileFields(req.body),
      { returnDocument: 'after', runValidators: true }
    );
    if (!profile) throw appError('E-NOTFOUND-01', { message: 'Device profile not found.' });
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/profiles/:id → { deleted: true }
export async function deleteProfile(req, res, next) {
  try {
    const profile = await DeviceProfile.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!profile) throw appError('E-NOTFOUND-01', { message: 'Device profile not found.' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}
