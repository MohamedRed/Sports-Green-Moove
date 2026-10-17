import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';

await seedLocalUiFixtures();
console.log('Isolated local app and management test session ready.');
await new Promise((resolveStop) => {
  const keepAlive = setInterval(() => {}, 60_000);
  const stop = () => { clearInterval(keepAlive); resolveStop(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
});
