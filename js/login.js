/**
 * Login page controller: handles Google Sign-In, redirect-if-already-logged-in,
 * and the light/dark theme toggle (persisted in localStorage).
 */

(function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  document.body.setAttribute("data-theme", saved);
  updateThemeIcon(saved);
})();

function updateThemeIcon(theme) {
  const btn = document.getElementById("theme-toggle-login");
  if (!btn) return;
  btn.innerHTML = theme === "dark" ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

document.getElementById("theme-toggle-login").addEventListener("click", () => {
  const current = document.body.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  updateThemeIcon(next);
});

const signInBtn = document.getElementById("google-signin-btn");
const loadingEl = document.getElementById("login-loading");
const errorEl = document.getElementById("login-error");

function setLoading(isLoading) {
  loadingEl.classList.toggle("show", isLoading);
  signInBtn.style.display = isLoading ? "none" : "flex";
}

function showLoginError(message) {
  errorEl.textContent = message;
  errorEl.classList.add("show");
}

// If a session already exists, skip the login screen entirely.
auth.onAuthStateChanged((user) => {
  if (user) {
    window.location.replace("dashboard.html");
  }
});

signInBtn.addEventListener("click", async () => {
  errorEl.classList.remove("show");
  setLoading(true);

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;

    // Create/update the user's profile document so the admin panel can list them.
    const userRef = db.collection(COLLECTIONS.users).doc(user.uid);
    const existing = await userRef.get();
    const profile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!existing.exists) {
      profile.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    await userRef.set(profile, { merge: true });

    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("Google sign-in failed:", err);
    setLoading(false);
    if (err.code === "auth/popup-closed-by-user") {
      showLoginError("Sign-in was cancelled. Please try again.");
    } else {
      showLoginError("Unable to sign in right now. Please try again.");
    }
  }
});
