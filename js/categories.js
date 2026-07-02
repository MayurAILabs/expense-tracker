/**
 * Category management: merges the predefined DEFAULT_CATEGORIES with the
 * signed-in user's custom categories (stored as a single document at
 * categories/{uid} with an `items` map, per the requested Firestore layout).
 * Keeps every <select> and the category grid in sync in real time.
 */

let customCategories = []; // [{ id, name, icon, color }]
let categoriesUnsubscribe = null;

function categoriesDocRef() {
  return db.collection(COLLECTIONS.categories).doc(currentUser.uid);
}

/** Combined list of default + custom categories, normalized to a common shape. */
function getAllCategories() {
  const defaults = DEFAULT_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    color: c.color,
    custom: false
  }));
  const customs = customCategories.map((c) => ({
    id: c.id,
    label: c.name,
    icon: c.icon || "fa-tag",
    color: c.color || "#667eea",
    custom: true
  }));
  return [...defaults, ...customs];
}

function getCategoryMeta(categoryId) {
  return (
    getAllCategories().find((c) => c.id === categoryId) || {
      id: categoryId,
      label: categoryId || "Uncategorized",
      icon: "fa-tag",
      color: "#9E9E9E",
      custom: false
    }
  );
}

/** Starts a real-time listener on the user's custom categories document. */
function startCategoriesListener() {
  if (categoriesUnsubscribe) categoriesUnsubscribe();
  categoriesUnsubscribe = categoriesDocRef().onSnapshot(
    (doc) => {
      const data = doc.data() || {};
      const items = data.items || {};
      customCategories = Object.keys(items).map((id) => ({ id, ...items[id] }));
      renderCategoryGrid();
      populateCategorySelects();
      window.dispatchEvent(new CustomEvent("categories-updated"));
    },
    (err) => console.error("Categories listener error:", err)
  );
}

/** Fills every category <select> in the app with the current category list. */
function populateCategorySelects() {
  const selects = [
    document.getElementById("expense-category"),
    document.getElementById("filter-category"),
    document.getElementById("budget-category"),
    document.getElementById("admin-filter-category")
  ].filter(Boolean);

  const cats = getAllCategories();

  selects.forEach((select) => {
    const isFilter = select.id === "filter-category" || select.id === "admin-filter-category";
    const previousValue = select.value;
    select.innerHTML = isFilter ? '<option value="">All Categories</option>' : "";
    cats.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      select.appendChild(opt);
    });
    if ([...select.options].some((o) => o.value === previousValue)) {
      select.value = previousValue;
    }
  });
}

function renderCategoryGrid() {
  const grid = document.getElementById("category-grid");
  if (!grid) return;
  const cats = getAllCategories();

  grid.innerHTML =
    cats
      .map(
        (c) => `
      <div class="category-card ${c.custom ? "custom" : ""} fade-in" data-id="${c.id}">
        ${
          c.custom
            ? `<div class="cat-actions">
                <button class="edit-cat-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="delete-cat-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
              </div>`
            : ""
        }
        <div class="cat-icon" style="background:${c.color}"><i class="fa-solid ${c.icon}"></i></div>
        <div class="cat-label">${escapeHtml(c.label)}</div>
      </div>`
      )
      .join("") +
    `<div class="category-card add-category-card" id="open-add-category"><i class="fa-solid fa-circle-plus"></i><span>Add Category</span></div>`;

  document.getElementById("open-add-category").addEventListener("click", () => openCategoryModal());

  grid.querySelectorAll(".edit-cat-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.closest(".category-card").dataset.id;
      const cat = customCategories.find((c) => c.id === id);
      if (cat) openCategoryModal(cat);
    })
  );

  grid.querySelectorAll(".delete-cat-btn").forEach((btn) =>
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.closest(".category-card").dataset.id;
      const ok = await confirmDialog({
        title: "Delete category?",
        message: "Existing expenses in this category will keep showing it, but it will no longer be selectable.",
        confirmText: "Delete"
      });
      if (ok) deleteCategory(id);
    })
  );
}

function openCategoryModal(category = null) {
  const modal = document.getElementById("category-modal");
  document.getElementById("category-modal-title").textContent = category ? "Edit Category" : "Add Category";
  document.getElementById("category-id").value = category ? category.id : "";
  document.getElementById("category-name").value = category ? category.name : "";
  document.getElementById("category-icon").value = category ? category.icon || "fa-tag" : "fa-tag";
  document.getElementById("category-color").value = category ? category.color || "#667eea" : "#667eea";
  modal.classList.add("active");
}

async function saveCategoryFromForm(e) {
  e.preventDefault();
  const id = document.getElementById("category-id").value;
  const name = document.getElementById("category-name").value.trim();
  const icon = document.getElementById("category-icon").value;
  const color = document.getElementById("category-color").value;

  if (!name) return;

  const categoryId = id || db.collection("_ids").doc().id;
  try {
    await categoriesDocRef().set(
      {
        items: {
          [categoryId]: {
            name,
            icon,
            color,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            ...(id ? {} : { createdAt: firebase.firestore.FieldValue.serverTimestamp() })
          }
        }
      },
      { merge: true }
    );
    showToast(id ? "Category updated" : "Category added", "success");
    closeModal("category-modal");
  } catch (err) {
    console.error("Failed to save category:", err);
    showToast("Could not save category", "error");
  }
}

async function deleteCategory(id) {
  try {
    await categoriesDocRef().update({
      [`items.${id}`]: firebase.firestore.FieldValue.delete()
    });
    showToast("Category deleted", "success");
  } catch (err) {
    console.error("Failed to delete category:", err);
    showToast("Could not delete category", "error");
  }
}

document.getElementById("category-form").addEventListener("submit", saveCategoryFromForm);
