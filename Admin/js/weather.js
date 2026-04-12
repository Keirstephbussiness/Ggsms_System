// GGSMS Weather Forecast Map JavaScript - Fixed Version with Open-Meteo API

// Global Variables
let map;
let markers = [];
let weatherLayers = {
    precipitation: null,
    clouds: null,
    wind: null,
    temp: null
};
let markerIdCounter = 0;
let isAddingMarker = false;
let updateInterval;

// OpenWeatherMap Configuration for tiles
const OPENWEATHER_API_KEY = '6b86d7bcf0895434aadf1c6a3749b268';
const WEATHER_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes for marker data

// Weather condition definitions based on WMO Weather codes - EXPANDED AND FIXED
const WEATHER_CONDITIONS = {
    0: { name: 'Clear Sky', severity: 'safe', icon: '☀️' },
    1: { name: 'Mainly Clear', severity: 'safe', icon: '🌤️' },
    2: { name: 'Partly Cloudy', severity: 'safe', icon: '⛅' },
    3: { name: 'Overcast', severity: 'light', icon: '☁️' },
    45: { name: 'Fog', severity: 'moderate', icon: '🌫️' },
    48: { name: 'Depositing Rime Fog', severity: 'moderate', icon: '🌫️' },
    51: { name: 'Light Drizzle', severity: 'light', icon: '🌦️' },
    53: { name: 'Moderate Drizzle', severity: 'light', icon: '🌦️' },
    55: { name: 'Dense Drizzle', severity: 'moderate', icon: '🌧️' },
    56: { name: 'Light Freezing Drizzle', severity: 'moderate', icon: '🌧️' },
    57: { name: 'Dense Freezing Drizzle', severity: 'severe', icon: '🌧️' },
    61: { name: 'Slight Rain', severity: 'light', icon: '🌧️' },
    63: { name: 'Moderate Rain', severity: 'moderate', icon: '🌧️' },
    65: { name: 'Heavy Rain', severity: 'severe', icon: '🌧️' },
    66: { name: 'Light Freezing Rain', severity: 'severe', icon: '🌧️' },
    67: { name: 'Heavy Freezing Rain', severity: 'severe', icon: '🌧️' },
    71: { name: 'Slight Snow', severity: 'moderate', icon: '🌨️' },
    73: { name: 'Moderate Snow', severity: 'moderate', icon: '🌨️' },
    75: { name: 'Heavy Snow', severity: 'severe', icon: '🌨️' },
    77: { name: 'Snow Grains', severity: 'moderate', icon: '🌨️' },
    80: { name: 'Slight Rain Showers', severity: 'light', icon: '🌦️' },
    81: { name: 'Moderate Rain Showers', severity: 'moderate', icon: '🌧️' },
    82: { name: 'Violent Rain Showers', severity: 'severe', icon: '🌧️' },
    85: { name: 'Slight Snow Showers', severity: 'moderate', icon: '🌨️' },
    86: { name: 'Heavy Snow Showers', severity: 'severe', icon: '🌨️' },
    95: { name: 'Thunderstorm', severity: 'severe', icon: '⛈️' },
    96: { name: 'Thunderstorm with Slight Hail', severity: 'severe', icon: '⛈️' },
    99: { name: 'Thunderstorm with Heavy Hail', severity: 'severe', icon: '⛈️' }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeMap();
    initializeEventListeners();
    loadLayerSettings();
    setupLayerToggles();
    loadWeatherLayers();
    loadSavedMarkers();
    
    // Start auto-refresh every 5 minutes
    startAutoRefresh();
});

// Initialize Leaflet Map
function initializeMap() {
    // Center on Philippines
    map = L.map('weatherMap').setView([12.8797, 121.7740], 6);

    // Base Layer - OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
    }).addTo(map);
}

