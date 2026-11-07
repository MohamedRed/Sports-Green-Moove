import http from 'node:http';
let count = 0;
const server = http.createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/sgm-socket-probe-20261025') { response.writeHead(404).end(); return; }
  response.writeHead(204, {'X-SGM-Probe': 'sgm-private-socket-probe-v1'}).end();
  console.log(JSON.stringify({scope: 'isolated-http-probe-no-accounts-or-payloads', request: ++count, servedAt: new Date().toISOString()}));
});
server.listen(9000, '127.0.0.1', () => console.log('Owned marker endpoint on 127.0.0.1:9000'));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
