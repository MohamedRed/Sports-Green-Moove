await new Promise(resolve => {
  const timer = setInterval(() => {}, 60_000);
  const stop = () => {clearInterval(timer); resolve();};
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  console.log('Isolated review-loss emulators ready; fixture controller has not started.');
});
