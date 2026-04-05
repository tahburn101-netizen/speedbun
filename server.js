const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
const CARS_FILE = path.join(DATA_DIR, 'cars.json');
const SOLD_CARS_FILE = path.join(DATA_DIR, 'sold_cars.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize data files if they don't exist
function initDataFile(filePath, defaultData) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

initDataFile(CARS_FILE, []);
initDataFile(SOLD_CARS_FILE, []);
initDataFile(SETTINGS_FILE, {
  facebook: "https://www.facebook.com/share/1DzPe8NNxo/?mibextid=wwXIfr",
  autotrader: "#",
  whatsapp: "https://wa.me/447891237204",
  instagram: "https://www.instagram.com/speedbun",
  tiktok: "https://www.tiktok.com/@speedbuncars"
});

// Helper functions
function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// API Routes

// Get all active cars
app.get('/api/cars', (req, res) => {
  const cars = readJSON(CARS_FILE);
  res.json({ success: true, data: cars });
});

// Get car by ID
app.get('/api/cars/:id', (req, res) => {
  const cars = readJSON(CARS_FILE);
  const car = cars.find(c => c.id === parseInt(req.params.id));
  if (car) {
    res.json({ success: true, data: car });
  } else {
    res.status(404).json({ success: false, error: 'Car not found' });
  }
});

// Create new car
app.post('/api/cars', (req, res) => {
  const cars = readJSON(CARS_FILE);
  const newCar = {
    id: Date.now(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  cars.push(newCar);
  writeJSON(CARS_FILE, cars);
  res.json({ success: true, data: newCar });
});

// Update car
app.put('/api/cars/:id', (req, res) => {
  const cars = readJSON(CARS_FILE);
  const index = cars.findIndex(c => c.id === parseInt(req.params.id));
  if (index !== -1) {
    cars[index] = { ...cars[index], ...req.body, updatedAt: new Date().toISOString() };
    writeJSON(CARS_FILE, cars);
    res.json({ success: true, data: cars[index] });
  } else {
    res.status(404).json({ success: false, error: 'Car not found' });
  }
});

// Delete car
app.delete('/api/cars/:id', (req, res) => {
  const cars = readJSON(CARS_FILE);
  const filteredCars = cars.filter(c => c.id !== parseInt(req.params.id));
  writeJSON(CARS_FILE, filteredCars);
  res.json({ success: true });
});

// Mark car as sold
app.post('/api/cars/:id/sold', (req, res) => {
  const cars = readJSON(CARS_FILE);
  const soldCars = readJSON(SOLD_CARS_FILE);
  const index = cars.findIndex(c => c.id === parseInt(req.params.id));
  
  if (index !== -1) {
    const soldCar = { ...cars[index], soldAt: new Date().toISOString(), sold: 1 };
    soldCars.push(soldCar);
    cars.splice(index, 1);
    
    writeJSON(CARS_FILE, cars);
    writeJSON(SOLD_CARS_FILE, soldCars);
    
    res.json({ success: true, data: soldCar });
  } else {
    res.status(404).json({ success: false, error: 'Car not found' });
  }
});

// Get all sold cars
app.get('/api/sold-cars', (req, res) => {
  const soldCars = readJSON(SOLD_CARS_FILE);
  res.json({ success: true, data: soldCars });
});

// Get site settings
app.get('/api/settings', (req, res) => {
  const settings = readJSON(SETTINGS_FILE);
  res.json({ success: true, data: settings });
});

// Update site settings
app.put('/api/settings', (req, res) => {
  const settings = readJSON(SETTINGS_FILE);
  const updatedSettings = { ...settings, ...req.body };
  writeJSON(SETTINGS_FILE, updatedSettings);
  res.json({ success: true, data: updatedSettings });
});

// Save all data (bulk update)
app.post('/api/save-all', (req, res) => {
  const { cars, soldCars, settings } = req.body;
  
  if (cars !== undefined) writeJSON(CARS_FILE, cars);
  if (soldCars !== undefined) writeJSON(SOLD_CARS_FILE, soldCars);
  if (settings !== undefined) writeJSON(SETTINGS_FILE, settings);
  
  res.json({ success: true, message: 'Data saved successfully' });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SpeedBun server running on port ${PORT}`);
});
