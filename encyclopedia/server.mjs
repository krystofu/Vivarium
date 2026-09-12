import http from 'node:http';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { createCharacter, updateCharacter, reviewAsset, logRender, setIdentityAuthorities, buildContinuumPack } from './cloud/service.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MAX_IMAGE = 12 * 1024 * 1024;
const TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function text(value, max = 4000) {
  if (typeof value !== 'string' || value.length > max) fail(400, 'Invalid text value.');
  return value.trim();
}
export function imageType(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  fail(415, 'Use a PNG, JPEG, or WebP image.');
}
async function body(req, max) {
  const chunks = []; let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > max) fail(413, 'File is too large. Maximum image size is 12 MB.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function createApp({ dataDir = process.env.VIVARIUM_DATA_DIR || join(ROOT, 'data') } = {}) {
  dataDir = resolve(dataDir);
  await mkdir(join(dataDir, 'assets'), { recursive: true });
  const dbPath = join(dataDir, 'library.json');
  try { await stat(dbPath); } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    await writeFile(dbPath, await readFile(join(ROOT, 'seed.json')), { flag: 'wx' });
  }
  let queue = Promise.resolve();
  const read = async () => JSON.parse(await readFile(dbPath, 'utf8'));
  const mutate = fn => {
    const task = queue.then(async () => {
      const db = await read(); const result = await fn(db);
      const temp = `${dbPath}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(db, null, 2)); await rename(temp, dbPath);
      return result;
    });
    queue = task.catch(() => {}); return task;
  };
  const event = (db, type, characterId, assetId = null) => db.events.push({ id: randomUUID(), type, characterId, assetId, at: new Date().toISOString() });
  const server = http.createServer(async (req, res) => {
    const headers = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" };
    const send = (status, value, type = 'application/json') => {
      res.writeHead(status, { ...headers, 'Content-Type': type });
      res.end(type === 'application/json' ? JSON.stringify(value) : value);
    };
    try {
      const expectedHost = `127.0.0.1:${server.address().port}`;
      if (req.headers.host !== expectedHost && req.headers.host !== `localhost:${server.address().port}`) fail(403, 'Untrusted host.');
      const origin = req.headers.origin;
      if (origin && ![`http://${expectedHost}`, `http://localhost:${server.address().port}`].includes(origin)) fail(403, 'Untrusted origin.');
      const url = new URL(req.url, `http://${expectedHost}`);
      const path = url.pathname;
      if (req.method === 'GET' && path === '/api/library') {
        const db = await read();
        return send(200, { ...db, assets: db.assets.map(a => ({ ...a, url: `/media/${a.id}` })) });
      }
      if (req.method === 'POST' && path === '/api/characters') return send(201, await createCharacter({read,mutate},JSON.parse((await body(req,64000)).toString()),'local-owner'));
      if (req.method === 'POST' && path === '/api/render-links') return send(201, await logRender({read,mutate},JSON.parse((await body(req,64000)).toString()),'local-owner'));
      if (req.method === 'POST' && path === '/api/assets') {
        const bytes = await body(req, MAX_IMAGE);
        const ext = imageType(bytes);
        const characterId = text(url.searchParams.get('characterId'), 100);
        const title = text(url.searchParams.get('title') || 'Untitled render', 180);
        const result = await mutate(async db => {
          if (!db.characters.some(c => c.id === characterId)) fail(404, 'Character not found.');
          const sha256 = createHash('sha256').update(bytes).digest('hex');
          if (db.assets.some(a => a.characterId === characterId && a.sha256 === sha256)) fail(409, 'This image is already in this character’s library.');
          const id = randomUUID(); const filename = `${id}.${ext}`;
          await writeFile(join(dataDir, 'assets', filename), bytes, { flag: 'wx' });
          const asset = { id, characterId, title, filename, mime: TYPES[ext], sha256, kind: 'render', status: 'Review', locked: false, createdAt: new Date().toISOString(), metadata: {} };
          db.assets.push(asset); event(db, 'render-uploaded', characterId, id); return asset;
        });
        return send(201, result);
      }
      const assetRoute = path.match(/^\/api\/assets\/([a-zA-Z0-9-]+)$/);
      if (req.method === 'PATCH' && assetRoute) {
        const input = JSON.parse((await body(req, 16000)).toString());
        return send(200, await reviewAsset({read,mutate},assetRoute[1],input,'local-owner'));
      }
      const authorityRoute = path.match(/^\/api\/characters\/([a-z0-9-]+)\/identity-authority$/);
      if (req.method === 'PUT' && authorityRoute) return send(200, await setIdentityAuthorities({read,mutate},authorityRoute[1],JSON.parse((await body(req,16000)).toString()).assignments,'local-owner'));
      const continuumRoute = path.match(/^\/api\/characters\/([a-z0-9-]+)\/continuum-pack$/);
      if (req.method === 'GET' && continuumRoute) return send(200, await buildContinuumPack({read,mutate},continuumRoute[1]));
      const profileRoute = path.match(/^\/api\/characters\/([a-z0-9-]+)$/);
      if (req.method === 'PATCH' && profileRoute) {
        const input = JSON.parse((await body(req, 64000)).toString());
        return send(200, await updateCharacter({read,mutate},profileRoute[1],input,'local-owner'));
      }
      const media = path.match(/^\/media\/([a-zA-Z0-9-]+)$/);
      if (req.method === 'GET' && media) {
        const db = await read(); const asset = db.assets.find(a => a.id === media[1]);
        if (!asset || !/^[a-zA-Z0-9-]+\.(png|jpg|webp)$/.test(asset.filename)) fail(404, 'Image not found.');
        return send(200, await readFile(join(dataDir, 'assets', asset.filename)), asset.mime);
      }
      if (req.method !== 'GET') fail(404, 'Route not found.');
      const staticFiles = { '/app.js': ['app.js', 'text/javascript'], '/site-tools.js': ['site-tools.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
      if (staticFiles[path]) {
        const [file, type] = staticFiles[path]; return send(200, await readFile(join(ROOT, 'public', file)), type);
      }
      if (path === '/' || path === '/characters' || /^\/characters\/[a-z0-9-]+$/.test(path)) return send(200, await readFile(join(ROOT, 'public', 'index.html')), 'text/html');
      fail(404, 'Page not found.');
    } catch (error) {
      const status = error.status || (error instanceof SyntaxError ? 400 : error.code === 'ENOENT' ? 404 : 500);
      if (status === 500) console.error(error);
      send(status, { error: status === 500 ? 'Unable to save or load the library. Try again.' : error.message });
    }
  });
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createApp();
  server.listen(Number(process.env.PORT || 4317), '127.0.0.1', () => console.log(`Vivarium Encyclopedia: http://127.0.0.1:${server.address().port}/characters`));
}
