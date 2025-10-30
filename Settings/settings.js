// --- 1. PASTE YOUR FIREBASE CONFIG HERE ---
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// --- 2. GET HTML ELEMENTS ---
const changePasswordForm = document.getElementById('change-password-form');
const currentPasswordInput = document.getElementById('current-password');
const newPasswordInput = document.getElementById('new-password');
const confirmNewPasswordInput = document.getElementById('confirm-new-password');
const passwordSuccess = document.getElementById('password-success');
const passwordError = document.getElementById('password-error');

const deleteAccountButton = document.getElementById('delete-account-button');

let currentUser; // Variable to store the user object

// --- 3. CHECK AUTH STATE ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user; // Store the user object
    } else {
        // No user is signed in. Redirect to login.
        // We go UP one level, then into the login folder
        alert("You must be logged in to view settings.");
        window.location.href = '../login/login.html';
    }
});

// --- 4. CHANGE PASSWORD LOGIC ---
changePasswordForm.addEventListener('submit', e => {
    e.preventDefault();
    
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmNewPasswordInput.value;

    // Reset messages
    passwordSuccess.style.display = 'none';
    passwordError.style.display = 'none';

    // Validate new passwords
    if (newPassword !== confirmPassword) {
        passwordError.textContent = "New passwords do not match.";
        passwordError.style.display = 'block';
        return;
    }

    // Firebase requires re-authentication for sensitive actions
    const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, currentPassword);
    
    currentUser.reauthenticateWithCredential(credential).then(() => {
        // User re-authenticated successfully. Now update password.
        return currentUser.updatePassword(newPassword);

    }).then(() => {
        // Password updated!
        passwordSuccess.style.display = 'block';
        changePasswordForm.reset(); // Clear the form
        
        setTimeout(() => {
            passwordSuccess.style.display = 'none';
        }, 3000);

    }).catch(error => {
        // An error happened.
        console.error("Password Update Error:", error);
        passwordError.textContent = error.message; // Show error (e.g., "Wrong password")
        passwordError.style.display = 'block';
    });
});

// --- 5. DELETE ACCOUNT LOGIC ---
deleteAccountButton.addEventListener('click', () => {
    // 1. Confirm this is what they want
    if (!confirm("Are you ABSOLUTELY sure you want to delete your account? This cannot be undone.")) {
        return;
    }

    // 2. Re-authenticate the user
    const password = prompt("To confirm, please enter your password:");
    if (!password) {
        return; // User cancelled the prompt
    }

    const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);

    currentUser.reauthenticateWithCredential(credential).then(() => {
        // User re-authenticated. Now delete their data and account.
        
        // Step A: Delete their data from Realtime Database
        const userRef = database.ref('users/' + currentUser.uid);
        userRef.remove().then(() => {
            
            // Step B: Delete the user's auth account
            currentUser.delete().then(() => {
                // Account deleted.
                alert("Your account has been permanently deleted.");
                window.location.href = '../index.html'; // Redirect to home
            }).catch(error => {
                console.error("Error deleting user auth:", error);
                alert("Error deleting your account: " + error.message);
            });

        }).catch(error => {
            console.error("Error deleting user data:", error);
            alert("Error deleting your user data: " + error.message);
        });

    }).catch(error => {
        // An error happened (e.g., wrong password)
        console.error("Re-authentication Error:", error);
        alert("Wrong password. Account deletion cancelled.");
    });
});