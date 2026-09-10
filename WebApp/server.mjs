import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 4173);
const root = new URL('./public/', import.meta.url);
const python = fileURLToPath(new URL('./.venv/bin/python3', import.meta.url));
const scanner = fileURLToPath(new URL('./ble/scan_microbits.py', import.meta.url));
const bridgeScript = fileURLToPath(new URL('./ble/ble_bridge.py', import.meta.url));
const bridges = new Map();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function activeBridges() {
  for (const [address, connection] of bridges) {
    const child = connection.child;
    if (!child || child.exitCode !== null || child.signalCode !== null || !child.stdin.writable) {
      bridges.delete(address);
    }
  }
  return [...bridges.values()];
}

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

async function body(req) {
  let text = '';
  for await (const chunk of req) text += chunk;
  return text ? JSON.parse(text) : {};
}

function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || `終了コード ${code}`)));
  });
}

function connectBridge(address) {
  return new Promise((resolve, reject) => {
    const existing = bridges.get(address);
    if (existing?.child?.stdin.writable && existing.bobId >= 0 && existing.bobId <= 3) {
      resolve(existing);
      return;
    }
    existing?.child?.kill();
    const child = spawn(python, [bridgeScript, '--address', address]);
    const connection = { address, child, bobId: 99 };
    let settled = false;
    let ready = false;
    let stdout = '';
    const timeout = setTimeout(() => fail(new Error('BOB2のID設定待ちがタイムアウトしました')), 60000);
    const fail = error => {
      if (settled) return;
      settled = true; clearTimeout(timeout); child.kill(); bridges.delete(address); reject(error);
    };
    child.on('error', fail);
    child.stderr.on('data', chunk => { if (!settled) fail(new Error(String(chunk).trim())); else console.error(String(chunk).trim()); });
    child.stdout.on('data', chunk => {
      stdout += String(chunk);
      const lines = stdout.split(/\r?\n/);
      stdout = lines.pop();
      for (const line of lines) {
        if (line === 'READY') ready = true;
        const idMatch = line.match(/^EVENT ID,(99|[0-3])$/);
        if (!idMatch) continue;
        const nextId = Number(idMatch[1]);
        const duplicate = [...bridges.values()].find(item => item !== connection && item.bobId === nextId && nextId !== 99);
        if (duplicate) {
          if (!settled) fail(new Error(`BOB ID ${nextId}は別のmicro:bitで使用中です`));
          continue;
        }
        connection.bobId = nextId;
        if (!settled && ready && nextId !== 99) {
          settled = true; clearTimeout(timeout); bridges.set(address, connection); resolve(connection);
        }
      }
    });
    child.on('close', () => { if (bridges.get(address)?.child === child) bridges.delete(address); if (!settled) fail(new Error('BOB2への接続が終了しました')); });
  });
}

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  try {
    if (pathname === '/api/ble/scan' && req.method === 'GET') {
      const output = await capture(python, [scanner]);
      return json(res, 200, { devices: JSON.parse(output) });
    }
    if (pathname === '/api/ble/connect' && req.method === 'POST') {
      const { address } = await body(req);
      if (!address) return json(res, 400, { error: 'addressが必要です' });
      const connection = await connectBridge(address);
      return json(res, 200, { ok: true, id: connection.bobId, address });
    }
    if (pathname === '/api/ble/send' && req.method === 'POST') {
      const { id, command } = await body(req);
      const connection = activeBridges().find(item => item.bobId === id);
      const child = connection?.child;
      if (!child?.stdin.writable) return json(res, 409, { error: `BOB-${id + 1}は未接続です` });
      child.stdin.write(String(command) + '\n');
      return json(res, 200, { ok: true });
    }
    if (pathname === '/api/ble/status' && req.method === 'GET') {
      return json(res, 200, { devices: activeBridges().map(({ address, bobId }) => ({ address, id: bobId })) });
    }
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
  const relative = pathname === '/' ? 'index.html' : normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^\//, '');
  try {
    const data = await readFile(new URL(relative, root));
    res.writeHead(200, { 'content-type': types[extname(relative)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Odoryanya Controller: http://localhost:${port}`));
