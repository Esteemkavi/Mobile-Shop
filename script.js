let currentPage = 1;
const perPage = 10;
let currentCategory = "iphone";
let allSkins = {}; // Store all data for search
let newArrivals = [];
let currentIndex = 0;
const prefetchCache = new Map();

// Inline SVG placeholder (data URI)
const PLACEHOLDER_SRC = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400'>" +
    "<rect fill='#e6e6e6' width='100%' height='100%'/>" +
    "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#8a8a8a' font-size='20'>No Image</text>" +
    "</svg>"
);

// 🔹 Fetch Skins Data from JSON
async function fetchSkins() {
    try {
        let response = await fetch("skins.json");
        let data = await response.json();
        allSkins = data; // Store all category data
        return data;
    } catch (error) {
        console.error("Error loading skins:", error);
        return {};
    }
}

// 🔹 Load Skins with Pagination
async function loadSkins(category, page = 1) {
    currentCategory = category;
    currentPage = page;
    let gallery = document.getElementById("gallery");
    let pagination = document.getElementById("pagination");

    let data = await fetchSkins();
    let skins = data[category] || [];

    let start = (currentPage - 1) * perPage;
    let end = start + perPage;
    let paginatedSkins = skins.slice(start, end);
    let totalItems = paginatedSkins.length;

    // Skeleton Loader Before Loading
    gallery.innerHTML = "";
    for (let i = 0; i < totalItems; i++) {
        let skeleton = document.createElement("div");
        skeleton.className = "skeleton-loader";
        gallery.appendChild(skeleton);
    }

    setTimeout(() => {
        gallery.innerHTML = "";
        pagination.innerHTML = "";

        if (totalItems === 0) {
            gallery.innerHTML = "<p>No skins available</p>";
            return;
        }

            // Helper: create a card (image + clickable link + optional price)
            function createSkinCard(skin) {
                let imgWrapper = document.createElement("div");
                imgWrapper.className = "image-wrapper skin-card";

                // Anchor wrapper so both image and caption navigate
                let link = document.createElement('a');
                link.className = 'skin-link';
                const href = `product.html?id=${encodeURIComponent(skin.id)}`;
                link.href = href;
                link.setAttribute('aria-label', `View details for ${skin.name || 'skin'}`);

                let imgElement = document.createElement("img");
                imgElement.src = skin.image || PLACEHOLDER_SRC;
                imgElement.alt = skin.name || 'Skin image';
                imgElement.title = skin.name || '';

                // Caption below image (inside the anchor)
                let caption = document.createElement("div");
                caption.className = "skin-name";
                caption.innerText = skin.name || "Unnamed";

                // Optional price line
                if (skin.price) {
                    let priceDiv = document.createElement('div');
                    priceDiv.className = 'skin-price';
                    priceDiv.innerText = `₹${skin.price}`;
                    caption.appendChild(priceDiv);
                }

                // Image error -> show placeholder instead of removing
                imgElement.onerror = function () {
                    console.warn("Image not found:", skin.image);
                    if (imgElement.src !== PLACEHOLDER_SRC) imgElement.src = PLACEHOLDER_SRC;
                    imgElement.alt = 'Image not available';
                    imgElement.classList.add('missing');
                };

                // Prefetch product data on hover
                link.addEventListener('mouseenter', () => {
                    prefetchSkinById(skin.id);
                });

                // Navigation animation: intercept click, animate then navigate
                link.addEventListener('click', (e) => {
                    // Let ctrl/cmd/meta or middle clicks open in new tab normally
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                    e.preventDefault();
                    document.documentElement.classList.add('page-navigating');
                    setTimeout(() => { window.location.href = href; }, 300);
                });

                link.appendChild(imgElement);
                link.appendChild(caption);
                imgWrapper.appendChild(link);
                return imgWrapper;
            }

            paginatedSkins.forEach(skin => {
                gallery.appendChild(createSkinCard(skin));
            });

        createPagination(skins.length);
    }, 1000); // 1 sec delay for smooth loader effect
}

