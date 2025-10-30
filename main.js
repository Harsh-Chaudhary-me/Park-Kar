// --- 1. PASTE YOUR FIREBASE CONFIG HERE ---


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database(); // Initialize Realtime Database

// --- 2. GET HTML ELEMENTS ---
const loggedOutNav = document.getElementById('logged-out-nav');
const loggedInNav = document.getElementById('logged-in-nav');

const avatarButton = document.getElementById('avatar-button');
const dropdown = document.getElementById('dropdown');
const signOutButton = document.getElementById('sign-out-button');

const avatarInitial = document.getElementById('avatar-initial');
const userNameDisplay = document.getElementById('user-name');

// --- 3. THE "BRAIN": onAuthStateChanged ---
// This function runs every time the page loads and when the login state changes
auth.onAuthStateChanged(user => {
    if (user) {
        // --- USER IS LOGGED IN ---
        
        // 1. Show the "logged in" nav, hide the "logged out" nav
        loggedInNav.style.display = 'block';
        loggedOutNav.style.display = 'none';

        // 2. Fetch user's profile data from Realtime Database
        const userRef = database.ref('users/' + user.uid);
        userRef.once('value').then(snapshot => {
            if (snapshot.exists()) {
                // User has profile data in the database
                const data = snapshot.val();
                const name = data.name || user.email; // Use name, or email as fallback
                
                userNameDisplay.textContent = name;
                avatarInitial.textContent = name[0].toUpperCase();
            } else {
                // This is a new user (or profile data doesn't exist)
                // We'll force them to the dashboard to complete their profile
                console.log("No profile data found. Redirecting to dashboard.");
                // Check if we are already on the dashboard page to prevent redirect loop
                if (!window.location.pathname.endsWith('dashboard.html')) {
                    // window.location.href = 'dashboard.html';
                    window.location.href = 'Dashboard/dashboard.html';
                }
                
                // Use email as a fallback for the avatar
                const email = user.email;
                userNameDisplay.textContent = "Welcome!";
                avatarInitial.textContent = email[0].toUpperCase();
            }
        });

    } else {
        // --- USER IS LOGGED OUT ---
        
        // 1. Show the "logged out" nav, hide the "logged in" nav
        loggedInNav.style.display = 'none';
        loggedOutNav.style.display = 'flex'; // Use 'flex' to match the original
    }
});

// --- 4. DROPDOWN MENU LOGIC ---
avatarButton.addEventListener('click', () => {
    // Toggle the 'show' class to display or hide the dropdown
    dropdown.classList.toggle('show');
});

// Close dropdown if user clicks outside of it
window.addEventListener('click', e => {
    if (!avatarButton.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('show');
    }
});

// --- 5. SIGN OUT BUTTON LOGIC ---
signOutButton.addEventListener('click', () => {
    auth.signOut().then(() => {
        // Sign-out successful.
        // The onAuthStateChanged listener will automatically handle the UI change
        console.log("User signed out.");
        // Redirect to home page
        window.location.href = 'index.html';
    }).catch(error => {
        // An error happened.
        console.error("Sign out error:", error);
    });
});

// --- 16. CONTACT FORM SUBMISSION ---

// Get the new form element
const contactForm = document.getElementById('contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', e => {
        e.preventDefault(); // Stop the form from reloading the page

        // Get form values
        const name = document.getElementById('contact-name').value;
        const phone = document.getElementById('contact-phone').value;
        const city = document.getElementById('contact-city').value;
        const company = document.getElementById('contact-company').value;
        const message = document.getElementById('contact-message').value;

        // Get the submit button to show a "loading" state
        const submitButton = contactForm.querySelector('.btn-blue-submit');
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';

        // Check if a user is logged in
        const user = auth.currentUser;
        
        // Create the data object to save
        const messageData = {
            name: name,
            phone: phone,
            city: city,
            company: company,
            message: message,
            timestamp: new Date().toISOString(),
            // If user is logged in, save their info too
            sentBy_uid: user ? user.uid : 'Guest',
            sentBy_email: user ? user.email : 'Guest'
        };

        // Save to Firebase Realtime Database
        // This creates a new "contactMessages" list and adds a unique entry
        database.ref('contactMessages').push(messageData)
            .then(() => {
                // Success!
                alert('Message sent! We will get back to you soon.');
                contactForm.reset(); // Clear the form
                submitButton.disabled = false;
                submitButton.textContent = 'Submit';
            })
            .catch(error => {
                // Error!
                console.error("Error sending message:", error);
                alert('Error: ' + error.message);
                submitButton.disabled = false;
                submitButton.textContent = 'Submit';
            });
    });
}