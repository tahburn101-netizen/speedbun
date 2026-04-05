// SpeedBun Backend API Integration
// This file connects your HTML to the backend database

// API URL - uses same origin in production, localhost in development
const API_URL = window.location.origin.includes('localhost') 
  ? 'http://localhost:3000/api' 
  : `${window.location.origin}/api`;

// Fetch cars from backend API
async function fetchCarsFromAPI() {
  try {
    // Get active cars
    const activeResponse = await fetch(`${API_URL}/cars`);
    const activeData = await activeResponse.json();
    const activeCars = activeData.data || [];
    
    // Get sold cars
    const soldResponse = await fetch(`${API_URL}/sold-cars`);
    const soldData = await soldResponse.json();
    const soldCars = soldData.data || [];
    
    return { active: activeCars, sold: soldCars };
  } catch (error) {
    console.error('Error fetching cars from API:', error);
    return { active: [], sold: [] };
  }
}

// Save car to backend
async function saveCarToBackend(carData) {
  try {
    const url = carData.id 
      ? `${API_URL}/cars/${carData.id}`
      : `${API_URL}/cars`;
    
    const method = carData.id ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(carData)
    });
    
    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error('Error saving car:', error);
    return null;
  }
}

// Delete car from backend
async function deleteCarFromBackend(carId) {
  try {
    const response = await fetch(`${API_URL}/cars/${carId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error deleting car:', error);
    return false;
  }
}

// Mark car as sold via API
async function markCarAsSold(carId) {
  try {
    const response = await fetch(`${API_URL}/cars/${carId}/sold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Reload cars from API
      await loadCarsFromBackend();
      return true;
    }
  } catch (error) {
    console.error('Error marking car as sold:', error);
  }
  return false;
}

// Save site settings to backend
async function saveSettingsToBackend(settings) {
  try {
    const response = await fetch(`${API_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    
    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error('Error saving settings:', error);
    return null;
  }
}

// Load settings from backend
async function loadSettingsFromBackend() {
  try {
    const response = await fetch(`${API_URL}/settings`);
    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
}

// Replace the hardcoded cars array with API data
async function loadCarsFromBackend() {
  const { active, sold } = await fetchCarsFromAPI();
  
  // If no data from backend, use initial seed data
  if (active.length === 0 && typeof INITIAL_CARS !== 'undefined') {
    // Seed the backend with initial data
    for (const car of INITIAL_CARS) {
      if (!car.excludeFromHero) {
        await saveCarToBackend(car);
      }
    }
    // Reload after seeding
    const { active: reloadedActive } = await fetchCarsFromAPI();
    window.cars = reloadedActive;
  } else {
    window.cars = active;
  }
  
  window.soldCars = sold;
  
  // Rebuild UI
  if (typeof buildHero === 'function') buildHero();
  if (typeof renderShowroom === 'function') renderShowroom();
  if (typeof renderFeatured === 'function') renderFeatured();
  if (typeof fillSelect === 'function') fillSelect();
  if (typeof renderSoldCarousel === 'function') renderSoldCarousel();
}

// Save all data (for admin panel)
async function saveAllData(cars, soldCars, settings) {
  try {
    const response = await fetch(`${API_URL}/save-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cars, soldCars, settings })
    });
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error saving all data:', error);
    return false;
  }
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
  fetchCars: fetchCarsFromAPI,
  saveCar: saveCarToBackend,
  deleteCar: deleteCarFromBackend,
  markAsSold: markCarAsSold,
  saveSettings: saveSettingsToBackend,
  loadSettings: loadSettingsFromBackend,
  loadCars: loadCarsFromBackend,
  saveAll: saveAllData
};
