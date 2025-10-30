// This file will handle logic for both login.html and signup.html

// --- 1. FIREBASE CONFIGURATION ---
// Paste your `firebaseConfig` object from Step 1 here


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// --- 2. COMMON ELEMENTS ---
const googleSignInButton = document.getElementById('google-signin');
const togglePasswordButton = document.getElementById('toggle-password');
const passwordInput = document.getElementById('password');

// --- 3. GOOGLE SIGN-IN ---
if (googleSignInButton) {
    googleSignInButton.addEventListener('click', () => {
        auth.signInWithPopup(googleProvider)
            .then((result) => {
                // Successful sign-in
                console.log("Google Sign-In Success:", result.user);
                // Redirect to the main app page
                window.location.href = "../index.html"; // or 'dashboard.html'
            })
            .catch((error) => {
                // Handle Errors
                console.error("Google Sign-In Error:", error);
                alert(error.message);
            });
    });
}

// --- 4. PASSWORD VISIBILITY TOGGLE ---
if (togglePasswordButton && passwordInput) {
    togglePasswordButton.addEventListener('click', () => {
        // Toggle the type attribute
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);

        // Toggle the icon
        togglePasswordButton.classList.toggle('fa-eye');
        togglePasswordButton.classList.toggle('fa-eye-slash');
    });
}


// --- 5. LOGIN PAGE LOGIC ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent form from submitting normally

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginButton = document.getElementById('login-button');

        // Simple validation
        if (!email || !password) {
            alert('Please fill in all fields.');
            return;
        }
        
        // Disable button to prevent multiple clicks
        loginButton.disabled = true;
        loginButton.textContent = 'Signing In...';

        // Sign in with Firebase
        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Signed in 
                console.log("Login Success:", userCredential.user);
                // Redirect to the main app page (e.g., your first screenshot)
                window.location.href = "../index.html"; // or 'dashboard.html'
            })
            .catch((error) => {
                console.error("Login Error:", error);
                alert(error.message);
                // Re-enable button
                loginButton.disabled = false;
                loginButton.textContent = 'Sign In';
            });
    });
}


// --- 6. SIGN UP PAGE LOGIC ---
const signupForm = document.getElementById('signup-form');
if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const signupButton = document.getElementById('signup-button');

        // Simple validation
        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }
        
        // Disable button
        signupButton.disabled = true;
        signupButton.textContent = 'Signing Up...';

        // Create user with Firebase
        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Signed up 
                console.log("Sign Up Success:", userCredential.user);
                // Redirect to the main app page
                window.location.href = "../index.html"; // or 'dashboard.html'
                //  window.location.href = "Dashboard/dashboard.html"; // or 'dashboard.html'
            })
            .catch((error) => {
                console.error("Sign Up Error:", error);
                alert(error.message);
                // Re-enable button
                signupButton.disabled = false;
                signupButton.textContent = 'Sign Up';
            });
    });
}