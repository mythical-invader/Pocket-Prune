// seed.js — fills the database with the catalog models and the demo user.
// Safe to run again: models are updated by hfRepoId instead of duplicated.
// Run with: npm run seed. SRS: REQ-1, REQ-2, REQ-3. Owner: Huzaifah.
import { settings } from './config/settings.js';
import { connectDB, disconnectDB } from './config/db.js';
import CatalogModel from './models/CatalogModel.js';
import User from './models/User.js';
import { CATALOG_SEED } from './seedData.js';
import { checkCatalogEntry } from './services/catalogService.js';

async function seed() {
  await connectDB(settings.mongoUri);

  let added = 0;
  for (const entry of CATALOG_SEED) {
    const problems = checkCatalogEntry(entry);
    if (problems.length) {
      console.warn(`Skipped ${entry.hfRepoId}: ${problems.join(' ')}`);
      continue;
    }
    // Upsert: create if missing, otherwise update the facts (keeps isActive set by an admin).
    await CatalogModel.updateOne(
      { hfRepoId: entry.hfRepoId },
      { $set: entry, $setOnInsert: { isActive: true } },
      { upsert: true, runValidators: true }
    );
    added++;
  }
  console.log(`Catalog: ${added} models ready.`);

  // The demo user that every request acts as until login exists (WP-21).
  await User.updateOne(
    { email: settings.demoUserEmail },
    { $setOnInsert: { passwordHash: 'no-login-demo-user', role: 'user' } },
    { upsert: true }
  );
  console.log(`Demo user ready: ${settings.demoUserEmail}`);
}

try {
  await seed();
} catch (err) {
  console.error(`Seeding failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
