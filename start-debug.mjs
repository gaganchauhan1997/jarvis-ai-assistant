import http from 'node:http';
  const port = parseInt(process.env.PORT || '10000', 10);

  let crashError = null;

  // Catch any crash and serve it via HTTP so we can read it
  process.on('uncaughtException', (err) => {
    crashError = { type: 'uncaughtException', message: err.message, stack: err.stack };
    console.error('CRASH:', err.message);
    startFallbackServer();
  });
  process.on('unhandledRejection', (reason) => {
    crashError = { type: 'unhandledRejection', message: String(reason), stack: reason?.stack };
    console.error('REJECTION:', reason);
    startFallbackServer();
  });

  function startFallbackServer() {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ node: process.version, env: process.env.NODE_ENV, error: crashError }, null, 2));
    });
    server.listen(port, '0.0.0.0', () => console.log('Fallback server on', port));
  }

  console.log('Node version:', process.version);
  console.log('PORT:', port);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('Importing app...');

  try {
    await import('./artifacts/api-server/dist/index.mjs');
    console.log('App imported successfully');
  } catch (err) {
    crashError = { type: 'importError', message: err.message, stack: err.stack };
    console.error('IMPORT FAILED:', err.message);
    startFallbackServer();
  }
  