// 🔹 Create Pagination
function createPagination(totalItems) {
    let pagination = document.getElementById("pagination");
    pagination.innerHTML = "";

    let totalPages = Math.ceil(totalItems / perPage);
    
    for (let i = 1; i <= totalPages; i++) {
        let btn = document.createElement("button");
        btn.innerText = i;
        btn.className = (i === currentPage) ? "active" : "";
        btn.onclick = () => loadSkins(currentCategory, i);
        pagination.appendChild(btn);
    }
}

// 🔹 Search Functionality
document.getElementById("search-box").addEventListener("input", function() {
    let searchText = this.value.toLowerCase();
    let gallery = document.getElementById("gallery");
    gallery.innerHTML = "";

    if (!searchText) {
        loadSkins(currentCategory, 1); // Reset if empty
        return;
    }

    let results = [];
    for (let category in allSkins) {
        let filtered = allSkins[category].filter(skin => skin.name.toLowerCase().includes(searchText));
        results = results.concat(filtered);
    }

    if (results.length === 0) {
        gallery.innerHTML = "<p>No results found</p>";
        return;
    }

    // Render search results using same skin card renderer (shows caption + price)
    results.forEach(skin => {
        // Use createSkinCard if available in scope
        if (typeof createSkinCard === 'function') {
            gallery.appendChild(createSkinCard(skin));
        } else {
            // Fallback: simple image + caption
            let wrapper = document.createElement('div');
            wrapper.className = 'image-wrapper';
            let img = document.createElement('img');
            img.src = skin.image || PLACEHOLDER_SRC;
            img.alt = skin.name;
            let caption = document.createElement('div');
            caption.className = 'skin-name';
            caption.innerText = skin.name || 'Unnamed';
            wrapper.appendChild(img);
            wrapper.appendChild(caption);
            gallery.appendChild(wrapper);
        }
    });
});

// Prefetch helper: read skins.json and cache the item by id
async function prefetchSkinById(id) {
    if (prefetchCache.has(id)) return prefetchCache.get(id);
    try {
        const res = await fetch('skins.json');
        const data = await res.json();
        for (let cat in data) {
            let item = data[cat].find(s => String(s.id) === String(id));
            if (item) {
                const found = Object.assign({}, item, { category: cat });
                prefetchCache.set(id, found);
                return found;
            }
        }
    } catch (err) {
        console.error('Prefetch error', err);
    }
    return null;
}

// 🔹 Fetch New Arrivals from JSON
async function fetchNewArrivals() {
    try {
        let response = await fetch("new_arrivals.json");
        let data = await response.json();
        newArrivals = data.new_arrivals.map(item => item.image);
        initNewArrivals();
    } catch (error) {
        console.error("Error fetching new arrivals:", error);
    }
}

// 🔹 Initialize New Arrivals (Train Effect)
async function initNewArrivals() {
    let container = document.querySelector(".new-arrivals-container");
    container.innerHTML = ""; // Clear old images

    for (let imageSrc of newArrivals) {
        let img = document.createElement("img");
        img.src = imageSrc;
        img.alt = "New Arrival";
        img.loading = "lazy"; // Performance optimization

        // **Check if image exists before appending**
        img.onerror = function () {
            console.warn("Image not found:", imageSrc);
            img.remove(); // Remove if 404
        };

        container.appendChild(img);
    }

    startImageMovement();
}

// 🔹 Train Effect for Moving Images
function startImageMovement() {
    setInterval(() => {
        let container = document.querySelector(".new-arrivals-container");
        let firstImage = container.children[0];

        container.style.transition = "transform 1s linear";
        container.style.transform = "translateX(-195px)"; // Adjusted for smooth scroll

        setTimeout(() => {
            container.style.transition = "none";
            container.style.transform = "translateX(0)";
            container.appendChild(firstImage.cloneNode(true)); // Clone & append last
            container.removeChild(firstImage); // Remove first image
        }, 1000);
    }, 3000);
}
// Fetch Data
fetchNewArrivals();
fetchSkins();
