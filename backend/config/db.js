// db.js — connects to MongoDB (Atlas or local) with Mongoose.
// Used by server.js, the worker and seed.js. SRS: Section 3 (database). Owner: Huzaifah.
import mongoose from 'mongoose';

export async function connectDB(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  // Print only the host, never the password inside the connection string.
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

// true when the API can currently talk to the database (used by /api/system/health).
export function isDBConnected() {
  return mongoose.connection.readyState === 1;
}
