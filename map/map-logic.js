// Dynamically load the Google Maps script using our secret key
const mapScript = document.createElement('script');
mapScript.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,marker&callback=initMap`;
mapScript.async = true;
mapScript.defer = true;
document.head.appendChild(mapScript); // Adds the <script> tag to the <head>

// --- 1. INITIALIZE FIREBASE & GLOBAL VARS ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

let map;
let userMarker; // This is the draggable pin
let currentUserLocation; // This is the user's *actual* GPS location
let centerPinLocation;   // This is the location of the pin (what we search from)
let allFirebaseLocations = []; // Will hold data from Firebase
let allMarkers = [];
let AdvancedMarkerElement; // Will be loaded from Google

const activeFilters = {
    "ev-only": false,
    "available": false,
    "under-200": false,
    "10km": true 
};

// Custom Map Marker Icons (You must create these in an 'icons/' folder)
const icons = {
    "EV": 'icons/marker-ev.svg',
    "Parking": 'icons/marker-parking.svg',
    "EV+Parking": 'icons/purple.png'
};

/**
 * Main function called by Google Maps script
 */
async function initMap() {
    // This loads the new AdvancedMarkerElement
    const { AdvancedMarkerElement: MarkerLibrary } = await google.maps.importLibrary("marker");
    AdvancedMarkerElement = MarkerLibrary; 

    const defaultLocation = { lat: 28.6315, lng: 77.2167 }; // Connaught Place

    // --- FIX: This style removes POI labels but keeps streets ---
    const mapStyle = [
        { "featureType": "poi", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
        { "featureType": "transit", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
        { "featureType": "road", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
        { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] }
    ];

    map = new google.maps.Map(document.getElementById("map-container"), {
        center: defaultLocation,
        zoom: 14,
        disableDefaultUI: true,
        styles: mapStyle,
        mapId: GOOGLE_MAPS_MAP_ID // Use the variable from config.js
    });

    // Start the app
    getUserLocation(); // Get location by default
    initFilterListeners();
    initBookingModal();
    initAutocomplete(); // Initialize the search bar
    loadFirebaseLocations();
}

/**
 * 1. Get User's Location (Mandatory)
 */
function getUserLocation() {
    const promptOverlay = document.getElementById('location-prompt-overlay');
    if (!navigator.geolocation) {
        promptOverlay.classList.add('is-visible');
        // If no location, create a pin at the default spot
        createDraggablePin(map.getCenter().toJSON());
        processLocations();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            };
            currentUserLocation = pos; // Save this for the "locate me" button
            promptOverlay.classList.remove('is-visible');
            
            // Center map and create the draggable pin
            map.setCenter(pos);
            map.setZoom(15);
            createDraggablePin(pos); 
            
            // Now that we have a location, process locations
            processLocations(); 
        },
        () => {
            // User denied or failed
            promptOverlay.classList.add('is-visible');
            // Create a pin at the default spot
            createDraggablePin(map.getCenter().toJSON());
            processLocations();
        }
    );
}

// This button just re-centers the map on the user's *actual* location
document.getElementById('btn-locate-me').addEventListener('click', () => {
    if (currentUserLocation) {
        map.panTo(currentUserLocation);
        map.setZoom(15);
        // Also move the pin and refresh the list
        createDraggablePin(currentUserLocation);
        processLocations();
    } else {
        getUserLocation(); // Ask for permission again
    }
});

/**
 * NEW: Create the Draggable User Pin
 */
function createDraggablePin(pos) {
    centerPinLocation = pos; // This is the location we will search from

    if (userMarker) {
        userMarker.position = pos;
    } else {
        // Create a custom HTML element for the pin
        const userPin = document.createElement('div');
        userPin.className = 'user-marker-pin';
        userPin.innerHTML = '<i class="fas fa-male"></i>';

        userMarker = new AdvancedMarkerElement({
            position: pos,
            map: map,
            title: "Search from here (Drag me!)",
            content: userPin,
            zIndex: 1000,
            gmpDraggable: true // Make the marker draggable
        });

        // --- THIS IS THE FIX FOR DRAGGING ---
        // Add listener for when user stops dragging the pin
        userMarker.addListener('dragend', (event) => {
            const newPos = event.marker.position;
            centerPinLocation = { lat: newPos.lat, lng: newPos.lng };
            map.panTo(newPos);
            
            // After dragging, re-run all logic
            processLocations();
        });
    }
}

document.getElementById('btn-retry-location').addEventListener('click', getUserLocation);

/**
 * 2. Haversine Formula for distance
 */
function haversineDistance(pos1, pos2) {
    const R = 6371; // km
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
    const a = 0.5 - Math.cos(dLat) / 2 +
              Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
              (1 - Math.cos(dLng)) / 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

/**
 * 3. Generate Location-Aware Dummy Data
 */
function generateDummyData(centerPos) {
    let dummies = [];
    const randOffset = () => (Math.random() * 0.02) - 0.01; // ~1-2km

    // Dummy EV
    dummies.push({
        "id": "dummy-ev-1", "name": "Harsh EV Station ",
        "lat": centerPos.lat + randOffset(), "lng": centerPos.lng + randOffset(),
        "availableSlots": 3, "totalSlots": 4, "evSlots": 4,
        "pricePerHour": 80, "type": "EV", "status": "verified"
    });

    // Dummy EV+Parking
    dummies.push({
        "id": "dummy-both-1", "name": "Fortune Hotel marking",
        "lat": centerPos.lat + randOffset(), "lng": centerPos.lng + randOffset(),
        "availableSlots": 10, "totalSlots": 20, "evSlots": 2,
        "pricePerHour": 50, "type": "EV+Parking", "status": "verified"
    });

    // --- NEW: UNAVAILABLE DEMO SPOT ---
    dummies.push({
        "id": "dummy-full-1", "name": "Ankush's Parking Area",
        "lat": centerPos.lat + randOffset(), "lng": centerPos.lng + randOffset(),
        "availableSlots": 0, // No slots
        "totalSlots": 30, "evSlots": 0,
        "pricePerHour": 30, "type": "Parking", "status": "verified"
    });

    dummies.push({
        "id": "dummy-ev-1", "name": "Aviraj EV",
        "lat": centerPos.lat + randOffset(), "lng": centerPos.lng + randOffset(),
        "availableSlots": 10, // No slots
        "totalSlots": 30, "evSlots": 0,
        "pricePerHour": 30, "type": "Parking", "status": "verified"
    });
     // Dummy EV+Parking
    dummies.push({
        "id": "dummy-both-1", "name": "Rahul SIngh Villa",
        "lat": centerPos.lat + randOffset(), "lng": centerPos.lng + randOffset(),
        "availableSlots": 1, "totalSlots": 2, "evSlots": 2,
        "pricePerHour": 50, "type": "EV+Parking", "status": "verified"
    });
    
    return dummies;
}

/**
 * 4. Load Data from Firebase
 */
function loadFirebaseLocations() {
    const spotsRef = database.ref('parkingSpots');
    
    // Use .on() to get real-time updates
    spotsRef.on('value', (snapshot) => {
        allFirebaseLocations = []; 
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const spot = childSnapshot.val();
                spot.id = childSnapshot.key;
                
                // --- THIS IS THE FIX FOR "NOT LISTING" ---
                // Only show verified spots
                if (spot.status === 'verified') {
                    // Assign a type if it's missing from your real data
                    if (!spot.type) { // If 'type' is missing
                        if (spot.evSlots && spot.evSlots > 0) {
                            spot.type = "EV+Parking";
                        } else {
                            spot.type = "Parking";
                        }
                    }
                    if (!spot.evSlots) spot.evSlots = 0;
                    allFirebaseLocations.push(spot);
                }
            });
        }
        // After fetching new data, re-run all the logic
        processLocations();
    });
}

/**
 * 5. Process and Filter Locations
 * (This is the main "refresh" function)
 */
function processLocations() {
    const loader = document.getElementById('loader');
    const listContainer = document.getElementById('location-list');
    
    if (!loader || !listContainer) return;

    // --- THIS IS THE FIX FOR "FILTERS NOT WORKING" ---
    // Don't run this function if we don't have a pin location yet
    if (!centerPinLocation) {
        loader.style.display = 'block';
        listContainer.innerHTML = '<p style="text-align: center; color: #555;">Getting your location...</p>'; 
        return;
    }
    
    loader.style.display = 'none';

    // 1. Generate new dummy data around the user's *pin location*
    const dummyData = generateDummyData(centerPinLocation);
    // 2. Combine real data + new dummy data
    const allLocations = allFirebaseLocations.concat(dummyData);

    // 3. Calculate distance from *pin location*
    allLocations.forEach(loc => {
        loc.distance = haversineDistance(centerPinLocation, { lat: loc.lat, lng: loc.lng });
    });

    // 4. Apply all active filters
    let filteredLocations = allLocations.filter(loc => {
        if (activeFilters["10km"] && loc.distance > 10) return false;
        if (activeFilters["ev-only"] && !(loc.type === "EV" || loc.type === "EV+Parking")) return false;
        if (activeFilters["available"] && loc.availableSlots === 0) return false;
        if (activeFilters["under-200"] && loc.pricePerHour > 200) return false;
        return true;
    });

    // 5. Sort by distance (ascending)
    filteredLocations.sort((a, b) => a.distance - b.distance);

    // 6. Display on map and in list
    displayLocationMarkers(filteredLocations);
    displayLocationList(filteredLocations);
}

/**
 * 6. Display Markers on Map
 */
function displayLocationMarkers(locations) {
    allMarkers.forEach(marker => marker.map = null);
    allMarkers = [];

    locations.forEach(loc => {
        const iconImg = document.createElement('img');
        iconImg.src = icons[loc.type] || icons['Parking'];
        
        // --- INCREASED MARKER SIZE ---
        iconImg.style.width = '40px';
        iconImg.style.height = '40px';
        iconImg.style.cursor = 'pointer';

        const marker = new AdvancedMarkerElement({
            position: { lat: loc.lat, lng: loc.lng },
            map: map,
            title: loc.name,
            content: iconImg 
        });
        
        marker.addListener('click', () => {
            document.getElementById('bottom-sheet').classList.add('is-open');
            const item = document.getElementById(`loc-${loc.id}`);
            if(item) {
                document.querySelectorAll('.location-card').forEach(c => c.style.background = 'none');
                item.style.background = '#f8faff';
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
        
        allMarkers.push(marker);
    });
}

/**
 * 7. Display Locations in Bottom Sheet
 * (Updated to add 'unavailable' class)
 */
function displayLocationList(locations) {
    const listContainer = document.getElementById('location-list');
    listContainer.innerHTML = ''; 

    if (locations.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; color: #555;">No locations found matching your criteria.</p>';
        document.getElementById('bottom-sheet').classList.remove('is-open');
        return;
    }

    locations.forEach(loc => {
        const isUnavailable = loc.availableSlots === 0;
        
        const card = document.createElement('div');
        // --- NEW: Add unavailable class ---
        card.className = `location-card ${isUnavailable ? 'unavailable' : ''}`;
        card.id = `loc-${loc.id}`;
        
        card.innerHTML = `
            <div class="location-details">
                <h4>${loc.name}</h4>
                <div class="location-meta">
                    <span><i class="fas fa-map-marker-alt"></i> ${loc.distance.toFixed(1)} km</span>
                    <span><i class="fas fa-car"></i> ${loc.availableSlots}/${loc.totalSlots}</span>
                    ${loc.evSlots > 0 ? `<span><i class="fas fa-bolt"></i> ${loc.evSlots} EV</span>` : ''}
                    <span><i class="fas fa-indian-rupee-sign"></i> ${loc.pricePerHour}/hr</span>
                </div>
            </div>
            <button class="btn-book-now" data-id="${loc.id}" ${isUnavailable ? 'disabled' : ''}>
                ${isUnavailable ? 'Full' : 'Book Now'}
            </button>
        `;
        listContainer.appendChild(card);
    });

    listContainer.querySelectorAll('.btn-book-now').forEach(button => {
        button.addEventListener('click', (e) => {
            openBookingModal(e.target.dataset.id);
        });
    });

    document.getElementById('bottom-sheet').classList.add('is-open');
}

/**
 * 8. Filter Chip Listeners
 */
function initFilterListeners() {
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const filter = chip.dataset.filter;
            chip.classList.toggle('active');
            activeFilters[filter] = chip.classList.contains('active');
            processLocations(); // Re-run all logic
        });
    });
}

/**
 * 9. Booking Modal Logic (Unchanged)
 */
function initBookingModal() {
    // (This function remains the same as the previous version)
    const modal = document.getElementById('booking-modal');
    const form = document.getElementById('booking-form');
    
    document.getElementById('close-booking-modal').addEventListener('click', () => {
        modal.classList.remove('is-visible');
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const locationId = document.getElementById('booking-location-id').value;
        const vehicleNumber = document.getElementById('vehicle-number').value;
        
        const button = form.querySelector('button');
        button.textContent = "Booking...";
        button.disabled = true;

        const isDummy = locationId.includes('dummy');

        if (isDummy) {
            setTimeout(() => {
                const dummyData = generateDummyData(centerPinLocation); // Use correct location
                let dummySpot = dummyData.find(d => d.id === locationId);
                
                if (dummySpot && dummySpot.availableSlots > 0) { 
                    dummySpot.availableSlots--; 
                    alert(`Booking confirmed!\nVehicle: ${vehicleNumber}`);
                    processLocations(); 
                } else {
                    alert("Sorry, all slots were just booked!");
                }
                modal.classList.remove('is-visible');
                button.textContent = "Confirm Booking";
                button.disabled = false;
            }, 1000);
            
        } else {
            // REAL FIREBASE BOOKING
            database.ref().transaction(currentData => {
                if (currentData === null) return currentData;
                if (currentData.parkingSpots[locationId].availableSlots > 0) {
                    currentData.parkingSpots[locationId].availableSlots--;
                    return currentData; 
                } else {
                    return; // Abort
                }
            }, (error, committed, snapshot) => {
                if (error) {
                    alert("Booking failed: " + error.message);
                } else if (!committed) {
                    alert("Sorry, all slots were just booked!");
                } else {
                    alert(`Booking confirmed!\nVehicle: ${vehicleNumber}`);
                    modal.classList.remove('is-visible');
                }
                button.textContent = "Confirm Booking";
                button.disabled = false;
            });
        }
    });
}

function openBookingModal(locationId) {
    // We must search both real and dummy data
    const allLocations = allFirebaseLocations.concat(generateDummyData(centerPinLocation)); // Use correct location
    const location = allLocations.find(loc => loc.id === locationId);
    if (!location) return;

    if (location.availableSlots === 0) {
        // This is caught by the 'unavailable' class, but good to double-check
        alert("Sorry, this location has no available slots.");
        return;
    }

    document.getElementById('modal-location-name').textContent = location.name;
    document.getElementById('booking-location-id').value = location.id;
    document.getElementById('booking-modal').classList.add('is-visible');
}


/**
 * 10. Google Places Autocomplete Search
 * (UPDATED to move the draggable pin)
 */
function initAutocomplete() {
    const input = document.getElementById('search-input');
    const autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.bindTo('bounds', map);

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) {
            return;
        }

        if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport);
        } else {
            map.setCenter(place.geometry.location);
            map.setZoom(17);
        }
        
        // --- NEW: Move the draggable pin to the searched location ---
        const newPos = place.geometry.location.toJSON();
        createDraggablePin(newPos); // This will move the pin
        processLocations(); // This will refresh the list
    });
}