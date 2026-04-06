const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
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

// ─── PERSISTENT DATA DIRECTORY ───────────────────────────────────────────────
// Railway provides a persistent volume mounted at /data (configured in Railway dashboard).
// Falls back to local ./data directory for development.
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH)
  : path.join(__dirname, 'data');

const CARS_FILE      = path.join(DATA_DIR, 'cars.json');
const SOLD_CARS_FILE = path.join(DATA_DIR, 'sold_cars.json');
const SETTINGS_FILE  = path.join(DATA_DIR, 'settings.json');
const TEXT_FILE      = path.join(DATA_DIR, 'text.json');
const ADMIN_FILE     = path.join(DATA_DIR, 'admin.json');
const SESSIONS_FILE  = path.join(DATA_DIR, 'sessions.json');

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
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('writeJSON error:', filePath, err.message);
  }
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

// ─── EMAIL SETUP ──────────────────────────────────────────────────────────────
// Configure via Railway environment variables:
//   EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
// Falls back to Gmail SMTP if EMAIL_HOST not set (requires EMAIL_USER + EMAIL_PASS).
function createTransporter() {
  const host = process.env.EMAIL_HOST || process.env.MAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn('⚠ Email not configured — set EMAIL_USER and EMAIL_PASS env vars in Railway');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
}

const ENQUIRY_TO = process.env.ENQUIRY_EMAIL || 'imi1981@gmail.com';

async function sendEnquiryEmail(data) {
  const transporter = createTransporter();
  if (!transporter) return false;

  const { name, email, phone, car, message } = data;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f8fb;padding:30px;border-radius:12px">
      <div style="background:#1a4d6b;padding:20px 30px;border-radius:8px 8px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:0.05em">Speed Bun — New Enquiry</h1>
        <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:13px">Solihull, Birmingham, UK</p>
      </div>
      <div style="background:#fff;padding:28px 30px;border-radius:0 0 8px 8px;border:1px solid #dde8f0;border-top:none">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#666;font-size:13px;width:130px">Name</td>
              <td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#1a1a2e;font-weight:600">${name || 'N/A'}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#666;font-size:13px">Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#1a4d6b;font-weight:600"><a href="mailto:${email}" style="color:#1a4d6b">${email || 'N/A'}</a></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#666;font-size:13px">Phone</td>
              <td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#1a1a2e;font-weight:600">${phone || 'N/A'}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#666;font-size:13px">Vehicle</td>
              <td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#1a1a2e;font-weight:600">${car || 'Not specified'}</td></tr>
          <tr><td style="padding:10px 0;color:#666;font-size:13px;vertical-align:top">Message</td>
              <td style="padding:10px 0;color:#1a1a2e">${(message || 'No message provided').replace(/\n/g, '<br>')}</td></tr>
        </table>
        <div style="margin-top:24px;padding:16px;background:#f0f7ff;border-radius:8px;border-left:4px solid #1a4d6b">
          <p style="margin:0;font-size:12px;color:#666">Received: ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</p>
        </div>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Speed Bun Enquiries" <${process.env.EMAIL_USER}>`,
      to: ENQUIRY_TO,
      subject: `New Enquiry from ${name || 'Website Visitor'} — Speed Bun`,
      html,
      text: `New enquiry from ${name}\nEmail: ${email}\nPhone: ${phone}\nVehicle: ${car}\nMessage: ${message}`
    });
    console.log('✅ Enquiry email sent to', ENQUIRY_TO);
    return true;
  } catch (err) {
    console.error('❌ Email send failed:', err.message);
    return false;
  }
}

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

app.post('/api/enquiry', async (req, res) => {
  const { name, email, phone, car, message } = req.body || {};
  console.log('Enquiry received:', { name, email, phone, car });

  // Send email notification
  const emailSent = await sendEnquiryEmail({ name, email, phone, car, message });

  res.json({
    ok: true,
    message: 'Enquiry received',
    emailSent
  });
});

// ─── REMOVE BG STUB ──────────────────────────────────────────────────────────

app.post('/api/remove-bg', (req, res) => {
  res.status(501).json({ ok: false, error: 'Background removal not configured' });
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'SpeedBun backend running',
    time: new Date().toISOString(),
    dataDir: DATA_DIR,
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
  });
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
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Email configured: ${!!(process.env.EMAIL_USER && process.env.EMAIL_PASS)}`);
});