// Load OpenWeatherMap Layers
function loadWeatherLayers() {
    // Clear existing layers
    Object.values(weatherLayers).forEach(layer => {
        if (layer && map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });
    
    const timestamp = Date.now();
    
    // Precipitation Layer
    weatherLayers.precipitation = L.tileLayer(
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`,
        {
            attribution: 'Weather © <a href="https://openweathermap.org">OpenWeatherMap</a>',
            opacity: 0.6,
            maxZoom: 18,
            tileSize: 256
        }
    );

    // Clouds Layer
    weatherLayers.clouds = L.tileLayer(
        `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`,
        {
            attribution: 'Weather © <a href="https://openweathermap.org">OpenWeatherMap</a>',
            opacity: 0.5,
            maxZoom: 18,
            tileSize: 256
        }
    );

    // Wind Layer
    weatherLayers.wind = L.tileLayer(
        `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`,
        {
            attribution: 'Weather © <a href="https://openweathermap.org">OpenWeatherMap</a>',
            opacity: 0.5,
            maxZoom: 18,
            tileSize: 256
        }
    );
    
    // Temperature Layer
    weatherLayers.temp = L.tileLayer(
        `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`,
        {
            attribution: 'Weather © <a href="https://openweathermap.org">OpenWeatherMap</a>',
            opacity: 0.5,
            maxZoom: 18,
            tileSize: 256
        }
    );
    
    console.log('Weather layers loaded');
    
    // Apply saved settings
    applySavedLayerSettings();
}

// Save layer settings to localStorage
function saveLayerSettings() {
    const settings = {
        precipitation: document.getElementById('radarLayer').checked,
        clouds: document.getElementById('waveLayer').checked,
        wind: document.getElementById('currentLayer').checked,
        temp: document.getElementById('tempLayer').checked
    };
    
    try {
        localStorage.setItem('ggsms_layer_settings', JSON.stringify(settings));
        console.log('Layer settings saved:', settings);
    } catch (error) {
        console.error('Error saving layer settings:', error);
    }
}

// Load layer settings from localStorage
function loadLayerSettings() {
    try {
        const savedSettings = localStorage.getItem('ggsms_layer_settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            
            // Apply to checkboxes
            document.getElementById('radarLayer').checked = settings.precipitation !== false;
            document.getElementById('waveLayer').checked = settings.clouds !== false;
            document.getElementById('currentLayer').checked = settings.wind || false;
            document.getElementById('tempLayer').checked = settings.temp || false;
            
            console.log('Layer settings loaded:', settings);
        } else {
            // Default settings
            document.getElementById('radarLayer').checked = true;
            document.getElementById('waveLayer').checked = true;
            document.getElementById('currentLayer').checked = false;
            document.getElementById('tempLayer').checked = false;
        }
    } catch (error) {
        console.error('Error loading layer settings:', error);
    }
}

// Apply saved layer settings to map
function applySavedLayerSettings() {
    if (document.getElementById('radarLayer').checked && weatherLayers.precipitation) {
        weatherLayers.precipitation.addTo(map);
    }
    if (document.getElementById('waveLayer').checked && weatherLayers.clouds) {
        weatherLayers.clouds.addTo(map);
    }
    if (document.getElementById('currentLayer').checked && weatherLayers.wind) {
        weatherLayers.wind.addTo(map);
    }
    if (document.getElementById('tempLayer').checked && weatherLayers.temp) {
        weatherLayers.temp.addTo(map);
    }
}

// Refresh weather layers
function refreshWeatherLayers() {
    console.log('Refreshing weather layers...');
    loadWeatherLayers();
}

// Start auto-refresh (5 minutes for markers, layers stay cached)
function startAutoRefresh() {
    // Refresh marker data every 5 minutes
    updateInterval = setInterval(() => {
        console.log('Auto-refreshing marker data...');
        refreshAllMarkerData();
    }, WEATHER_UPDATE_INTERVAL);
    
    // Refresh layers every 30 minutes (to reduce tile API calls)
    setInterval(() => {
        console.log('Auto-refreshing weather layers...');
        refreshWeatherLayers();
    }, 30 * 60 * 1000);
}

// Stop auto-refresh
function stopAutoRefresh() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

// Get weather condition info - FIXED with better fallback handling
function getWeatherCondition(weatherCode) {
    // Ensure weatherCode is a number
    const code = parseInt(weatherCode);
    
    // Check if code exists in our mapping
    if (WEATHER_CONDITIONS.hasOwnProperty(code)) {
        return WEATHER_CONDITIONS[code];
    }
    
    // Fallback for unknown codes - provide sensible defaults
    console.warn(`Unknown weather code: ${weatherCode}, using default`);
    return {
        name: 'Unknown Condition',
        severity: 'light',
        icon: '🌡️'
    };
}

// Get safety status based on weather and wave data - IMPROVED accuracy
function getSafetyStatus(weatherData) {
    const waveHeight = parseFloat(weatherData.waveHeight);
    const windSpeed = parseFloat(weatherData.windSpeed);
    const weatherCode = parseInt(weatherData.weatherCode);
    const condition = getWeatherCondition(weatherCode);
    
    // More accurate safety assessment
    let dangerousConditions = 0;
    let cautionConditions = 0;
    
    // Check weather severity
    if (condition.severity === 'severe') {
        dangerousConditions++;
    } else if (condition.severity === 'moderate') {
        cautionConditions++;
    }
    
    // Check wave height
    if (!isNaN(waveHeight)) {
        if (waveHeight >= 4) {
            dangerousConditions += 2; // Very dangerous
        } else if (waveHeight >= 3) {
            dangerousConditions++;
        } else if (waveHeight >= 2) {
            cautionConditions++;
        } else if (waveHeight >= 1.5) {
            cautionConditions++;
        }
    }
    
    // Check wind speed
    if (!isNaN(windSpeed)) {
        if (windSpeed >= 60) {
            dangerousConditions += 2; // Very dangerous
        } else if (windSpeed >= 50) {
            dangerousConditions++;
        } else if (windSpeed >= 40) {
            cautionConditions++;
        } else if (windSpeed >= 30) {
            cautionConditions++;
        }
    }
    
    // Determine overall safety
    if (dangerousConditions >= 2) {
        return 'dangerous';
    } else if (dangerousConditions >= 1 || cautionConditions >= 2) {
        return 'caution';
    } else {
        return 'safe';
    }
}

// Toggle Add Marker Mode
function toggleAddMarkerMode() {
    isAddingMarker = !isAddingMarker;
    const addMarkerBtn = document.getElementById('addMarkerBtn');
    
    if (isAddingMarker) {
        addMarkerBtn.classList.add('active');
        addMarkerBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <span>Cancel Marker Placement</span>
        `;
        map.getContainer().style.cursor = 'crosshair';
        showPanningHint();
    } else {
        addMarkerBtn.classList.remove('active');
        addMarkerBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2C6.13401 2 3 5.13401 3 9C3 13.25 10 18 10 18C10 18 17 13.25 17 9C17 5.13401 13.866 2 10 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="10" cy="9" r="2.5" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span>Click to Add Marker on Map</span>
        `;
        map.getContainer().style.cursor = '';
        hidePanningHint();
    }
}

// Show panning instruction hint
function showPanningHint() {
    const hint = document.createElement('div');
    hint.id = 'panningHint';
    hint.style.cssText = `
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%);
        color: white;
        padding: 14px 24px;
        border-radius: 12px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 700;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        z-index: 1001;
        pointer-events: none;
        animation: slideDown 0.4s ease-out;
        border: 2px solid rgba(255, 255, 255, 0.3);
    `;
    hint.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink: 0;">
                <path d="M10 2C6.13401 2 3 5.13401 3 9C3 13.25 10 18 10 18C10 18 17 13.25 17 9C17 5.13401 13.866 2 10 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="10" cy="9" r="2.5" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span>Click anywhere on the map to place a weather marker • You can pan and zoom first</span>
        </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
    
    document.getElementById('weatherMap').appendChild(hint);
}

// Hide panning instruction hint
function hidePanningHint() {
    const hint = document.getElementById('panningHint');
    if (hint) {
        hint.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => hint.remove(), 300);
    }
}

// Handle Map Click - Place Marker
async function onMapClick(e) {
    if (!isAddingMarker) return;
    
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    // Turn off add marker mode
    toggleAddMarkerMode();

    // Show loading
    showLoading();

    try {
        // Fetch weather data
        const weatherData = await fetchWeatherData(lat, lng);

        // Create marker
        const marker = createMarker(lat, lng, weatherData);
        markers.push(marker);

        // Save markers to localStorage
        saveMarkersToStorage();

        // Update markers list
        updateMarkersList();

        // Show weather info modal
        showWeatherModal(weatherData);
    } catch (error) {
        console.error('Error fetching weather data:', error);
        alert('Failed to fetch weather data. Please try again.');
    } finally {
        hideLoading();
    }
}

// Fetch Weather Data from Open-Meteo API - IMPROVED with better error handling and location accuracy
async function fetchWeatherData(lat, lng) {
    const data = {
        location: { lat, lng },
        timestamp: new Date().toISOString(),
    };

    try {
        // Fetch Open-Meteo data (comprehensive weather data)
        const meteoResponse = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(6)}&longitude=${lng.toFixed(6)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto`
        );
        
        if (!meteoResponse.ok) {
            throw new Error(`Open-Meteo API error: ${meteoResponse.status}`);
        }
        
        const meteoData = await meteoResponse.json();
        console.log('Open-Meteo data:', meteoData);

        if (meteoData.current) {
            // Use nullish coalescing for better handling of missing data
            data.temperature = meteoData.current.temperature_2m != null ? meteoData.current.temperature_2m.toFixed(1) : 'N/A';
            data.apparentTemp = meteoData.current.apparent_temperature != null ? meteoData.current.apparent_temperature.toFixed(1) : 'N/A';
            data.humidity = meteoData.current.relative_humidity_2m != null ? meteoData.current.relative_humidity_2m : 'N/A';
            data.windSpeed = meteoData.current.wind_speed_10m != null ? meteoData.current.wind_speed_10m.toFixed(1) : 'N/A';
            data.windDirection = meteoData.current.wind_direction_10m != null ? meteoData.current.wind_direction_10m.toFixed(0) : 'N/A';
            data.windGusts = meteoData.current.wind_gusts_10m != null ? meteoData.current.wind_gusts_10m.toFixed(1) : 'N/A';
            data.precipitation = meteoData.current.precipitation != null ? meteoData.current.precipitation.toFixed(1) : '0';
            data.rain = meteoData.current.rain != null ? meteoData.current.rain.toFixed(1) : '0';
            // CRITICAL FIX: Ensure weather code is always a valid number
            data.weatherCode = meteoData.current.weather_code != null ? parseInt(meteoData.current.weather_code) : 0;
            data.cloudCoverage = meteoData.current.cloud_cover != null ? meteoData.current.cloud_cover : 0;
            data.pressure = meteoData.current.pressure_msl != null ? meteoData.current.pressure_msl.toFixed(1) : 'N/A';
        } else {
            throw new Error('No current weather data available');
        }

        // Fetch Marine data (OpenMeteo Marine API)
        try {
            const marineResponse = await fetch(
                `https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(6)}&longitude=${lng.toFixed(6)}&current=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction&hourly=wave_height&timezone=auto`
            );
            
            if (marineResponse.ok) {
                const marineData = await marineResponse.json();
                console.log('Marine data:', marineData);
                
                if (marineData.current) {
                    data.waveHeight = marineData.current.wave_height != null ? marineData.current.wave_height.toFixed(1) : 'N/A';
                    data.waveDirection = marineData.current.wave_direction != null ? marineData.current.wave_direction.toFixed(0) : 'N/A';
                    data.wavePeriod = marineData.current.wave_period != null ? marineData.current.wave_period.toFixed(1) : 'N/A';
                    data.currentSpeed = marineData.current.ocean_current_velocity != null ? marineData.current.ocean_current_velocity.toFixed(2) : 'N/A';
                    data.currentDirection = marineData.current.ocean_current_direction != null ? marineData.current.ocean_current_direction.toFixed(0) : 'N/A';
                } else {
                    data.waveHeight = 'N/A';
                    data.waveDirection = 'N/A';
                    data.wavePeriod = 'N/A';
                    data.currentSpeed = 'N/A';
                    data.currentDirection = 'N/A';
                }
            } else {
                data.waveHeight = 'N/A';
                data.waveDirection = 'N/A';
                data.wavePeriod = 'N/A';
                data.currentSpeed = 'N/A';
                data.currentDirection = 'N/A';
            }
        } catch (marineError) {
            console.log('Marine data not available for this location:', marineError);
            data.waveHeight = 'N/A';
            data.waveDirection = 'N/A';
            data.wavePeriod = 'N/A';
            data.currentSpeed = 'N/A';
            data.currentDirection = 'N/A';
        }

        // Estimate sea temperature (approximate) - improved formula
        if (data.temperature !== 'N/A') {
            const airTemp = parseFloat(data.temperature);
            // More accurate sea temperature estimation (typically 1-3°C cooler than air)
            data.seaTemp = (airTemp - 2).toFixed(1);
        } else {
            data.seaTemp = 'N/A';
        }

        // Calculate visibility from cloud cover and weather - improved calculation
        if (data.cloudCoverage !== 'N/A' && data.weatherCode !== 'N/A') {
            const cloudCover = parseInt(data.cloudCoverage);
            const weatherCode = parseInt(data.weatherCode);
            
            // Start with base visibility
            let visibility = 10;
            
            // Reduce based on cloud cover
            visibility -= (cloudCover * 0.07);
            
            // Reduce based on weather conditions
            if (weatherCode >= 95) { // Thunderstorm
                visibility *= 0.3;
            } else if (weatherCode >= 80) { // Heavy rain/snow
                visibility *= 0.5;
            } else if (weatherCode >= 61) { // Rain
                visibility *= 0.7;
            } else if (weatherCode >= 45) { // Fog
                visibility *= 0.2;
            }
            
            data.visibility = Math.max(0.1, visibility).toFixed(1);
        } else {
            data.visibility = 'N/A';
        }

        // Get location name via reverse geocoding - IMPROVED with better error handling
        try {
            const geocodeResponse = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}&zoom=10&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'GGSMS-Weather-App/1.0'
                    }
                }
            );
            
            if (geocodeResponse.ok) {
                const geocodeData = await geocodeResponse.json();
                
                // Build a more accurate location name
                const address = geocodeData.address || {};
                const locationParts = [];
                
                if (address.city || address.town || address.village || address.municipality) {
                    locationParts.push(address.city || address.town || address.village || address.municipality);
                }
                
                if (address.state || address.province) {
                    locationParts.push(address.state || address.province);
                }
                
                if (address.country) {
                    locationParts.push(address.country);
                }
                
                data.locationName = locationParts.length > 0 
                    ? locationParts.join(', ') 
                    : `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
            } else {
                data.locationName = `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
            }
        } catch (geocodeError) {
            console.log('Geocoding error:', geocodeError);
            data.locationName = `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
        }

        console.log('Final weather data:', data);
        return data;
    } catch (error) {
        console.error('Error in fetchWeatherData:', error);
        throw error;
    }
}

// Create Map Marker
function createMarker(lat, lng, weatherData) {
    const markerId = markerIdCounter++;
    
    // Get weather condition
    const condition = getWeatherCondition(weatherData.weatherCode);
    const safetyStatus = getSafetyStatus(weatherData);

    // Create custom icon
    const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `
            <div class="marker-pulse"></div>
            <div class="marker-pin ${safetyStatus}"></div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
    });

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

    // Popup content
    const waveHeight = parseFloat(weatherData.waveHeight);
    const popupContent = `
        <div style="font-family: Inter, sans-serif; min-width: 260px; max-width: 320px;">
            <h3 style="margin: 0 0 12px 0; color: #0A2463; font-size: 15px; font-weight: 700; border-bottom: 2px solid #D4AF37; padding-bottom: 8px;">
                ${weatherData.locationName.split(',').slice(0, 2).join(',')}
            </h3>
            
            <div style="background: linear-gradient(135deg, #F3F4F6, #E5E7EB); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                <div style="font-size: 24px; text-align: center; margin-bottom: 6px;">
                    ${condition.icon}
                </div>
                <div style="font-size: 14px; font-weight: 700; color: #0A2463; text-align: center; text-transform: capitalize;">
                    ${condition.name}
                </div>
                <div style="font-size: 12px; font-weight: 600; color: #6B7280; text-align: center; margin-top: 4px;">
                    Safety: <span style="color: ${safetyStatus === 'dangerous' ? '#EF4444' : safetyStatus === 'caution' ? '#F59E0B' : '#10B981'}; text-transform: uppercase;">${safetyStatus}</span>
                </div>
            </div>
            
            <div style="font-size: 13px; line-height: 1.8; font-weight: 600;">
                <div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px;">
                    <div style="color: #6B7280;">Temperature:</div>
                    <div style="color: #0A2463;">${weatherData.temperature}°C</div>
                    
                    <div style="color: #6B7280;">Feels Like:</div>
                    <div style="color: #0A2463;">${weatherData.apparentTemp}°C</div>
                    
                    <div style="color: #6B7280;">Humidity:</div>
                    <div style="color: #0A2463;">${weatherData.humidity}%</div>
                    
                    <div style="color: #6B7280;">Wind Speed:</div>
                    <div style="color: #0A2463;">${weatherData.windSpeed} km/h</div>
                    
                    <div style="color: #6B7280;">Wave Height:</div>
                    <div style="color: ${!isNaN(waveHeight) && waveHeight >= 3 ? '#EF4444' : !isNaN(waveHeight) && waveHeight >= 1.5 ? '#F59E0B' : '#10B981'}; font-weight: 700;">${weatherData.waveHeight}m</div>
                    
                    <div style="color: #6B7280;">Visibility:</div>
                    <div style="color: #0A2463;">${weatherData.visibility} km</div>
                </div>
            </div>
            <button onclick="deleteMarker(${markerId})" style="margin-top: 14px; width: 100%; padding: 8px 14px; background: linear-gradient(135deg, #DC2626, #EF4444); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 700; transition: all 0.2s;">Delete Marker</button>
        </div>
    `;

    marker.bindPopup(popupContent, {
        maxWidth: 340,
        className: 'custom-popup'
    });

    // Store marker data
    marker.markerId = markerId;
    marker.weatherData = weatherData;

    return marker;
}

