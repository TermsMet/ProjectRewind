// ProjectRewind backend (Express version)
//
// This server implements a full API for channel and EPG access as well as
// authentication and user management, using Express for routing and static
// file handling. Passwords are hashed with PBKDF2 (salt$hash) and sessions
// are tracked via an HTTP-only cookie containing a signed token. User data
// is persisted to data/users.json and channel/EPG data is fetched on demand.

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const parseM3U = require('./parseM3U');

// -----------------------------------------------------------------------------
// Configuration

const PORT = process.env.PORT || 3000;
const M3U_URL = process.env.M3U_URL;
const EPG_URL = process.env.EPG_URL;
const DATA_DIR = process.env.DB_PATH || path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'projectrewind-secret';

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

// -----------------------------------------------------------------------------
// User persistence and password hashing

function loadUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    const list = JSON.parse(data);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    return [];
  }
}

function saveUsers(users) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function randomString(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

function hashPassword(password, salt) {
  const s = salt || randomString(16);
  const hash = crypto.pbkdf2Sync(password, s, 10000, 64, 'sha512').toString('hex');
  return `${s}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const computed = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
  } catch {
    return false;
  }
}

// token = base64(id:role) + '.' + HMAC_SHA256(payload, COOKIE_SECRET)
function createSessionToken(user) {
  const payload = Buffer.from(`${user.id}:${user.role}`).toString('base64');
  const sig = crypto.createHmac('sha256', COOKIE_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.trim().split('=');
    const name = parts.shift();
    const value = parts.join('=');
    out[name] = decodeURIComponent(value || '');
  });
  return out;
}

function getAuthenticatedUser(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.auth;
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', COOKIE_SECRET).update(payload).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) return null;
  } catch {
    return null;
  }
  let decoded;
  try {
    decoded = Buffer.from(payload, 'base64').toString('utf8');
  } catch {
    return null;
  }
  const [id, role] = decoded.split(':');
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  return { id: user.id, username: user.username, role: user.role };
}

// Ensure default admin exists
function ensureDefaultAdmin() {
  const users = loadUsers();
  const existing = users.find((u) => u.username && u.username.toLowerCase() === 'rewindadmin');
  if (existing) return null;

  // Prefer ADMIN_PASSWORD from environment; if not provided, generate
  // a random password and log it once at startup. Only the hashed
  // value is stored in users.json.
  const envPassword = process.env.ADMIN_PASSWORD;
  let password;

  if (envPassword && String(envPassword).length >= 8) {
    password = String(envPassword);
  } else {
    password = randomString(12);
  }

  const hashed = hashPassword(password);
  const newUser = {
    id: randomString(16),
    username: 'RewindAdmin',
    password: hashed,
    role: 'admin',
    created: Date.now()
  };
  users.push(newUser);
  saveUsers(users);

  // Only return the password (for logging) when we generated it.
  if (!envPassword || String(envPassword).length < 8) {
    return password;
  }
  return null;
}

const defaultAdminPassword = ensureDefaultAdmin();


// -----------------------------------------------------------------------------
// Helper: remote fetch using http/https

function fetchRemote(remoteUrl) {
  return new Promise((resolve, reject) => {
    const mod = remoteUrl.startsWith('https') ? https : http;
    mod
      .get(remoteUrl, (resp) => {
        const { statusCode } = resp;
        if (statusCode && statusCode >= 400) {
          reject(new Error(`HTTP ${statusCode}`));
          resp.resume();
          return;
        }
        resp.setEncoding('utf8');
        let rawData = '';
        resp.on('data', (chunk) => {
          rawData += chunk;
        });
        resp.on('end', () => {
          resolve(rawData);
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

// -----------------------------------------------------------------------------
// Express app setup

const app = express();

// Parse JSON bodies for API routes
app.use(express.json());

// -----------------------------------------------------------------------------
// Auth middlewares

function requireAuth(req, res, next) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// -----------------------------------------------------------------------------
// Auth routes

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false });
  }
  const users = loadUsers();
  const user = users.find(
    (u) => u.username && u.username.toLowerCase() === String(username).toLowerCase()
  );
  if (!user || !verifyPassword(String(password), user.password)) {
    return res.status(200).json({ success: false });
  }
  const token = createSessionToken(user);
  // Set cookie with 7 day expiry (in ms)
  res.cookie('auth', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
  return res.status(200).json({
    success: true,
    user: { id: user.id, username: user.username, role: user.role }
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.cookie('auth', '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
  return res.status(200).json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  return res.status(200).json(user);
});

// -----------------------------------------------------------------------------
// User management routes

// GET /api/users – Admin/Moderator
app.get('/api/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = loadUsers().map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    created: u.created
  }));
  return res.status(200).json(users);
});

// POST /api/users – Admin only
app.post('/api/users', requireAuth, requireRole('admin'), (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const users = loadUsers();
  const exists = users.find(
    (u) => u.username && u.username.toLowerCase() === String(username).toLowerCase()
  );
  if (exists) {
    return res.status(400).json({ error: 'User already exists' });
  }
  const hashed = hashPassword(String(password));
  const newUser = {
    id: randomString(16),
    username: String(username),
    password: hashed,
    role: String(role),
    created: Date.now()
  };
  users.push(newUser);
  saveUsers(users);
  return res.status(200).json({
    id: newUser.id,
    username: newUser.username,
    role: newUser.role,
    created: newUser.created
  });
});

// POST /api/users/:id/password – Admin/Moderator (mods cannot change admin)
app.post(
  '/api/users/:id/password',
  requireAuth,
  requireRole('admin'),
  (req, res) => {
    const targetId = req.params.id;
    const users = loadUsers();
    const target = users.find((u) => u.id === targetId);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (req.user.role === 'moderator' && target.role === 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'Missing password' });
    target.password = hashPassword(String(password));
    saveUsers(users);
    return res.status(200).json({ success: true });
  }
);

// DELETE /api/users/:id – Admin only, cannot delete RewindAdmin
app.delete('/api/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const targetId = req.params.id;
  let users = loadUsers();
  const target = users.find((u) => u.id === targetId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.username && target.username.toLowerCase() === 'rewindadmin') {
    return res.status(403).json({ error: 'Cannot delete default admin' });
  }
  users = users.filter((u) => u.id !== targetId);
  saveUsers(users);
  return res.status(200).json({ success: true });
});

// Optional: change role
app.post('/api/users/:id/role', requireAuth, requireRole('admin'), (req, res) => {
  const targetId = req.params.id;
  const { role } = req.body || {};
  if (!role) return res.status(400).json({ error: 'Missing role' });
  const users = loadUsers();
  const target = users.find((u) => u.id === targetId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  target.role = String(role);
  saveUsers(users);
  return res.status(200).json({ success: true });
});

// -----------------------------------------------------------------------------
// Channels and EPG routes (auth required)

// GET /api/channels
app.get('/api/channels', requireAuth, async (req, res) => {
  // Prefer explicit ?url=, then M3U_URL env, then bundled sample.m3u
  const fallbackPath = `file://${path.join(__dirname, '..', 'sample.m3u')}`;
  const playlistUrl = req.query.url || M3U_URL || fallbackPath;
  try {
    let text;
    if (playlistUrl.startsWith('file://')) {
      const filePath = playlistUrl.slice('file://'.length);
      text = fs.readFileSync(filePath, 'utf8');
    } else {
      text = await fetchRemote(playlistUrl);
    }
    const channels = parseM3U(text);
    channels.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json(channels);
  } catch (err) {
    console.error('Failed to load channels', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// GET /api/epg
app.get('/api/epg', requireAuth, async (req, res) => {
  // Prefer explicit ?url=, then EPG_URL env, then bundled sample-epg.xml
  const fallbackPath = `file://${path.join(__dirname, '..', 'sample-epg.xml')}`;
  const epgUrl = req.query.url || EPG_URL || fallbackPath;
  try {
    let xml;
    if (epgUrl.startsWith('file://')) {
      const filePath = epgUrl.slice('file://'.length);
      xml = fs.readFileSync(filePath, 'utf8');
    } else {
      xml = await fetchRemote(epgUrl);
    }
    res.status(200).type('text/xml').send(xml);
  } catch (err) {
    console.error('Failed to load EPG', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// -----------------------------------------------------------------------------
// Proxy streaming (no auth required)

app.get('/proxy', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }
  const mod = String(targetUrl).startsWith('https') ? https : http;
  mod
    .get(targetUrl, (streamRes) => {
      res.status(streamRes.statusCode || 200);
      for (const [key, value] of Object.entries(streamRes.headers)) {
        try {
          if (typeof value !== 'undefined') res.setHeader(key, value);
        } catch {
          // ignore invalid headers
        }
      }
      streamRes.pipe(res);
    })
    .on('error', (err) => {
      if (res.headersSent) return;
      res.status(500).send('Proxy error: ' + err.message);
    });
});

// -----------------------------------------------------------------------------
// Static frontend

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// SPA fallback – serve index.html for any other GET route
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// -----------------------------------------------------------------------------
// Start server

app.listen(PORT, () => {
  console.log(`ProjectRewind backend (Express) listening on http://localhost:${PORT}`);
  if (defaultAdminPassword) {
    console.log(`Default admin password: ${defaultAdminPassword}`);
  }
});

