let currentPage = 1;
const perPage = 10;
let currentCategory = "iphone";
let allSkins = {}; // Store all data for search
let newArrivals = [];
let currentIndex = 0;

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

        paginatedSkins.forEach(skin => {
            let imgWrapper = document.createElement("div");
imgWrapper.className = "image-wrapper";  // Add Wrapper

let imgElement = document.createElement("img");
imgElement.src = skin.image;
imgElement.alt = skin.name;
imgElement.title = skin.name;

            // **Check if image exists before appending**
            imgElement.onerror = function () {
                console.warn("Image not found:", skin.image);
                imgElement.remove(); // Remove if 404
            };

            imgWrapper.appendChild(imgElement);
            gallery.appendChild(imgWrapper);
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

    results.forEach(skin => {
        let imgElement = document.createElement("img");
        imgElement.src = skin.image;
        imgElement.alt = skin.name;
        imgElement.title = skin.name;
        gallery.appendChild(imgElement);
    });
});

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
