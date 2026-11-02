/**
 * Western India Plywoods - Boiler Fuel Management
 * Local HTTP & Sync Server
 * Run using: agy-node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const SHIFTS_FILE = path.join(DATA_DIR, 'shifts.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(SHIFTS_FILE)) {
  fs.writeFileSync(SHIFTS_FILE, JSON.stringify([], null, 2));
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

function getNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // API Endpoints
  if (pathname === '/api/shifts') {
    if (req.method === 'GET') {
      try {
        const data = fs.readFileSync(SHIFTS_FILE, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const newShift = JSON.parse(body);
          const currentData = JSON.parse(fs.readFileSync(SHIFTS_FILE, 'utf8') || '[]');
          
          const index = currentData.findIndex(s => s.id === newShift.id);
          if (index >= 0) {
            currentData[index] = newShift;
          } else {
            currentData.push(newShift);
          }

          fs.writeFileSync(SHIFTS_FILE, JSON.stringify(currentData, null, 2));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, record: newShift }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // Static File Serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🏭 WESTERN INDIA PLYWOODS - BOILER FUEL MANAGEMENT`);
  console.log(`======================================================`);
  console.log(`✓ Local server running at: http://localhost:${PORT}`);
  
  const ips = getNetworkIPs();
  if (ips.length > 0) {
    console.log(`\n📱 To open on mobile phones connected to factory Wi-Fi:`);
    ips.forEach(ip => {
      console.log(`   ➜ http://${ip}:${PORT}`);
    });
  }
  console.log(`======================================================\n`);
});
