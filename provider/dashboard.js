// --- 1. INITIALIZE FIREBASE & GET ELEMENTS ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

const spacesListContainer = document.getElementById('spaces-list-container');
const loader = document.getElementById('loader');
const noSpacesMessage = document.getElementById('no-spaces-message');

let currentUser;

// --- 2. CHECK AUTH STATE ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        // Check their role
        database.ref('users/' + user.uid + '/role').once('value', snapshot => {
            const role = snapshot.val();
            if (role === 'provider_pending' || role === 'provider_verified') {
                // They are a provider, load their spaces
                loadProviderSpaces(user.uid);
            } else {
                // Not a provider, redirect them
                alert("You must register as a provider to access this page.");
                window.location.href = 'register_space.html';
            }
        });
    } else {
        // No user, send to login
        alert("You must be logged in to view this page.");
        window.location.href = '../login/login.html';
    }
});

// --- 3. LOAD PROVIDER'S SPACES ---
function loadProviderSpaces(providerId) {
    const spacesRef = database.ref('parkingSpots');
    
    // This query is the key:
    // It finds all spots where the 'providerId' child is equal to the current user's ID
    spacesRef.orderByChild('providerId').equalTo(providerId).on('value', snapshot => {
        loader.style.display = 'none'; // Hide loader
        spacesListContainer.innerHTML = ''; // Clear old list
        
        if (snapshot.exists()) {
            noSpacesMessage.style.display = 'none';
            snapshot.forEach(childSnapshot => {
                const spotId = childSnapshot.key;
                const spotData = childSnapshot.val();
                
                // Create the card
                const card = createSpaceCard(spotId, spotData);
                spacesListContainer.appendChild(card);
            });
        } else {
            // No spaces found
            noSpacesMessage.style.display = 'block';
        }
    });
}

// --- 4. CREATE THE HTML FOR A SINGLE CARD ---
function createSpaceCard(spotId, data) {
    const card = document.createElement('div');
    card.className = 'space-card';
    card.setAttribute('data-id', spotId);

    // 1. Info Column
    const info = document.createElement('div');
    info.className = 'space-info';
    info.innerHTML = `
        <h4>${data.name}</h4>
        <p>${data.address}</p>
        <span class="status ${data.status === 'pending_verification' ? 'status-pending' : 'status-verified'}">
            ${data.status.replace('_', ' ')}
        </span>
    `;

    // 2. Availability Column
    const availability = document.createElement('div');
    availability.className = 'space-availability';
    availability.innerHTML = `
        <h5>Available Slots: ${data.availableSlots} / ${data.totalSlots}</h5>
        <div class="availability-controls">
            <input type="number" class="availability-input" value="${data.availableSlots}" min="0" max="${data.totalSlots}">
            <button class="btn-update">Update</button>
        </div>
    `;

    // 3. Actions Column
    const actions = document.createElement('div');
    actions.className = 'space-actions';
    actions.innerHTML = `
        <button class="btn-edit">Edit</button>
        <button class="btn-delete">Delete</button>
    `;

    card.appendChild(info);
    card.appendChild(availability);
    card.appendChild(actions);

    return card;
}

// --- 5. HANDLE ACTIONS (DELETE, UPDATE, EDIT) ---
spacesListContainer.addEventListener('click', (e) => {
    const card = e.target.closest('.space-card');
    if (!card) return;

    const spotId = card.getAttribute('data-id');

    // Handle Delete
    if (e.target.classList.contains('btn-delete')) {
        if (confirm("Are you sure you want to permanently delete this space?")) {
            deleteSpace(spotId);
        }
    }
    
    // Handle Update Availability
    if (e.target.classList.contains('btn-update')) {
        const input = card.querySelector('.availability-input');
        const newAvailability = parseInt(input.value);
        updateAvailability(spotId, newAvailability);
    }
    
    // Handle Edit
    if (e.target.classList.contains('btn-edit')) {
        // We will build this page later
        alert("The 'Edit' page is not built yet. This will take you to a new form.");
        // window.location.href = `edit_space.html?id=${spotId}`;
    }
});

function deleteSpace(spotId) {
    // Note: This deletes the database entry, but not the photos in Storage.
    // That requires a more complex function.
    database.ref('parkingSpots/' + spotId).remove()
        .then(() => {
            alert("Space deleted successfully.");
            // The .on() listener will automatically refresh the list
        })
        .catch(error => alert(error.message));
}

function updateAvailability(spotId, newAvailability) {
    if (isNaN(newAvailability)) {
        alert("Please enter a valid number.");
        return;
    }
    
    database.ref('parkingSpots/' + spotId + '/availableSlots').set(newAvailability)
        .then(() => {
            alert("Availability updated!");
            // The .on() listener will automatically refresh the number
        })
        .catch(error => alert(error.message));
}