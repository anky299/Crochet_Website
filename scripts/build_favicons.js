const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Helper to construct ICO binary from PNG buffer
function createIcoFromPng(pngBuffer, width = 0, height = 0) {
  // ICONDIR header (6 bytes)
  // Reserved: 0x0000 (2 bytes)
  // Type: 0x0001 (1 = icon, 2 = cursor) (2 bytes)
  // Image count: 0x0001 (2 bytes)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(1, 4); // 1 image

  // ICONDIRENTRY (16 bytes)
  // 0: Width (0 = 256)
  // 1: Height (0 = 256)
  // 2: Color count (0)
  // 3: Reserved (0)
  // 4-5: Color planes (1)
  // 6-7: Bits per pixel (32)
  // 8-11: Image size in bytes (PNG length)
  // 12-15: Image offset (22 bytes)
  const entry = Buffer.alloc(16);
  entry.writeUInt8(width >= 256 ? 0 : width, 0);
  entry.writeUInt8(height >= 256 ? 0 : height, 1);
  entry.writeUInt8(0, 2); // color count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(pngBuffer.length, 8); // image size
  entry.writeUInt32LE(22, 12); // offset (6 + 16 = 22)

  return Buffer.concat([header, entry, pngBuffer]);
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/save-favicon') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const base64Data = data.pngBase64.replace(/^data:image\/png;base64,/, '');
        const pngBuffer = Buffer.from(base64Data, 'base64');

        // Ensure assets directory exists
        const assetsDir = path.join(ROOT_DIR, 'assets');
        if (!fs.existsSync(assetsDir)) {
          fs.mkdirSync(assetsDir, { recursive: true });
        }

        // 1. Write /assets/favicon.png (512x512)
        const assetsFaviconPng = path.join(assetsDir, 'favicon.png');
        fs.writeFileSync(assetsFaviconPng, pngBuffer);
        console.log('Wrote:', assetsFaviconPng, `(${pngBuffer.length} bytes)`);

        // 2. Write /assets/favicon.ico
        const icoBuffer = createIcoFromPng(pngBuffer, 0, 0);
        const assetsFaviconIco = path.join(assetsDir, 'favicon.ico');
        fs.writeFileSync(assetsFaviconIco, icoBuffer);
        console.log('Wrote:', assetsFaviconIco, `(${icoBuffer.length} bytes)`);

        // 3. Write /assets/apple-touch-icon.png
        const appleIcon = path.join(assetsDir, 'apple-touch-icon.png');
        fs.writeFileSync(appleIcon, pngBuffer);
        console.log('Wrote:', appleIcon);

        // 4. Root fallbacks for direct domain root /favicon.ico and /favicon.png requests
        const rootFaviconPng = path.join(ROOT_DIR, 'favicon.png');
        fs.writeFileSync(rootFaviconPng, pngBuffer);
        const rootFaviconIco = path.join(ROOT_DIR, 'favicon.ico');
        fs.writeFileSync(rootFaviconIco, icoBuffer);
        const rootAppleIcon = path.join(ROOT_DIR, 'apple-touch-icon.png');
        fs.writeFileSync(rootAppleIcon, pngBuffer);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, size: pngBuffer.length }));
      } catch (err) {
        console.error('Error saving favicons:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Serve static files
  let filePath = path.join(ROOT_DIR, req.url === '/' ? 'make_favicon.html' : req.url);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
      '.js': 'text/javascript',
      '.css': 'text/css'
    };
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const PORT = 3456;
server.listen(PORT, () => {
  console.log(`Favicon generator server running on http://127.0.0.1:${PORT}/make_favicon.html`);
});