// Delete Marker
window.deleteMarker = function (markerId) {
    const index = markers.findIndex((m) => m.markerId === markerId);
    if (index !== -1) {
        map.removeLayer(markers[index]);
        markers.splice(index, 1);
        saveMarkersToStorage();
        updateMarkersList();
    }
};

// Save markers to localStorage
function saveMarkersToStorage() {
    const markersData = markers.map(marker => ({
        id: marker.markerId,
        lat: marker.getLatLng().lat,
        lng: marker.getLatLng().lng,
        weatherData: marker.weatherData
    }));
    
    try {
        localStorage.setItem('ggsms_weather_markers', JSON.stringify(markersData));
        console.log(`Saved ${markersData.length} markers to localStorage`);
    } catch (error) {
        console.error('Error saving markers to localStorage:', error);
    }
}

// Load markers from localStorage
function loadSavedMarkers() {
    try {
        const savedData = localStorage.getItem('ggsms_weather_markers');
        if (!savedData) {
            console.log('No saved markers found');
            return;
        }
        
        const markersData = JSON.parse(savedData);
        console.log(`Loading ${markersData.length} saved markers`);
        
        markersData.forEach(markerData => {
            const marker = createMarker(markerData.lat, markerData.lng, markerData.weatherData);
            marker.markerId = markerData.id;
            markers.push(marker);
            
            // Update counter
            if (markerData.id >= markerIdCounter) {
                markerIdCounter = markerData.id + 1;
            }
        });
        
        updateMarkersList();
    } catch (error) {
        console.error('Error loading markers from localStorage:', error);
    }
}

