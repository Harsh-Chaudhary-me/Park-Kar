// --- 1. PASTE YOUR FIREBASE CONFIG HERE (Same as main.js) ---


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// --- 2. GET HTML ELEMENTS ---
const profileForm = document.getElementById('profile-form');
const formTitle = document.getElementById('form-title');
const nameInput = document.getElementById('name');
const phoneInput = document.getElementById('phone');
const saveButton = document.getElementById('save-button');
const successMessage = document.getElementById('success-message');

let currentUser; // Variable to store the user object

// --- 3. CHECK AUTH STATE ---
auth.onAuthStateChanged(user => {
    if (user) {
        // User is logged in
        currentUser = user;
        
        // Load existing profile data
        const userRef = database.ref('users/' + user.uid);
        userRef.once('value').then(snapshot => {
            if (snapshot.exists()) {
                // User is returning, pre-fill the form
                const data = snapshot.val();
                nameInput.value = data.name || '';
                phoneInput.value = data.phone || '';
                
                // Change UI to "Edit" mode
                formTitle.textContent = 'Edit Your Profile';
                saveButton.textContent = 'Update Profile';
            }
            // If snapshot doesn't exist, the form is empty
            // which is perfect for "Complete Your Profile"
        });

    } else {
        // User is not logged in. Redirect to login page.
        alert("You must be logged in to view this page.");
        window.location.href = '../login/login.html';
    }
});

// --- 4. HANDLE FORM SUBMIT ---
profileForm.addEventListener('submit', e => {
    e.preventDefault(); // Prevent form from submitting

    if (!currentUser) {
        alert("No user is logged in.");
        return;
    }

    const uid = currentUser.uid;
    const name = nameInput.value;
    const phone = phoneInput.value;

    // Save the data to Realtime Database
    database.ref('users/' + uid).set({
        name: name,
        phone: phone,
        email: currentUser.email // Store email for reference
    })
    .then(() => {
        // Show success message
        successMessage.style.display = 'block';
        // Change button to "Update" in case it was "Save"
        saveButton.textContent = 'Update Profile';
        formTitle.textContent = 'Edit Your Profile';
        
        // Hide message after 3 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
        
        // Optional: Redirect back to home page after saving
        setTimeout(() => {
            window.location.href = '../../index.html';
        }, 1000);
    })
    .catch(error => {
        console.error("Error saving profile:", error);
        alert(error.message);
    });
});