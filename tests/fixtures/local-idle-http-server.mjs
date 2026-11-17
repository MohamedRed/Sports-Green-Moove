import http from 'node:http';

let count = 0;
const server = http.createServer((request, response) => {
  request.resume();
  request.on('end', () => {
    count++;
    if (request.url.endsWith('/drop')) { request.socket.destroy(); return; }
    response.setHeader('content-type', 'application/json');
    if (request.headers.connection !== 'close') response.setHeader('keep-alive', 'timeout=60');
    response.end(JSON.stringify({ count, connection: request.socket.remotePort,
      connectionHeader: request.headers.connection, authorization: request.headers.authorization ?? null }));
  });
});
server.keepAliveTimeout = 100;
server.keepAliveTimeoutBuffer = 0;
server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
