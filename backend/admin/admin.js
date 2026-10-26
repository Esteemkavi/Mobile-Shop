(() => {
  const $ = (id) => document.getElementById(id);
  let csrfToken = "";
  let categories = [];
  let products = [];
  let bulkFiles = [];
  const MAX_UPLOAD_BYTES = 1024 * 1024;
  const MAX_SOURCE_IMAGE_BYTES = 30 * 1024 * 1024;
  const MAX_IMAGE_EDGE = 2400;
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const setMessage = (node, message, ok = false) => { node.textContent = message || ""; node.classList.toggle("ok", ok); };
  const formatBytes = (bytes) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  async function api(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (["POST", "PATCH", "DELETE"].includes((options.method || "GET").toUpperCase()) && csrfToken) headers.set("X-CSRF-Token", csrfToken);
    const response = await fetch(url, { ...options, headers, credentials: "same-origin" });
    if (response.status === 204) return null;
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    return result;
  }
  async function compressImage(file) {
    if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error(`${file.name} is larger than 30 MB. Choose a smaller image.`);
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error(`${file.name} could not be opened as an image.`); }
    try {
      if (file.size <= MAX_UPLOAD_BYTES) return file;
      let optimized;
      for (const maxEdge of [MAX_IMAGE_EDGE, 2000, 1800, 1600, 1400, 1200]) {
        const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d", { alpha: true });
        if (!context) throw new Error("Image optimization is not available in this browser.");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.92, 0.88, 0.84, 0.8, 0.76, 0.72]) {
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
          if (!blob) throw new Error(`Could not optimize ${file.name}.`);
          optimized = new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp", lastModified: file.lastModified });
          if (optimized.size <= MAX_UPLOAD_BYTES) return optimized;
        }
      }
      throw new Error(`${file.name} could not be reduced below 1 MB while keeping a usable image quality. Choose a smaller image.`);
    } finally { bitmap.close(); }
  }
  function refreshAutoBulkNames() {
    const counters = new Map(categories.map((category) => [category.slug, products.filter((product) => product.category_slug === category.slug).length]));
    for (const item of bulkFiles) {
      const category = categories.find((entry) => entry.slug === item.category_slug);
      if (!category) continue;
      const number = (counters.get(category.slug) || 0) + 1;
      counters.set(category.slug, number);
      if (item.auto_name) item.name = `${category.name} ${number}`;
    }
  }
  function showSignedIn(username) {
    $("loginPanel").classList.add("hidden");
    $("adminPanel").classList.remove("hidden");
    $("logout").classList.remove("hidden");
    $("logout").textContent = `Log out (${username})`;
    loadData().catch((error) => setMessage($("notice"), error.message));
  }
  async function refreshSession() {
    try {
      const session = await api("/api/admin/session");
      csrfToken = session.csrfToken || "";
      showSignedIn(session.username);
    } catch {
      $("loginPanel").classList.remove("hidden");
      $("adminPanel").classList.add("hidden");
      $("logout").classList.add("hidden");
    }
  }
  async function loadData() {
    const [categoryData, productData] = await Promise.all([api("/api/admin/categories"), api("/api/admin/products")]);
    categories = categoryData.categories;
    products = productData.products;
    renderCategories();
    renderProducts();
    setMessage($("notice"), "Admin data loaded.", true);
  }
  function renderCategories() {
    const select = $("productCategory");
    const oldValue = select.value;
    select.replaceChildren(...categories.map((category) => {
      const option = document.createElement("option");
      option.value = category.slug;
      option.textContent = `${category.name}${category.is_active ? "" : " (hidden)"}`;
      return option;
    }));
    if (categories.some((category) => category.slug === oldValue)) select.value = oldValue;
    const list = $("categoryList");
    list.innerHTML = categories.length ? categories.map((category) => `<article class="item"><div class="item-main"><div class="item-title">${safe(category.icon)} ${safe(category.name)}</div><div class="item-meta">${safe(category.slug)} · order ${safe(category.display_order)} · ${category.is_active ? "Visible" : "Hidden"}</div></div><div class="item-actions"><button class="quiet" data-category-edit="${safe(category.slug)}" type="button">Edit</button><button class="danger" data-category-delete="${safe(category.slug)}" type="button">Remove</button></div></article>`).join("") : '<div class="empty">No categories yet.</div>';
  }
  function renderBulkRows() {
    const container = $("bulkProductRows");
    container.replaceChildren();
    bulkFiles.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "bulk-product-card";
      const title = document.createElement("h3");
      title.textContent = `Product ${index + 1}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "quiet bulk-remove";
      remove.dataset.removeBulk = String(index);
      remove.textContent = "Remove";
      const head = document.createElement("div");
      head.className = "bulk-card-heading";
      head.append(title, remove);
      const preview = document.createElement("img");
      preview.className = "bulk-preview";
      preview.src = item.preview;
      preview.alt = `Preview of ${item.file.name}`;
      const fields = document.createElement("div");
      fields.className = "form-grid bulk-fields";
      const makeLabel = (text, control, wide = false) => {
        const label = document.createElement("label");
        if (wide) label.className = "wide";
        label.append(document.createTextNode(text), control);
        return label;
      };
      const name = document.createElement("input");
      name.required = true; name.maxLength = 180; name.value = item.name || item.file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "); name.dataset.bulkField = "name"; name.dataset.index = String(index);
      const category = document.createElement("select");
      category.required = true; category.dataset.bulkField = "category_slug"; category.dataset.index = String(index);
      for (const optionCategory of categories) {
        const option = document.createElement("option"); option.value = optionCategory.slug; option.textContent = optionCategory.name; category.append(option);
      }
      category.value = item.category_slug || $("productCategory").value;
      const price = document.createElement("input");
      price.type = "number"; price.min = "0"; price.step = "0.01"; price.placeholder = "Leave blank if not listed"; price.dataset.bulkField = "price"; price.dataset.index = String(index);
      const description = document.createElement("textarea");
      description.rows = 2; description.maxLength = 4000; description.dataset.bulkField = "description"; description.dataset.index = String(index);
      const arrival = document.createElement("input");
      arrival.type = "checkbox"; arrival.dataset.bulkField = "is_new_arrival"; arrival.dataset.index = String(index);
      const active = document.createElement("input");
      active.type = "checkbox"; active.checked = true; active.dataset.bulkField = "is_active"; active.dataset.index = String(index);
      const arrivalLabel = makeLabel("Show in New Arrivals", arrival); arrivalLabel.className = "check";
      const activeLabel = makeLabel("Visible in the store", active); activeLabel.className = "check";
      fields.append(makeLabel("Product name", name), makeLabel("Category", category), makeLabel("Price (₹)", price), makeLabel("Description", description, true), arrivalLabel, activeLabel);
      card.append(head, preview, fields);
      container.append(card);
    });
    $("saveBulkProducts").disabled = bulkFiles.length === 0;
  }
  function renderProducts() {
    const list = $("productList");
    list.innerHTML = products.length ? products.map((product) => `<article class="item"><button class="image-view-button" data-image-view="${safe(product.image_url)}" data-image-name="${safe(product.name)}" type="button" aria-label="View image of ${safe(product.name)}"><img class="thumb" src="${safe(product.image_url)}" alt=""></button><div class="item-main"><div class="item-title">${safe(product.name)}</div><div class="item-meta">${safe(product.category_name)} · ${product.price == null ? "Price on enquiry" : `₹${safe(product.price)}`} · ${product.is_active ? "Visible" : "Hidden"}${product.is_new_arrival ? " · New Arrival" : ""}</div></div><div class="item-actions"><button class="quiet" data-product-edit="${safe(product.id)}" type="button">Edit</button><button class="danger" data-product-delete="${safe(product.id)}" type="button">Delete</button></div></article>`).join("") : '<div class="empty">No products uploaded yet.</div>';
  }
  function resetProductForm() {
    $("productForm").reset();
    $("productId").value = "";
    $("productImage").dataset.currentUrl = "";
    $("productActive").checked = true;
  }
  function resetCategoryForm() {
    $("categoryForm").reset();
    $("categoryEditingSlug").value = "";
    $("categorySlug").disabled = false;
    $("categoryIcon").value = "◇";
    $("categoryOrder").value = "10";
    $("categoryActive").checked = true;
    $("cancelCategory").classList.add("hidden");
  }
  $("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage($("loginMessage"), "Signing in…");
    try {
      const session = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ username: $("username").value, password: $("password").value }) });
      csrfToken = session.csrfToken;
      $("password").value = "";
      showSignedIn(session.username);
    } catch (error) { setMessage($("loginMessage"), error.message); }
  });
  $("logout").addEventListener("click", async () => {
    try { await api("/api/admin/logout", { method: "POST" }); }
    finally { csrfToken = ""; await refreshSession(); }
  });
  $("productForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage($("notice"), "Saving product…");
    try {
      let imageUrl = $("productImage").dataset.currentUrl || "";
      const image = $("productImage").files[0];
      if (image) {
        setMessage($("notice"), "Optimizing image…");
        const form = new FormData();
        form.append("image", await compressImage(image));
        imageUrl = (await api("/api/admin/uploads", { method: "POST", body: form })).image_url;
      }
      const body = {
        name: $("productName").value, category_slug: $("productCategory").value,
        price: $("productPrice").value, description: $("productDescription").value,
        image_url: imageUrl, is_new_arrival: $("productArrival").checked,
        is_active: $("productActive").checked,
      };
      const id = $("productId").value;
      await api(id ? `/api/admin/products/${encodeURIComponent(id)}` : "/api/admin/products", { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
      resetProductForm();
      $("productEditorDialog").close();
      await loadData();
      setMessage($("notice"), "Product saved.", true);
    } catch (error) { setMessage($("notice"), error.message); }
  });
  $("cancelProduct").addEventListener("click", () => { resetProductForm(); $("productEditorDialog").close(); });
  $("closeProductEditor").addEventListener("click", () => { resetProductForm(); $("productEditorDialog").close(); });
  $("closeImagePreview").addEventListener("click", () => $("imagePreviewDialog").close());
  $("bulkImages").addEventListener("change", async () => {
    const chosen = Array.from($("bulkImages").files || []);
    const invalid = chosen.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > MAX_SOURCE_IMAGE_BYTES);
    if (chosen.length > 30 || invalid) {
      setMessage($("notice"), chosen.length > 30 ? "Choose 30 images or fewer." : `${invalid.name} must be a JPG, PNG, or WebP image up to 30 MB.`);
      $("bulkImages").value = "";
      return;
    }
    for (const item of bulkFiles) URL.revokeObjectURL(item.preview);
    bulkFiles = [];
    renderBulkRows();
    if (!chosen.length) return;
    $("saveBulkProducts").disabled = true;
    setMessage($("notice"), "Optimizing selected images…");
    const optimizedFiles = [];
    try {
      for (const file of chosen) {
        const optimized = await compressImage(file);
        optimizedFiles.push({ file: optimized, preview: URL.createObjectURL(optimized), category_slug: $("productCategory").value, auto_name: true });
      }
      bulkFiles = optimizedFiles;
      refreshAutoBulkNames();
      renderBulkRows();
      const before = chosen.reduce((sum, file) => sum + file.size, 0);
      const after = bulkFiles.reduce((sum, item) => sum + item.file.size, 0);
      const savings = before > after ? ` Reduced from ${formatBytes(before)} to ${formatBytes(after)}.` : "";
      setMessage($("notice"), `${bulkFiles.length} image${bulkFiles.length === 1 ? "" : "s"} optimized and ready.${savings} Add details for each product.`, true);
    } catch (error) {
      for (const item of optimizedFiles) URL.revokeObjectURL(item.preview);
      $("bulkImages").value = "";
      setMessage($("notice"), error.message);
    }
  });
  $("bulkProductRows").addEventListener("click", (event) => {
    const index = Number(event.target.closest("[data-remove-bulk]")?.dataset.removeBulk);
    if (!Number.isInteger(index) || index < 0 || index >= bulkFiles.length) return;
    URL.revokeObjectURL(bulkFiles[index].preview);
    bulkFiles.splice(index, 1);
    refreshAutoBulkNames();
    renderBulkRows();
  });
  $("bulkProductRows").addEventListener("input", (event) => {
    const field = event.target.dataset.bulkField;
    if (field) {
      const item = bulkFiles[Number(event.target.dataset.index)];
      item[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      if (field === "name") item.auto_name = false;
    }
  });
  $("bulkProductRows").addEventListener("change", (event) => {
    const field = event.target.dataset.bulkField;
    if (field) {
      const item = bulkFiles[Number(event.target.dataset.index)];
      item[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      if (field === "category_slug") {
        refreshAutoBulkNames();
        bulkFiles.forEach((bulkItem, index) => {
          if (bulkItem.auto_name) $("bulkProductRows").querySelector(`[data-index="${index}"][data-bulk-field="name"]`).value = bulkItem.name;
        });
      }
    }
  });
  $("saveBulkProducts").addEventListener("click", async () => {
    if (!bulkFiles.length) return;
    const button = $("saveBulkProducts");
    button.disabled = true;
    setMessage($("notice"), `Uploading ${bulkFiles.length} products…`);
    try {
      const form = new FormData();
      const metadata = bulkFiles.map((item, index) => {
        const read = (field) => $("bulkProductRows").querySelector(`[data-index="${index}"][data-bulk-field="${field}"]`);
        const name = read("name").value.trim();
        const categorySlug = read("category_slug").value;
        if (!name || !categorySlug) throw new Error(`Enter a name and category for product ${index + 1}.`);
        const price = read("price").value;
        form.append("images", item.file);
        return { name, category_slug: categorySlug, price, description: read("description").value, is_new_arrival: read("is_new_arrival").checked, is_active: read("is_active").checked };
      });
      form.append("products", JSON.stringify(metadata));
      const result = await api("/api/admin/products/bulk", { method: "POST", body: form });
      for (const item of bulkFiles) URL.revokeObjectURL(item.preview);
      bulkFiles = [];
      $("bulkImages").value = "";
      renderBulkRows();
      await loadData();
      setMessage($("notice"), `${result.count} products added successfully.`, true);
    } catch (error) {
      setMessage($("notice"), error.message);
      button.disabled = bulkFiles.length === 0;
    }
  });
  $("categoryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const oldSlug = $("categoryEditingSlug").value;
    const slug = $("categorySlug").value.trim();
    const body = { name: $("categoryName").value, subtitle: $("categorySubtitle").value, icon: $("categoryIcon").value, display_order: Number($("categoryOrder").value), is_active: $("categoryActive").checked };
    try {
      if (oldSlug) await api(`/api/admin/categories/${encodeURIComponent(oldSlug)}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/api/admin/categories", { method: "POST", body: JSON.stringify({ ...body, slug }) });
      resetCategoryForm();
      await loadData();
      setMessage($("notice"), "Category saved.", true);
    } catch (error) { setMessage($("notice"), error.message); }
  });
  $("cancelCategory").addEventListener("click", resetCategoryForm);
  $("categoryList").addEventListener("click", async (event) => {
    const editSlug = event.target.closest("[data-category-edit]")?.dataset.categoryEdit;
    const deleteSlug = event.target.closest("[data-category-delete]")?.dataset.categoryDelete;
    if (editSlug) {
      const category = categories.find((item) => item.slug === editSlug);
      if (!category) return;
      $("categoryEditingSlug").value = category.slug;
      $("categoryName").value = category.name;
      $("categorySlug").value = category.slug;
      $("categorySlug").disabled = true;
      $("categorySubtitle").value = category.subtitle || "";
      $("categoryIcon").value = category.icon || "◇";
      $("categoryOrder").value = category.display_order;
      $("categoryActive").checked = category.is_active;
      $("cancelCategory").classList.remove("hidden");
      $("categoryName").focus();
    } else if (deleteSlug && window.confirm(`Remove the category “${categories.find((item) => item.slug === deleteSlug)?.name || deleteSlug}”? This is allowed only when it has no products.`)) {
      try { await api(`/api/admin/categories/${encodeURIComponent(deleteSlug)}`, { method: "DELETE" }); await loadData(); setMessage($("notice"), "Category removed.", true); }
      catch (error) { setMessage($("notice"), error.message); }
    }
  });
  $("productList").addEventListener("click", async (event) => {
    const imageButton = event.target.closest("[data-image-view]");
    const editId = event.target.closest("[data-product-edit]")?.dataset.productEdit;
    const deleteId = event.target.closest("[data-product-delete]")?.dataset.productDelete;
    if (imageButton) {
      $("imagePreview").src = imageButton.dataset.imageView;
      $("imagePreviewName").textContent = imageButton.dataset.imageName;
      $("imagePreviewDialog").showModal();
    } else if (editId) {
      const product = products.find((item) => String(item.id) === editId);
      if (!product) return;
      $("productId").value = product.id;
      $("productName").value = product.name;
      $("productCategory").value = product.category_slug;
      $("productPrice").value = product.price ?? "";
      $("productDescription").value = product.description || "";
      $("productImage").dataset.currentUrl = product.image_url;
      $("productArrival").checked = product.is_new_arrival;
      $("productActive").checked = product.is_active;
      $("productEditorDialog").showModal();
      $("productName").focus();
    } else if (deleteId && window.confirm("Delete this product from the store? This action cannot be undone.")) {
      try { await api(`/api/admin/products/${encodeURIComponent(deleteId)}`, { method: "DELETE" }); await loadData(); setMessage($("notice"), "Product deleted.", true); }
      catch (error) { setMessage($("notice"), error.message); }
    }
  });
  refreshSession();
})();
