/**
 * Firebase configuration and initialization (Compat SDK only).
 * This file must be loaded AFTER the firebase-app-compat, firebase-auth-compat
 * and firebase-firestore-compat <script> tags, and BEFORE any other app script
 * that touches `firebase.*` globals.
 */

const firebaseConfig = {
  apiKey: "AIzaSyAqmSUUJz5eYdI1VO4gmMDJcSalWlibAYU",
  authDomain: "expensemanager-b21ec.firebaseapp.com",
  projectId: "expensemanager-b21ec",
  storageBucket: "expensemanager-b21ec.firebasestorage.app",
  messagingSenderId: "113422778162",
  appId: "1:113422778162:web:83f55831453aaa557da12b",
  measurementId: "G-5YN5YP9XWR"
};

// Initialize Firebase (compat API)
firebase.initializeApp(firebaseConfig);

// Shared handles used across the app
const auth = firebase.auth();
const db = firebase.firestore();

// Keep the user signed in across browser restarts/tabs.
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Enable offline cache / real-time sync resilience.
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === "failed-precondition") {
    // Multiple tabs open, persistence can only be enabled in one tab at a time.
    console.warn("Offline persistence disabled: multiple tabs open.");
  } else if (err.code === "unimplemented") {
    console.warn("Offline persistence not supported by this browser.");
  }
});
