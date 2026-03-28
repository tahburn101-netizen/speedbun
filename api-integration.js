// SpeedBun Backend API Integration
// This file connects your HTML to the backend database

const API_URL = 'https://3000-ie10sdpqanacxj7touxte-455c4071.us2.manus.computer/api/trpc';

// Fetch cars from backend API
async function fetchCarsFromAPI() {
  try {
    // Get active cars
    const activeResponse = await fetch(`${API_URL}/cars.getActive?input={}`);
    const activeData = await activeResponse.json();
    const activeCars = activeData.result?.data || [];
    
    // Get sold cars
    const soldResponse = await fetch(`${API_URL}/cars.getSold?input={}`);
    const soldData = await soldResponse.json();
    const soldCars = soldData.result?.data || [];
    
    // Convert API format to your format
    const convertedActive = activeCars.map(car => ({
      id: car.id,
      make: car.make,
      model: car.model,
      name: `${car.make} ${car.model}`,
      year: car.year,
      miles: car.mileage,
      price: car.price,
      fuel: car.fuel || 'N/A',
      trans: car.transmission || 'N/A',
      color: car.color || 'N/A',
      hp: car.horsepower || 'N/A',
      seats: car.seats || '5',
      range: car.range || 'N/A',
      desc: car.description || 'Premium vehicle',
      heroImg: car.heroImg || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3C/svg%3E',
      sold: 0
    }));
    
    const convertedSold = soldCars.map(car => ({
      ...convertedActive.find(c => c.id === car.id) || {
        id: car.id,
        make: car.make,
        model: car.model,
        name: `${car.make} ${car.model}`,
        year: car.year,
        miles: car.mileage,
        price: car.price,
        fuel: car.fuel || 'N/A',
        trans: car.transmission || 'N/A',
        color: car.color || 'N/A',
        hp: car.horsepower || 'N/A',
        seats: car.seats || '5',
        range: car.range || 'N/A',
        desc: car.description || 'Premium vehicle',
        heroImg: car.heroImg || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3C/svg%3E',
      },
      sold: 1
    }));
    
    return { active: convertedActive, sold: convertedSold };
  } catch (error) {
    console.error('Error fetching cars from API:', error);
    return { active: [], sold: [] };
  }
}

// Replace the hardcoded cars array with API data
async function loadCarsFromBackend() {
  const { active, sold } = await fetchCarsFromAPI();
  
  // Replace global cars array
  window.cars = active;
  window.soldCars = sold;
  
  // Rebuild UI
  if (typeof buildHero === 'function') buildHero();
  if (typeof renderShowroom === 'function') renderShowroom();
  if (typeof renderFeatured === 'function') renderFeatured();
  if (typeof fillSelect === 'function') fillSelect();
}

// Mark car as sold via API
async function markCarAsSold(carId, isSold) {
  try {
    const response = await fetch(`${API_URL}/cars.markSold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: carId, sold: isSold })
    });
    
    if (response.ok) {
      // Reload cars from API
      await loadCarsFromBackend();
      return true;
    }
  } catch (error) {
    console.error('Error marking car as sold:', error);
  }
  return false;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadCarsFromBackend);

// Open admin dashboard
function openAdminDashboard() {
  window.location.href = 'https://speedbun-dash-nxdsrzs7.manus.space/';
}

// Check if user is admin and show admin button
function checkAdminStatus() {
  const adminBtn = document.getElementById('adminBtn');
  if (!adminBtn) return;
  
  // Check if user is logged in and is admin
  const isAdmin = localStorage.getItem('speedbun_is_admin') === 'true';
  if (isAdmin) {
    adminBtn.style.display = 'flex';
  }
}

// Update initialization
const originalInit = document.addEventListener;
document.addEventListener('DOMContentLoaded', () => {
  loadCarsFromBackend();
  checkAdminStatus();
});
