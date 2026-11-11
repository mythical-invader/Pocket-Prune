// authMiddleware.js — decides WHO is making the request and puts it in req.user.
//
// TEMPORARY VERSION (WP-03): there is no login yet, so every request acts as the demo user
// (created on first use). WP-21 replaces the inside of `protect` with the real JWT check;
// routes keep using `protect` exactly as they do now, so nothing else changes.
// SRS: REQ-31, REQ-32. Owner: Huzaifah.
import User from '../models/User.js';
import { settings } from '../config/settings.js';

export async function protect(req, res, next) {
  try {
    // Find the demo user, or create it the first time. "$setOnInsert" only applies on create.
    req.user = await User.findOneAndUpdate(
      { email: settings.demoUserEmail },
      // Not a real bcrypt hash, so nobody can log in as the demo user once login exists.
      { $setOnInsert: { passwordHash: 'no-login-demo-user', role: 'user' } },
      { upsert: true, returnDocument: 'after' } // return the user after the update
    );
    next();
  } catch (err) {
    next(err);
  }
}
