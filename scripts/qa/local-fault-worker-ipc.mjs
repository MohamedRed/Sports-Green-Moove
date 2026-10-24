export function nextFaultMessage(worker, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('Local fault worker timed out')), 30_000);
    const onMessage = (message) => { if (message.type === type) finish(null, message); };
    const onExit = () => finish(new Error('Local fault worker exited before its receipt'));
    const finish = (error, value) => {
      clearTimeout(timer); worker.off('message', onMessage); worker.off('exit', onExit); worker.off('error', finish);
      if (error) reject(error); else resolve(value);
    };
    worker.on('message', onMessage); worker.once('exit', onExit); worker.once('error', finish);
  });
}
