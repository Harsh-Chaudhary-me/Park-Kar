// --- 1. PASTE YOUR FIREBASE CONFIG HERE ---
// Add this new code to the very top of provider.js

// This dynamically builds the Google Maps script tag
const mapScript = document.createElement('script');
mapScript.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initProviderMap`;
mapScript.async = true;
mapScript.defer = true;
document.head.appendChild(mapScript); // Adds the <script> tag to the <head>

// ... all your other code (firebase.initializeApp, etc.) ...
// ...

// --- 2. INITIALIZE FIREBASE & GET ELEMENTS ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

const form = document.getElementById('list-space-form');
const loader = document.getElementById('form-loader');
const finalSubmitBtn = document.getElementById('btn-final-submit');

let currentUser;

// --- 3. CHECK AUTH STATE ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        // User is logged in, show the first step of the form.
        goToStep(1);
    } else {
        // No user is signed in. Redirect to login.
        alert("You must be logged in to list a space.");
        window.location.href = '../login/login.html';
    }
});

// --- 4. FORM STEP NAVIGATION ---
function goToStep(stepNumber) {
    document.querySelectorAll('.form-step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById(`step-${stepNumber}`).classList.add('active');
    document.getElementById('form-title').textContent = document.querySelector(`#step-${stepNumber} h3`).textContent;
}

// Button listener for "Next"
// Button listener for "Next" (NOW WITH VALIDATION)
document.getElementById('btn-next-step-2').addEventListener('click', () => {
    
    // --- VALIDATION START ---
    let isValid = true;
    const errorMessages = [];
    
    // 1. Get all inputs in Step 1 that have the 'required' attribute
    const requiredInputs = document.querySelectorAll('#step-1 input[required]');
    
    requiredInputs.forEach(input => {
        // Check if the value (after trimming whitespace) is empty
        if (input.value.trim() === '') {
            isValid = false;
            // Get the label text for a user-friendly error
            const label = input.closest('.form-group, .file-upload-group').querySelector('label');
            errorMessages.push(label ? label.textContent : 'A required field');
        }
    });

    // 2. Special check for the map
    const lat = document.getElementById('lat').value;
    if (!lat) {
        isValid = false;
        errorMessages.push('Exact Location Address (pinned on map)');
    }
    
    // --- VALIDATION END ---

    if (isValid) {
        // If everything is good, go to the next step
        goToStep(2);
    } else {
        // If something is missing, show an alert
        alert('Please fill in all required fields:\n\n• ' + errorMessages.join('\n• '));
    }
});


// --- 5. NEW GOOGLE MAP LOGIC ---
let map;
let marker;
let geocoder;

// This function is called by the Google Maps script tag
function initProviderMap() {
    const defaultLocation = { lat: 20.5937, lng: 78.9629 }; // Center of India
    geocoder = new google.maps.Geocoder();

    map = new google.maps.Map(document.getElementById("map-container"), {
        center: defaultLocation,
        zoom: 5,
    });

    // Create the draggable marker
    marker = new google.maps.Marker({
        position: defaultLocation,
        map: map,
        draggable: true,
        title: "Drag me to your parking spot!"
    });

    // Handle marker drag event
    marker.addListener('dragend', (event) => {
        const newPos = event.latLng;
        geocodePosition(newPos);
    });

    // Initialize the Places Search Box
    const searchInput = document.getElementById('map-search');
    const searchBox = new google.maps.places.Autocomplete(searchInput);
    
    // Bias search results to the map's viewport
    searchBox.bindTo('bounds', map);

    // Listen for when the user selects a place
    searchBox.addListener('place_changed', () => {
        const place = searchBox.getPlace();

        if (!place.geometry || !place.geometry.location) {
            console.log("No details available for input: '" + place.name + "'");
            return;
        }

        // Move the map and marker to the new location
        if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport);
        } else {
            map.setCenter(place.geometry.location);
            map.setZoom(17);
        }
        marker.setPosition(place.geometry.location);

        // Update the form fields
        updateLocationFields(
            place.geometry.location.lat(),
            place.geometry.location.lng(),
            place.formatted_address
        );
    });
}

