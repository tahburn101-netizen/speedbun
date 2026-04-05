// SpeedBun Backend API Integration
// Uses GitHub API to persist data directly in the repository

// GitHub API configuration
const GITHUB_OWNER = "tahburn101-netizen";
const GITHUB_REPO = "speedbun";
const DATA_BRANCH = "main";

// Data file paths in the repo
const CARS_FILE = "data/cars.json";
const SOLD_CARS_FILE = "data/sold_cars.json";
const SETTINGS_FILE = "data/settings.json";

// In-memory cache
let carsCache = null;
let soldCarsCache = null;
let settingsCache = null;

// Helper: Get file content from GitHub
try {
  // Try to load from window.INITIAL_CARS if available
  if (typeof window.INITIAL_CARS !== 'undefined') {
    carsCache = JSON.parse(JSON.stringify(window.INITIAL_CARS.filter(c => !c.excludeFromHero)));
  }
} catch (e) {
  console.log('INITIAL_CARS not available');
}

// Fetch file content from GitHub
async function fetchGitHubFile(path) {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${DATA_BRANCH}/${path}?t=${Date.now()}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log(`File ${path} not found or error:`, error);
  }
  return null;
}

// Load all data from GitHub
async function loadDataFromGitHub() {
  try {
    // Try to load from GitHub
    const [carsData, soldCarsData, settingsData] = await Promise.all([
      fetchGitHubFile(CARS_FILE),
      fetchGitHubFile(SOLD_CARS_FILE),
      fetchGitHubFile(SETTINGS_FILE)
    ]);
    
    if (carsData && carsData.length > 0) {
      carsCache = carsData;
    }
    if (soldCarsData) {
      soldCarsCache = soldCarsData;
    }
    if (settingsData) {
      settingsCache = settingsData;
    }
    
    // If no data from GitHub, use initial data
    if (!carsCache && typeof window.INITIAL_CARS !== 'undefined') {
      carsCache = JSON.parse(JSON.stringify(window.INITIAL_CARS.filter(c => !c.excludeFromHero)));
    }
    if (!soldCarsCache) {
      soldCarsCache = [];
    }
    if (!settingsCache) {
      settingsCache = {
        facebook: "https://www.facebook.com/share/1DzPe8NNxo/?mibextid=wwXIfr",
        autotrader: "#",
        whatsapp: "https://wa.me/447891237204",
        instagram: "https://www.instagram.com/speedbun",
        tiktok: "https://www.tiktok.com/@speedbuncars"
      };
    }
    
    return {
      cars: carsCache,
      soldCars: soldCarsCache,
      settings: settingsCache
    };
  } catch (error) {
    console.error('Error loading data from GitHub:', error);
    return {
      cars: carsCache || [],
      soldCars: soldCarsCache || [],
      settings: settingsCache || {}
    };
  }
}

