const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// CORS headers for GitHub Pages frontend
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
const CARS_FILE = path.join(DATA_DIR, 'cars.json');
const SOLD_CARS_FILE = path.join(DATA_DIR, 'sold_cars.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const TEXT_FILE = path.join(DATA_DIR, 'text.json');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper functions
function readJSON(filePath, defaultVal) {
  try {
    if (!fs.existsSync(filePath)) return defaultVal;
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return defaultVal;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Initialize data files if they don't exist
function initDataFile(filePath, defaultData) {
  if (!fs.existsSync(filePath)) {
    writeJSON(filePath, defaultData);
  }
}

initDataFile(CARS_FILE, []);
initDataFile(SOLD_CARS_FILE, []);
initDataFile(SETTINGS_FILE, {
  fb_url: "https://www.facebook.com/share/1DzPe8NNxo/?mibextid=wwXIfr",
  at_url: "#",
  wa_url: "https://wa.me/447891237204",
  ig_url: "https://www.instagram.com/speedbun",
  tt_url: "https://www.tiktok.com/@speedbuncars"
});
initDataFile(TEXT_FILE, {});
initDataFile(ADMIN_FILE, {
  username: "imranadmin",
  password: "Admin1234!"
});
initDataFile(SESSIONS_FILE, {});

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const sessions = readJSON(SESSIONS_FILE, {});
  if (!sessions[token]) return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  next();
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const admin = readJSON(ADMIN_FILE, { username: 'imranadmin', password: 'Admin1234!' });
  if (username === admin.username && password === admin.password) {
    const token = 'sb_' + crypto.randomBytes(32).toString('hex');
    const sessions = readJSON(SESSIONS_FILE, {});
    sessions[token] = { username, createdAt: Date.now() };
    writeJSON(SESSIONS_FILE, sessions);
    return res.json({ ok: true, token });
  }
  res.status(401).json({ ok: false, error: 'Invalid credentials' });
});

// Logout
app.post('/api/logout', requireAdmin, (req, res) => {
  const token = req.headers['x-admin-token'];
  const sessions = readJSON(SESSIONS_FILE, {});
  delete sessions[token];
  writeJSON(SESSIONS_FILE, sessions);
  res.json({ ok: true });
});

// Update admin credentials
app.post('/api/admin/credentials', requireAdmin, (req, res) => {
  const { newUser, newPass } = req.body || {};
  const admin = readJSON(ADMIN_FILE, { username: 'imranadmin', password: 'Admin1234!' });
  if (newUser) admin.username = newUser;
  if (newPass) admin.password = newPass;
  writeJSON(ADMIN_FILE, admin);
  res.json({ ok: true });
});

// ─── TEXT ROUTES ──────────────────────────────────────────────────────────────

// Get all editable text
app.get('/api/text', (req, res) => {
  const texts = readJSON(TEXT_FILE, {});
  res.json(texts);
});

// Save editable text (admin only)
app.post('/api/text', requireAdmin, (req, res) => {
  const { texts } = req.body || {};
  if (!texts || typeof texts !== 'object') {
    return res.status(400).json({ ok: false, error: 'texts object required' });
  }
  const existing = readJSON(TEXT_FILE, {});
  const merged = { ...existing, ...texts };
  writeJSON(TEXT_FILE, merged);
  res.json({ ok: true, data: merged });
});

// ─── SETTINGS ROUTES ─────────────────────────────────────────────────────────

// Get site settings
app.get('/api/settings', (req, res) => {
  const settings = readJSON(SETTINGS_FILE, {});
  res.json(settings);
});

// Update site settings (admin only)
app.post('/api/settings', requireAdmin, (req, res) => {
  const settings = readJSON(SETTINGS_FILE, {});
  const updated = { ...settings, ...req.body };
  writeJSON(SETTINGS_FILE, updated);
  res.json({ ok: true, data: updated });
});

app.put('/api/settings', requireAdmin, (req, res) => {
  const settings = readJSON(SETTINGS_FILE, {});
  const updated = { ...settings, ...req.body };
  writeJSON(SETTINGS_FILE, updated);
  res.json({ ok: true, data: updated });
});

// ─── CARS ROUTES ──────────────────────────────────────────────────────────────

// Get all active cars
app.get('/api/cars', (req, res) => {
  const cars = readJSON(CARS_FILE, []);
  res.json(cars.filter(c => !c.sold));
});

// Get car by ID
app.get('/api/cars/:id', (req, res) => {
  const cars = readJSON(CARS_FILE, []);
  const car = cars.find(c => String(c.id) === String(req.params.id));
  if (car) {
    res.json(car);
  } else {
    res.status(404).json({ ok: false, error: 'Car not found' });
  }
});

// Create new car
app.post('/api/cars', requireAdmin, (req, res) => {
  const cars = readJSON(CARS_FILE, []);
  const newCar = {
    id: Date.now(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  cars.push(newCar);
  writeJSON(CARS_FILE, cars);
  res.json({ ok: true, data: newCar });
});

// Update car
app.put('/api/cars/:id', requireAdmin, (req, res) => {
  const cars = readJSON(CARS_FILE, []);
  const index = cars.findIndex(c => String(c.id) === String(req.params.id));
  if (index !== -1) {
    cars[index] = { ...cars[index], ...req.body, updatedAt: new Date().toISOString() };
    writeJSON(CARS_FILE, cars);
    res.json({ ok: true, data: cars[index] });
  } else {
    res.status(404).json({ ok: false, error: 'Car not found' });
  }
});

// Delete car
app.delete('/api/cars/:id', requireAdmin, (req, res) => {
  const cars = readJSON(CARS_FILE, []);
  const filteredCars = cars.filter(c => String(c.id) !== String(req.params.id));
  writeJSON(CARS_FILE, filteredCars);
  res.json({ ok: true });
});

// Mark car as sold
app.post('/api/cars/:id/sold', requireAdmin, (req, res) => {
  const cars = readJSON(CARS_FILE, []);
  const soldCars = readJSON(SOLD_CARS_FILE, []);
  const index = cars.findIndex(c => String(c.id) === String(req.params.id));

  if (index !== -1) {
    const soldCar = { ...cars[index], soldAt: new Date().toISOString(), sold: 1 };
    soldCars.push(soldCar);
    cars.splice(index, 1);
    writeJSON(CARS_FILE, cars);
    writeJSON(SOLD_CARS_FILE, soldCars);
    res.json({ ok: true, data: soldCar });
  } else {
    res.status(404).json({ ok: false, error: 'Car not found' });
  }
});

// ─── SOLD CARS ROUTES ─────────────────────────────────────────────────────────

// Get all sold cars
app.get('/api/sold-cars', (req, res) => {
  const soldCars = readJSON(SOLD_CARS_FILE, []);
  res.json(soldCars);
});

// ─── ENQUIRY ROUTE ────────────────────────────────────────────────────────────

app.post('/api/enquiry', (req, res) => {
  // Just acknowledge — no email sending in this version
  console.log('Enquiry received:', req.body);
  res.json({ ok: true, message: 'Enquiry received' });
});

// ─── REMOVE BG STUB ──────────────────────────────────────────────────────────

app.post('/api/remove-bg', (req, res) => {
  res.status(501).json({ ok: false, error: 'Background removal not configured' });
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'SpeedBun backend running', time: new Date().toISOString() });
});

// ─── SAVE ALL (bulk) ─────────────────────────────────────────────────────────

app.post('/api/save-all', requireAdmin, (req, res) => {
  const { cars, soldCars, settings } = req.body;
  if (cars !== undefined) writeJSON(CARS_FILE, cars);
  if (soldCars !== undefined) writeJSON(SOLD_CARS_FILE, soldCars);
  if (settings !== undefined) writeJSON(SETTINGS_FILE, settings);
  res.json({ ok: true, message: 'Data saved successfully' });
});

// ─── FALLBACK ─────────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SpeedBun server running on port ${PORT}`);
});