// Refresh all marker data
async function refreshAllMarkerData() {
    if (markers.length === 0) return;
    
    console.log(`Refreshing data for ${markers.length} markers...`);
    
    for (let marker of markers) {
        try {
            const lat = marker.getLatLng().lat;
            const lng = marker.getLatLng().lng;
            const weatherData = await fetchWeatherData(lat, lng);
            
            // Update marker data
            marker.weatherData = weatherData;
            
            // Update marker icon based on new conditions
            const safetyStatus = getSafetyStatus(weatherData);
            const customIcon = L.divIcon({
                className: 'custom-marker',
                html: `
                    <div class="marker-pulse"></div>
                    <div class="marker-pin ${safetyStatus}"></div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 36],
                popupAnchor: [0, -36]
            });
            marker.setIcon(customIcon);
            
            // Update popup if it's open
            if (marker.isPopupOpen()) {
                const condition = getWeatherCondition(weatherData.weatherCode);
                const waveHeight = parseFloat(weatherData.waveHeight);
                const popupContent = `
                    <div style="font-family: Inter, sans-serif; min-width: 260px; max-width: 320px;">
                        <h3 style="margin: 0 0 12px 0; color: #0A2463; font-size: 15px; font-weight: 700; border-bottom: 2px solid #D4AF37; padding-bottom: 8px;">
                            ${weatherData.locationName.split(',').slice(0, 2).join(',')}
                        </h3>
                        
                        <div style="background: linear-gradient(135deg, #F3F4F6, #E5E7EB); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                            <div style="font-size: 24px; text-align: center; margin-bottom: 6px;">
                                ${condition.icon}
                            </div>
                            <div style="font-size: 14px; font-weight: 700; color: #0A2463; text-align: center; text-transform: capitalize;">
                                ${condition.name}
                            </div>
                            <div style="font-size: 12px; font-weight: 600; color: #6B7280; text-align: center; margin-top: 4px;">
                                Safety: <span style="color: ${safetyStatus === 'dangerous' ? '#EF4444' : safetyStatus === 'caution' ? '#F59E0B' : '#10B981'}; text-transform: uppercase;">${safetyStatus}</span>
                            </div>
                        </div>
                        
                        <div style="font-size: 13px; line-height: 1.8; font-weight: 600;">
                            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px;">
                                <div style="color: #6B7280;">Temperature:</div>
                                <div style="color: #0A2463;">${weatherData.temperature}°C</div>
                                
                                <div style="color: #6B7280;">Feels Like:</div>
                                <div style="color: #0A2463;">${weatherData.apparentTemp}°C</div>
                                
                                <div style="color: #6B7280;">Humidity:</div>
                                <div style="color: #0A2463;">${weatherData.humidity}%</div>
                                
                                <div style="color: #6B7280;">Wind Speed:</div>
                                <div style="color: #0A2463;">${weatherData.windSpeed} km/h</div>
                                
                                <div style="color: #6B7280;">Wave Height:</div>
                                <div style="color: ${!isNaN(waveHeight) && waveHeight >= 3 ? '#EF4444' : !isNaN(waveHeight) && waveHeight >= 1.5 ? '#F59E0B' : '#10B981'}; font-weight: 700;">${weatherData.waveHeight}m</div>
                                
                                <div style="color: #6B7280;">Visibility:</div>
                                <div style="color: #0A2463;">${weatherData.visibility} km</div>
                            </div>
                        </div>
                        <button onclick="deleteMarker(${marker.markerId})" style="margin-top: 14px; width: 100%; padding: 8px 14px; background: linear-gradient(135deg, #DC2626, #EF4444); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 700; transition: all 0.2s;">Delete Marker</button>
                    </div>
                `;
                marker.setPopupContent(popupContent);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            console.error('Error refreshing marker:', error);
        }
    }
    
    saveMarkersToStorage();
    updateMarkersList();
    console.log('Marker data refresh complete');
}

// Update Markers List
function updateMarkersList() {
    const markersList = document.getElementById('markersList');

    if (markers.length === 0) {
        markersList.innerHTML = '<p class="no-markers">No markers placed</p>';
        return;
    }

    markersList.innerHTML = markers
        .map((marker) => {
            const condition = getWeatherCondition(marker.weatherData.weatherCode);
            const safetyStatus = getSafetyStatus(marker.weatherData);
            let statusColor = '#10B981';
            
            if (safetyStatus === 'dangerous') statusColor = '#EF4444';
            else if (safetyStatus === 'caution') statusColor = '#F59E0B';
            
            return `
            <div class="marker-item">
                <div class="marker-info">
                    <div class="marker-name">${marker.weatherData.locationName.split(',').slice(0, 2).join(',')}</div>
                    <div class="marker-coords">${marker.weatherData.location.lat.toFixed(4)}, ${marker.weatherData.location.lng.toFixed(4)}</div>
                    <div style="margin-top: 6px; font-size: 12px; font-weight: 700; color: ${statusColor};">
                        ${condition.icon} ${condition.name}
                    </div>
                    <div style="margin-top: 4px; font-size: 11px; font-weight: 700; color: #6B7280;">
                        Wave: ${marker.weatherData.waveHeight}m | Wind: ${marker.weatherData.windSpeed} km/h
                    </div>
                </div>
                <button class="marker-delete" onclick="deleteMarker(${marker.markerId})">
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
        `
        })
        .join('');
}

// Show Weather Modal
function showWeatherModal(weatherData) {
    const modal = document.getElementById('weatherModalOverlay');
    const content = document.getElementById('weatherInfoContent');

    const condition = getWeatherCondition(weatherData.weatherCode);
    const safetyStatus = getSafetyStatus(weatherData);
    let safetyColor = '#10B981';
    
    if (safetyStatus === 'dangerous') safetyColor = '#EF4444';
    else if (safetyStatus === 'caution') safetyColor = '#F59E0B';

    content.innerHTML = `
        <div class="weather-info-item full-width">
            <div class="info-label">Location</div>
            <div class="info-value" style="font-size: 16px;">${weatherData.locationName}</div>
        </div>
        
        <div class="weather-info-item full-width" style="background: linear-gradient(135deg, #F3F4F6, #E5E7EB); border: 2px solid ${safetyColor};">
            <div style="display: flex; align-items: center; gap: 16px; justify-content: center;">
                <div style="font-size: 48px;">${condition.icon}</div>
                <div>
                    <div style="font-size: 18px; font-weight: 800; color: #0A2463; text-transform: capitalize;">${condition.name}</div>
                    <div style="font-size: 14px; font-weight: 700; color: ${safetyColor}; text-transform: uppercase; margin-top: 4px;">
                        Safety Status: ${safetyStatus}
                    </div>
                </div>
            </div>
        </div>
        
        <div class="weather-info-item">
            <div class="info-label">Temperature</div>
            <div class="info-value">${weatherData.temperature}<span class="info-unit">°C</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Feels Like</div>
            <div class="info-value">${weatherData.apparentTemp}<span class="info-unit">°C</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Humidity</div>
            <div class="info-value">${weatherData.humidity}<span class="info-unit">%</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Pressure</div>
            <div class="info-value">${weatherData.pressure}<span class="info-unit">hPa</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Wind Speed</div>
            <div class="info-value">${weatherData.windSpeed}<span class="info-unit">km/h</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Wind Direction</div>
            <div class="info-value">${weatherData.windDirection}<span class="info-unit">°</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Wind Gusts</div>
            <div class="info-value">${weatherData.windGusts}<span class="info-unit">km/h</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Cloud Coverage</div>
            <div class="info-value">${weatherData.cloudCoverage}<span class="info-unit">%</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Precipitation</div>
            <div class="info-value">${weatherData.precipitation}<span class="info-unit">mm</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Rain</div>
            <div class="info-value">${weatherData.rain}<span class="info-unit">mm</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Visibility</div>
            <div class="info-value">${weatherData.visibility}<span class="info-unit">km</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Wave Height</div>
            <div class="info-value" style="color: ${safetyColor}; font-weight: 800;">${weatherData.waveHeight}<span class="info-unit">m</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Wave Period</div>
            <div class="info-value">${weatherData.wavePeriod}<span class="info-unit">s</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Wave Direction</div>
            <div class="info-value">${weatherData.waveDirection}<span class="info-unit">°</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Sea Temperature</div>
            <div class="info-value">${weatherData.seaTemp}<span class="info-unit">°C</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Current Speed</div>
            <div class="info-value">${weatherData.currentSpeed}<span class="info-unit">m/s</span></div>
        </div>
        <div class="weather-info-item">
            <div class="info-label">Current Direction</div>
            <div class="info-value">${weatherData.currentDirection}<span class="info-unit">°</span></div>
        </div>
    `;

    modal.classList.add('active');
}

// Initialize Event Listeners
function initializeEventListeners() {
    // Map click for adding markers
    map.on('click', onMapClick);

    // Add marker button
    document.getElementById('addMarkerBtn').addEventListener('click', toggleAddMarkerMode);

    // Clear markers button
    document.getElementById('clearMarkersBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all markers? This will permanently delete all saved markers.')) {
            markers.forEach((marker) => map.removeLayer(marker));
            markers = [];
            saveMarkersToStorage();
            updateMarkersList();
        }
    });

    // Refresh data button
    document.getElementById('refreshDataBtn').addEventListener('click', async () => {
        showLoading();
        refreshWeatherLayers();
        await refreshAllMarkerData();
        hideLoading();
    });

    // Modal close
    document.getElementById('weatherModalCloseBtn').addEventListener('click', () => {
        document.getElementById('weatherModalOverlay').classList.remove('active');
    });

    // Close modal on overlay click
    document.getElementById('weatherModalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'weatherModalOverlay') {
            document.getElementById('weatherModalOverlay').classList.remove('active');
        }
    });

    // Filter changes
    document.getElementById('regionFilter').addEventListener('change', applyFilters);
    document.getElementById('waveFilter').addEventListener('change', applyFilters);
}

// Setup Layer Toggles
function setupLayerToggles() {
    document.getElementById('radarLayer').addEventListener('change', (e) => {
        if (e.target.checked) {
            if (weatherLayers.precipitation) {
                weatherLayers.precipitation.addTo(map);
            }
        } else {
            if (weatherLayers.precipitation && map.hasLayer(weatherLayers.precipitation)) {
                map.removeLayer(weatherLayers.precipitation);
            }
        }
        saveLayerSettings();
    });

    document.getElementById('waveLayer').addEventListener('change', (e) => {
        if (e.target.checked) {
            if (weatherLayers.clouds) {
                weatherLayers.clouds.addTo(map);
            }
        } else {
            if (weatherLayers.clouds && map.hasLayer(weatherLayers.clouds)) {
                map.removeLayer(weatherLayers.clouds);
            }
        }
        saveLayerSettings();
    });

    document.getElementById('currentLayer').addEventListener('change', (e) => {
        if (e.target.checked) {
            if (weatherLayers.wind) {
                weatherLayers.wind.addTo(map);
            }
        } else {
            if (weatherLayers.wind && map.hasLayer(weatherLayers.wind)) {
                map.removeLayer(weatherLayers.wind);
            }
        }
        saveLayerSettings();
    });

    document.getElementById('tempLayer').addEventListener('change', (e) => {
        if (e.target.checked) {
            if (weatherLayers.temp) {
                weatherLayers.temp.addTo(map);
            }
        } else {
            if (weatherLayers.temp && map.hasLayer(weatherLayers.temp)) {
                map.removeLayer(weatherLayers.temp);
            }
        }
        saveLayerSettings();
    });
}

// Apply Filters
function applyFilters() {
    const regionFilter = document.getElementById('regionFilter').value;
    const waveFilter = document.getElementById('waveFilter').value;

    // Filter logic
    console.log('Filters applied:', { regionFilter, waveFilter });
}

// Show Loading Overlay
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

// Hide Loading Overlay
function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});