// Function to update fields when marker is dragged
function geocodePosition(pos) {
    geocoder.geocode({
        location: pos
    }, (results, status) => {
        if (status === 'OK') {
            if (results[0]) {
                // Update the form fields with the new address
                updateLocationFields(
                    pos.lat(),
                    pos.lng(),
                    results[0].formatted_address
                );
            } else {
                window.alert('No results found');
            }
        } else {
            window.alert('Geocoder failed due to: ' + status);
        }
    });
}

// Helper function to update the hidden form fields
function updateLocationFields(lat, lng, address) {
    document.getElementById('lat').value = lat;
    document.getElementById('lng').value = lng;
    document.getElementById('address').value = address;
}
// --- END NEW MAP LOGIC ---


// --- 6. FINAL FORM SUBMISSION (UPDATED) ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Show loader, disable button
    loader.style.display = 'block';
    finalSubmitBtn.disabled = true;
    finalSubmitBtn.textContent = 'Submitting...';

    try {
        // --- A: UPLOAD FILES ---
        const photo1File = document.getElementById('photo1').files[0];
        const documentFile = document.getElementById('document').files[0];

        const uploadFile = async (file, path) => {
            if (!file) return null;
            const ref = storage.ref(`parkingSpots/${currentUser.uid}/${path}/${file.name}`);
            const snapshot = await ref.put(file);
            return await snapshot.ref.getDownloadURL();
        };

        const [photo1_url, document_url] = await Promise.all([
            uploadFile(photo1File, 'photos'),
            uploadFile(documentFile, 'documents')
        ]);

        if (!photo1_url || !document_url) {
            throw new Error("Photo and Document are required.");
        }

        // --- B: SAVE DATA TO REALTIME DATABASE (UPDATED) ---
        
        // 1. Save Bank Details to the private user profile
        const payoutDetails = {
            accountHolderName: document.getElementById('bank-name').value,
            accountNumber: document.getElementById('bank-account').value,
            ifscCode: document.getElementById('bank-ifsc').value
        };
        const phone = document.getElementById('phone').value;
        
        await database.ref('users/' + currentUser.uid + '/payoutDetails').set(payoutDetails);
        await database.ref('users/' + currentUser.uid + '/phone').set(phone);
        
        // 2. Save Property Details to the public parkingSpots list
        const totalSlots = parseInt(document.getElementById('total-slots').value);
        const spotData = {
            providerId: currentUser.uid,
            providerPhone: phone,
            name: document.getElementById('name').value,
            
            // --- NEW LOCATION DATA ---
            address: document.getElementById('address').value,
            lat: parseFloat(document.getElementById('lat').value),
            lng: parseFloat(document.getElementById('lng').value),
            // --- END NEW LOCATION DATA ---
            
            locationSize: document.getElementById('size').value,
            totalSlots: totalSlots,
            availableSlots: totalSlots,
            pricePerHour: parseFloat(document.getElementById('price').value),
            availableTimeStart: document.getElementById('time-start').value,
            availableTimeEnd: document.getElementById('time-end').value,
            status: "pending_verification", 
            photos: {
                photo1_url: photo1_url,
            },
            document_url: document_url
        };
        
        // Check if lat/lng are set
        if (!spotData.lat || !spotData.lng) {
            throw new Error("Location not set. Please pin your location on the map.");
        }
        
        await database.ref('parkingSpots').push(spotData);
        await database.ref('users/' + currentUser.uid + '/role').set('provider_pending');

        // --- C: FINISH ---
        loader.style.display = 'none';
        alert('Success! Your space has been submitted for verification. We will review it shortly.');
        form.reset();
        goToStep(1); 
        finalSubmitBtn.disabled = false;
        finalSubmitBtn.textContent = 'Submit for Verification';

    } catch (error) {
        console.error("Error submitting form:", error);
        alert('An error occurred: ' + error.message);
        loader.style.display = 'none';
        finalSubmitBtn.disabled = false;
        finalSubmitBtn.textContent = 'Submit for Verification';
    }
});