import { defineConfig } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';

// Dev-only: POST a PNG data URL to /__shot?name=x to save a canvas capture (used for testing
// when the browser is throttled and screenshots go stale). Set SHOT_DIR to choose the folder.
const shots = () => ({
  name: 'debug-shots',
  apply: 'serve',
  configureServer(server) {
    const dir = process.env.SHOT_DIR || 'shots';
    server.middlewares.use('/__shot', (req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const name = new URL(req.url, 'http://x').searchParams.get('name') || 'shot';
        mkdirSync(dir, { recursive: true });
        writeFileSync(`${dir}/${name.replace(/[^\w-]/g, '')}.png`, Buffer.from(body.split(',')[1], 'base64'));
        res.end('ok');
      });
    });
  },
});

export default defineConfig({
  plugins: [shots()],
  server: { port: 5173, strictPort: true },
  build: { chunkSizeWarningLimit: 6000 },
});