// Save data to GitHub (requires admin authentication)
async function saveDataToGitHub(path, data, message) {
  // Check if user is admin
  const isAdmin = localStorage.getItem('speedbun_is_admin') === 'true';
  const adminToken = localStorage.getItem('speedbun_admin_token');
  
  if (!isAdmin || !adminToken) {
    console.log('Admin authentication required to save data');
    return false;
  }
  
  try {
    // Get current file SHA
    const getResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
      {
        headers: {
          'Authorization': `token ${adminToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    let sha = null;
    if (getResponse.status === 200) {
      const fileData = await getResponse.json();
      sha = fileData.sha;
    }
    
    // Create or update file
    const content = btoa(JSON.stringify(data, null, 2));
    const body = {
      message: message,
      content: content,
      branch: DATA_BRANCH
    };
    
    if (sha) {
      body.sha = sha;
    }
    
    const putResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${adminToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    
    if (putResponse.status === 200 || putResponse.status === 201) {
      console.log(`Successfully saved ${path}`);
      return true;
    } else {
      const error = await putResponse.json();
      console.error('Error saving to GitHub:', error);
      return false;
    }
  } catch (error) {
    console.error('Error saving data to GitHub:', error);
    return false;
  }
}

// Save all data (for admin panel)
async function saveAllData(cars, soldCars, settings) {
  const results = await Promise.all([
    saveDataToGitHub(CARS_FILE, cars, 'Update cars data'),
    saveDataToGitHub(SOLD_CARS_FILE, soldCars, 'Update sold cars data'),
    saveDataToGitHub(SETTINGS_FILE, settings, 'Update site settings')
  ]);
  
  // Update cache
  if (results[0]) carsCache = cars;
  if (results[1]) soldCarsCache = soldCars;
  if (results[2]) settingsCache = settings;
  
  return results.every(r => r);
}

// Save a single car
async function saveCar(carData) {
  const cars = carsCache || [];
  const index = cars.findIndex(c => c.id === carData.id);
  
  if (index !== -1) {
    cars[index] = { ...cars[index], ...carData, updatedAt: new Date().toISOString() };
  } else {
    carData.id = carData.id || Date.now();
    carData.createdAt = new Date().toISOString();
    cars.push(carData);
  }
  
  const success = await saveDataToGitHub(CARS_FILE, cars, `Update car: ${carData.make} ${carData.model}`);
  if (success) {
    carsCache = cars;
  }
  return success ? carData : null;
}

// Delete a car
async function deleteCar(carId) {
  const cars = carsCache || [];
  const filteredCars = cars.filter(c => c.id !== carId);
  
  const success = await saveDataToGitHub(CARS_FILE, filteredCars, `Delete car ID: ${carId}`);
  if (success) {
    carsCache = filteredCars;
  }
  return success;
}

// Mark car as sold
async function markCarAsSold(carId) {
  const cars = carsCache || [];
  const soldCars = soldCarsCache || [];
  
  const carIndex = cars.findIndex(c => c.id === carId);
  if (carIndex === -1) return false;
  
  const soldCar = { 
    ...cars[carIndex], 
    soldAt: new Date().toISOString(), 
    sold: 1 
  };
  
  soldCars.push(soldCar);
  cars.splice(carIndex, 1);
  
  const results = await Promise.all([
    saveDataToGitHub(CARS_FILE, cars, `Move car to sold: ${soldCar.make} ${soldCar.model}`),
    saveDataToGitHub(SOLD_CARS_FILE, soldCars, `Add sold car: ${soldCar.make} ${soldCar.model}`)
  ]);
  
  if (results.every(r => r)) {
    carsCache = cars;
    soldCarsCache = soldCars;
    return true;
  }
  return false;
}

// Save settings
async function saveSettings(settings) {
  const success = await saveDataToGitHub(SETTINGS_FILE, settings, 'Update site settings');
  if (success) {
    settingsCache = settings;
  }
  return success;
}

// Load cars from backend (GitHub)
async function loadCarsFromBackend() {
  const data = await loadDataFromGitHub();
  
  window.cars = data.cars || [];
  window.soldCars = data.soldCars || [];
  
  // Rebuild UI
  if (typeof buildHero === 'function') buildHero();
  if (typeof renderShowroom === 'function') renderShowroom();
  if (typeof renderFeatured === 'function') renderFeatured();
  if (typeof fillSelect === 'function') fillSelect();
  if (typeof renderSoldCarousel === 'function') renderSoldCarousel();
  
  return data;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Only load from backend if not in edit mode
  if (typeof isEditMode === 'undefined' || !isEditMode) {
    loadCarsFromBackend();
  }
});

// Export functions for use in other scripts
window.API = {
  loadData: loadDataFromGitHub,
  saveCar: saveCar,
  deleteCar: deleteCar,
  markAsSold: markCarAsSold,
  saveSettings: saveSettings,
  loadCars: loadCarsFromBackend,
  saveAll: saveAllData
};
