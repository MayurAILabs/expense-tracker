/**
 * Authentication controller for the dashboard shell.
 * - Redirects to the login page if nobody is signed in.
 * - Exposes `currentUser` and `isAdmin()` for every other module.
 * - Fires a window "auth-ready" CustomEvent once we know who's signed in,
 *   which dashboard.js listens to before wiring up the rest of the app.
 */

let currentUser = null;

/** Admin status is derived purely from the signed-in email vs ADMIN_EMAIL. */
function isAdmin(user = currentUser) {
  return !!user && !!user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function renderUserSidebar(user) {
  const photo = document.getElementById("sidebar-user-photo");
  const name = document.getElementById("sidebar-user-name");
  const email = document.getElementById("sidebar-user-email");

  const fallback = `https://ui-avatars.com/api/?background=667eea&color=fff&name=${encodeURIComponent(user.displayName || user.email)}`;
  photo.src = user.photoURL || fallback;
  photo.onerror = () => { photo.onerror = null; photo.src = fallback; };
  name.textContent = user.displayName || "User";
  email.textContent = user.email;
}

function applyAdminVisibility(admin) {
  document.querySelectorAll(".admin-only").forEach((el) => el.classList.toggle("hidden", !admin));
}

function initAuth() {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.replace("index.html");
      return;
    }
    currentUser = user;
    renderUserSidebar(user);
    applyAdminVisibility(isAdmin(user));
    window.dispatchEvent(new CustomEvent("auth-ready", { detail: { user, admin: isAdmin(user) } }));
  });
}

document.getElementById("logout-btn").addEventListener("click", async () => {
  const ok = await confirmDialog({
    title: "Log out?",
    message: "You will need to sign in again to access your expenses.",
    confirmText: "Logout",
    danger: false
  });
  if (!ok) return;
  try {
    await auth.signOut();
    window.location.replace("index.html");
  } catch (err) {
    console.error("Logout failed:", err);
    showToast("Failed to log out. Please try again.", "error");
  }
});

initAuth();
