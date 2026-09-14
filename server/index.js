'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');

const { WEB_DIST, ensureDirs, getSettings } = require('./config');
const api = require('./routes/api');

ensureDirs();
const settings = getSettings();
const PORT = Number(process.env.PORT || settings.port || 4513);
const HOST = '127.0.0.1';

const app = express();
app.use(express.json({ limit: '50mb' }));

app.use('/api', api.router);

// static frontend (built with `npm run build`)
app.use(express.static(WEB_DIST));

// SPA fallback — Express 4 wildcard
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const index = path.join(WEB_DIST, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(200).send('<h1>CSleaf</h1><p>Frontend not built yet. Run <code>npm run setup</code> first.</p>');
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}
api.setBroadcaster(broadcast);

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'hello', ts: Date.now() }));
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log('');
  console.log('  🌿  CSleaf is running');
  console.log(`  →  ${url}`);
  console.log('');
  if (settings.autoOpenBrowser && !process.env.CSLEAF_NO_OPEN) {
    openBrowser(url);
  }
});

function openBrowser(url) {
  const { spawn } = require('child_process');
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' });
    else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' });
    else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
  } catch {}
}
