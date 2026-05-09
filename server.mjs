import http from 'node:http';
  const port = parseInt(process.env.PORT || '10000', 10);
  console.log('Node version:', process.version);
  console.log('Starting on port:', port);
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', node: process.version }));
  });
  server.listen(port, '0.0.0.0', () => {
    console.log('Listening on port', port);
  });
  