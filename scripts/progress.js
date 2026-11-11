// progress.js — prints how much of PocketPrune is done, from docs/progress.json.
// Only MERGED work packages count towards the main percentage, so the number stays honest.
// Run with: npm run progress. Owner: Huzaifah (WP-01).
import fs from 'node:fs';
import path from 'node:path';

const file = path.join(import.meta.dirname, '..', 'docs', 'progress.json');
const { wps, people, checkpoints } = JSON.parse(fs.readFileSync(file, 'utf8'));

const byId = Object.fromEntries(wps.map((wp) => [wp.id, wp]));
const sum = (list) => list.reduce((total, wp) => total + wp.weight, 0);
const withStatus = (status) => wps.filter((wp) => wp.status === status);
const bar = (done, total, width = 20) => {
  const filled = Math.round((done / total) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
};

// 1. Overall
console.log(
  `PocketPrune progress: ${sum(withStatus('merged'))} % merged ` +
    `(in review: ${sum(withStatus('in-review'))} %, in progress: ${sum(withStatus('in-progress'))} %)\n`
);

// 2. Per phase
for (const phase of [1, 2, 3, 4, 5]) {
  const inPhase = wps.filter((wp) => wp.phase === phase);
  const done = sum(inPhase.filter((wp) => wp.status === 'merged'));
  console.log(`Phase ${phase} ${bar(done, sum(inPhase))} ${done}/${sum(inPhase)} %`);
}

// 3. Per person ("Both" counts half for each member)
const share = (key) =>
  withStatus('merged').reduce(
    (t, wp) => t + (wp.owner === key ? wp.weight : wp.owner === 'Both' ? wp.weight / 2 : 0),
    0
  );
console.log(`\n${people.H}: ${share('H')} %  ·  ${people.S}: ${share('S')} %`);

// 4. Next checkpoint: the first one whose phases are not fully merged
const today = new Date().toISOString().slice(0, 10);
const next = checkpoints.find((cp) =>
  wps.some((wp) => wp.phase <= cp.phase && wp.status !== 'merged')
);
if (next) {
  const left = wps.filter((wp) => wp.phase <= next.phase && wp.status !== 'merged');
  const days = Math.ceil((new Date(next.date) - new Date(today)) / 86_400_000);
  console.log(
    `Next checkpoint: ${next.name} on ${next.date} (${days} days) — ${sum(left)} % to go: ` +
      left.map((wp) => wp.id).join(', ')
  );
}

// 5. Who can start now, and who is waiting on whom
const notMerged = (id) => byId[id].status !== 'merged';
const open = wps.filter((wp) => wp.status === 'not-started');
const ready = open.filter((wp) => !wp.needs.some(notMerged));
const waiting = open.filter((wp) => wp.needs.some(notMerged) && wp.phase <= (next?.phase ?? 5));

console.log(
  `\nReady to start: ${ready.map((wp) => `${wp.id} (${wp.owner})`).join(', ') || 'none'}`
);
for (const wp of waiting) {
  const blockers = wp.needs
    .filter(notMerged)
    .map((id) => `${id} (${byId[id].owner}, ${byId[id].status})`);
  console.log(`Waiting: ${wp.id} (${wp.owner}) needs ${blockers.join(', ')}`);
}
