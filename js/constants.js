/**
 * App-wide constants. Change ADMIN_EMAIL here (and in firestore.rules) to
 * transfer admin privileges to a different account.
 */

const ADMIN_EMAIL = "MayurAILabs@gmail.com";

// Predefined expense categories. Each has an id (stored on the expense doc),
// a display label, and an icon (Font Awesome class) for the UI.
const DEFAULT_CATEGORIES = [
  { id: "food", label: "Food", icon: "fa-utensils", color: "#FF6B6B" },
  { id: "groceries", label: "Groceries", icon: "fa-basket-shopping", color: "#4ECDC4" },
  { id: "rent", label: "Rent", icon: "fa-house", color: "#FFD166" },
  { id: "fuel", label: "Fuel", icon: "fa-gas-pump", color: "#06D6A0" },
  { id: "shopping", label: "Shopping", icon: "fa-bag-shopping", color: "#EF476F" },
  { id: "entertainment", label: "Entertainment", icon: "fa-film", color: "#A29BFE" },
  { id: "medical", label: "Medical", icon: "fa-briefcase-medical", color: "#FF8FA3" },
  { id: "education", label: "Education", icon: "fa-graduation-cap", color: "#4D96FF" },
  { id: "travel", label: "Travel", icon: "fa-plane", color: "#00C2A8" },
  { id: "utilities", label: "Utilities", icon: "fa-bolt", color: "#F9A826" },
  { id: "mobile_recharge", label: "Mobile Recharge", icon: "fa-mobile-screen", color: "#5C9EAD" },
  { id: "internet", label: "Internet", icon: "fa-wifi", color: "#2EC4B6" },
  { id: "investment", label: "Investment", icon: "fa-chart-line", color: "#3A86FF" },
  { id: "insurance", label: "Insurance", icon: "fa-shield-heart", color: "#8338EC" },
  { id: "emi", label: "EMI", icon: "fa-credit-card", color: "#FB5607" },
  { id: "salary", label: "Salary", icon: "fa-sack-dollar", color: "#38B000" },
  { id: "gifts", label: "Gifts", icon: "fa-gift", color: "#FF006E" },
  { id: "miscellaneous", label: "Miscellaneous", icon: "fa-ellipsis", color: "#9E9E9E" }
];

// Payment methods available on the expense form.
const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: "fa-money-bill-wave" },
  { id: "upi", label: "UPI", icon: "fa-mobile-retro" },
  { id: "credit_card", label: "Credit Card", icon: "fa-credit-card" },
  { id: "debit_card", label: "Debit Card", icon: "fa-credit-card" },
  { id: "net_banking", label: "Net Banking", icon: "fa-building-columns" },
  { id: "wallet", label: "Wallet", icon: "fa-wallet" },
  { id: "others", label: "Others", icon: "fa-ellipsis" }
];

// Firestore collection names, centralized to avoid typos.
const COLLECTIONS = {
  users: "users",
  expenses: "expenses",
  categories: "categories",
  budgets: "budgets"
};
