# Expense Tracker

A modern, colorful, responsive expense tracker built with plain HTML5, CSS3
and vanilla JavaScript, backed by Firebase Authentication (Google Sign-In)
and Cloud Firestore. Uses the **Firebase Compat SDK only** — no bundler, no
frameworks, no build step.

## Folder structure

```
ExpenseManager/
├── index.html            # Login page (Google Sign-In)
├── dashboard.html         # Main app shell (user + admin views)
├── firestore.rules        # Cloud Firestore security rules
├── css/
│   ├── styles.css         # Shared variables, buttons, forms, modals, toasts
│   ├── login.css          # Login page specific styles
│   └── dashboard.css      # Sidebar, topbar, cards, charts, tables, FAB
└── js/
    ├── firebase-config.js # Firebase compat initialization
    ├── constants.js       # ADMIN_EMAIL, categories, payment methods
    ├── utils.js            # Toasts, confirm dialog, date/currency helpers
    ├── login.js            # Login page logic
    ├── auth.js             # Auth state, logout, admin check (dashboard)
    ├── categories.js       # Default + custom category CRUD
    ├── expenses.js         # Expense CRUD, filters, sorting, summary cards
    ├── charts.js            # Chart.js visualizations (user dashboard)
    ├── budget.js            # Budget tracking + exceeded warnings
    ├── reports.js            # Report ranges + CSV/Excel/PDF export
    ├── admin.js               # Admin-only dashboard (users, all expenses)
    └── dashboard.js           # Orchestrator: nav, theme, modals, boot
```

## 1. Firebase Console setup

1. Go to the [Firebase Console](https://console.firebase.google.com/) and
   open the **expensemanager-b21ec** project (already referenced in
   `js/firebase-config.js` — no changes needed unless you use your own
   project).
2. **Authentication**
   - Go to **Build → Authentication → Sign-in method**.
   - Enable the **Google** provider. Set a support email if prompted.
   - Under **Settings → Authorized domains**, add the domain(s) you'll host
     the app on (e.g. `localhost` is included by default for local testing).
3. **Cloud Firestore**
   - Go to **Build → Firestore Database → Create database**.
   - Choose **Production mode** (we ship our own security rules below) and
     a region close to your users.
4. **Deploy security rules**
   - Open the **Rules** tab of Firestore in the console and paste the
     contents of [`firestore.rules`](firestore.rules), or deploy via the
     Firebase CLI:
     ```bash
     npm install -g firebase-tools
     firebase login
     firebase init firestore   # point it at this folder, keep existing rules file
     firebase deploy --only firestore:rules
     ```

## 2. Admin account

The admin is determined purely by e‑mail address, defined in **one place**:

- `js/constants.js` → `ADMIN_EMAIL`
- `firestore.rules` → the `isAdmin()` function

Both currently point to `MayurAILabs@gmail.com`. To change the admin
account, update the email in **both** files (they must match) and
re-deploy the Firestore rules. Sign in with that Google account once so a
`users/{uid}` profile document is created — the admin panel then becomes
visible in the sidebar for that account.

## 3. Firestore collection structure

```
users/{uid}
  uid, email, displayName, photoURL, createdAt, lastLogin

expenses/{expenseId}
  uid, userEmail, userName, expenseName, amount, category, categoryLabel,
  paymentMethod, date (YYYY-MM-DD), time (HH:MM), notes,
  createdAt, updatedAt, timestamp

categories/{uid}
  items: { categoryId: { name, icon, color, createdAt, updatedAt } }

budgets/{uid}
  overall, categories: { categoryId: amount }, updatedAt
```

Every expense document carries the owner's `uid`; the security rules use
this to guarantee a user can only read/write their own expenses (or, if
`isAdmin()`, anyone's).

## 4. Running locally

This is a static site — any local web server works (Google Sign-In popups
require `http://` or `https://`, not `file://`).

```bash
# Option A: Node's http-server
npx http-server -p 5500

# Option B: Python
python -m http.server 5500

# Option C: VS Code "Live Server" extension

# Option D: bundled no-dependency PowerShell server (Windows)
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/serve.ps1 -Port 5500
```

Then open `http://localhost:5500/index.html`.

## 5. Authentication flow

- `index.html` shows a "Continue with Google" button (`js/login.js`) which
  calls `signInWithPopup` with `GoogleAuthProvider`.
- On success, a `users/{uid}` profile document is created/updated and the
  browser redirects to `dashboard.html`.
- `js/auth.js` listens with `onAuthStateChanged`; if nobody is signed in it
  redirects back to `index.html`. Firebase Auth persistence is set to
  `LOCAL`, so the session survives page reloads and browser restarts.
- Logging out (sidebar button) calls `auth.signOut()` and redirects to the
  login page.

## 6. Admin vs. user views

- `js/auth.js` computes `isAdmin()` by comparing the signed-in email to
  `ADMIN_EMAIL`. When true, the "Admin Panel" nav item and an "Admin" badge
  become visible, and `js/admin.js` starts real-time listeners on **all**
  users and **all** expenses (permitted only for the admin by
  `firestore.rules`).
- Normal users' listeners are always scoped with
  `.where("uid", "==", currentUser.uid)`, and the security rules
  independently enforce the same restriction server-side — the UI check is
  a convenience, not the security boundary.

## 7. Features implemented

- Google SSO login/logout with persisted sessions
- Per-user expenses, categories and budgets (admin can see/manage all)
- Add / edit / delete expenses with name, amount, category, date, time,
  payment method and optional notes
- Predefined + custom categories (add/edit/delete, stored per user)
- Dashboard summary cards (today/week/month/year/total, top category,
  average daily spend, transaction count)
- 6 real-time Chart.js charts (daily, weekly, monthly, yearly, category
  pie, payment method) that refresh automatically on data changes
- Search, filter (category/payment/month/year/amount range) and sort
  (latest/oldest/highest/lowest)
- Reports for today/yesterday/week/month/year/custom range with CSV,
  Excel (SheetJS) and PDF (jsPDF + autotable) export
- Monthly budget tracking (overall + per category) with progress bars and
  an exceeded-budget toast warning
- Admin dashboard: all users, all expenses, user-wise filtering/search,
  overall stats, spend-by-user and spend-by-category charts, edit/delete
  any expense, export user-wise CSV
- Dark/light theme toggle (persisted), responsive layout, toast
  notifications, confirmation dialogs, empty states, FAB, offline
  persistence via Firestore's local cache

## 8. Notes & limitations

- Currency formatting defaults to INR (₹) via `Intl.NumberFormat`; change
  the locale/currency in `js/utils.js` → `formatCurrency` if needed.
- The admin's category filter dropdown is built from the admin's own
  categories (defaults + their custom ones); other users' custom category
  *names* still display correctly everywhere else because each expense
  stores a `categoryLabel` snapshot at creation time.
- Offline support comes from Firestore's built-in local cache
  (`enablePersistence`), which queues writes made while offline and syncs
  them once connectivity returns.
