const keepAlive = setInterval(() => {}, 1_000);
const stop = () => { clearInterval(keepAlive); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
console.log(process.pid);
