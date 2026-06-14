import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');

const server = http.createServer((req, res) => {
  let filePath = path.join(distPath, req.url === '/' ? 'index.html' : req.url);
  
  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
  };
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (filePath.endsWith('.html')) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(path.join(distPath, 'index.html')));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      res.end(data);
    }
  });
});

const PORT = process.env.PORT || 5175;
server.listen(PORT, () => {
  console.log(`🚀 Dashboard serving from dist on http://localhost:${PORT}`);
});
