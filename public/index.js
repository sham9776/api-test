"use strict";

/**
 * ====================================================================
 * 🚀 Cloud Virtual Browser & Multi-Tab Proxy Engine
 * ====================================================================
 */

// DOM Elements
const browserHeader = document.getElementById("browser-header");
const tabsContainer = document.getElementById("tabs-container");
const btnNewTab = document.getElementById("btn-new-tab");
const omniboxToolbar = document.getElementById("omnibox-toolbar");
const navAddress = document.getElementById("uv-address");
const navSearchEngine = document.getElementById("uv-search-engine");
const navSubmit = document.getElementById("uv-submit");
const navBack = document.getElementById("nav-back");
const navForward = document.getElementById("nav-forward");
const navReload = document.getElementById("nav-reload");
const navHome = document.getElementById("nav-home");
const navClose = document.getElementById("nav-close");
const btnStealth = document.getElementById("btn-stealth");
const btnFullscreen = document.getElementById("btn-fullscreen");
const btnAddBookmark = document.getElementById("btn-add-bookmark");

const mainContent = document.getElementById("main-content");
const browserViewport = document.getElementById("browser-viewport");
const mainSearchForm = document.getElementById("uv-form");
const mainSearchInput = document.getElementById("main-search-input");
const bookmarksGrid = document.getElementById("bookmarks-grid");
const btnOpenAddBookmark = document.getElementById("btn-open-add-bookmark");

const cloakModal = document.getElementById("cloak-modal");
const btnCloseCloakModal = document.getElementById("btn-close-cloak-modal");
const bookmarkModal = document.getElementById("bookmark-modal");
const btnCloseBmModal = document.getElementById("btn-close-bm-modal");
const bmForm = document.getElementById("bm-form");
const bmTitleInput = document.getElementById("bm-title-input");
const bmUrlInput = document.getElementById("bm-url-input");

const errorEl = document.getElementById("uv-error");
const errorCodeEl = document.getElementById("uv-error-code");
const pageFavicon = document.getElementById("page-favicon");

// BareMux & Wisp Connection
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
const wispUrl =
	(location.protocol === "https:" ? "wss" : "ws") +
	"://" +
	location.host +
	"/wisp/";

let isProxyReady = false;

async function initProxy() {
	try {
		await registerSW();
		await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		isProxyReady = true;
		console.log("✅ Proxy Engine initialized successfully with:", wispUrl);
	} catch (err) {
		console.warn("⚠️ Proxy initialization error:", err);
		if (errorEl) errorEl.textContent = "اتصال به موتور پروکسی با خطا مواجه شد.";
		if (errorCodeEl) errorCodeEl.textContent = err.toString();
	}
}

initProxy();

/**
 * ====================================================================
 * 📑 Tab Manager State
 * ====================================================================
 */
let tabIdCounter = 1;
let tabs = [];
let activeTabId = null;

function createTab(initialUrl = null, title = "New Tab", icon = "🌐") {
	const tabId = "tab-" + tabIdCounter++;
	const isDashboard = !initialUrl;

	let iframe = null;
	if (!isDashboard) {
		iframe = document.createElement("iframe");
		iframe.className = "tab-frame";
		iframe.id = "frame-" + tabId;
		iframe.style.display = "none";
		browserViewport.appendChild(iframe);
	}

	const tabData = {
		id: tabId,
		title: title,
		icon: icon,
		url: initialUrl || "",
		isDashboard: isDashboard,
		iframe: iframe,
	};

	tabs.push(tabData);
	renderTabs();
	switchTab(tabId);

	if (initialUrl) {
		loadUrlInTab(tabData, initialUrl);
	}

	return tabData;
}

function switchTab(tabId) {
	const tab = tabs.find((t) => t.id === tabId);
	if (!tab) return;

	activeTabId = tabId;

	// Hide all iframes
	tabs.forEach((t) => {
		if (t.iframe) t.iframe.style.display = "none";
	});

	if (tab.isDashboard) {
		mainContent.style.display = "flex";
		browserViewport.style.display = "none";
		navAddress.value = "";
	} else {
		mainContent.style.display = "none";
		browserViewport.style.display = "block";
		if (tab.iframe) {
			tab.iframe.style.display = "block";
		}
		navAddress.value = tab.url;
	}

	renderTabs();
}

function closeTab(tabId, event) {
	if (event) event.stopPropagation();

	const index = tabs.findIndex((t) => t.id === tabId);
	if (index === -1) return;

	const tabToClose = tabs[index];
	if (tabToClose.iframe) {
		tabToClose.iframe.remove();
	}

	tabs.splice(index, 1);

	if (tabs.length === 0) {
		createTab(null, "Dashboard", "🏠");
	} else if (activeTabId === tabId) {
		const nextTab = tabs[Math.max(0, index - 1)];
		switchTab(nextTab.id);
	} else {
		renderTabs();
	}
}

function renderTabs() {
	tabsContainer.innerHTML = "";
	tabs.forEach((tab) => {
		const tabEl = document.createElement("div");
		tabEl.className = "tab-item" + (tab.id === activeTabId ? " active" : "");
		tabEl.title = tab.title;

		tabEl.innerHTML = `
			<span class="tab-icon">${tab.icon}</span>
			<span class="tab-title">${tab.title}</span>
			<button class="tab-close-btn" title="Close">✖</button>
		`;

		tabEl.addEventListener("click", () => switchTab(tab.id));
		tabEl.querySelector(".tab-close-btn").addEventListener("click", (e) => closeTab(tab.id, e));

		tabsContainer.appendChild(tabEl);
	});
}

/**
 * ====================================================================
 * 🌐 Navigation & URL Resolution
 * ====================================================================
 */
async function loadUrlInTab(tab, rawInput) {
	if (!rawInput || !rawInput.trim()) return;

	try {
		if (!isProxyReady) {
			await registerSW();
			await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
			isProxyReady = true;
		}
	} catch (err) {
		console.warn("Transport registration warning:", err);
	}

	const resolvedUrl = search(rawInput.trim(), navSearchEngine.value);

	if (tab.isDashboard) {
		// Convert dashboard tab into an iframe tab
		const iframe = document.createElement("iframe");
		iframe.className = "tab-frame";
		iframe.id = "frame-" + tab.id;
		browserViewport.appendChild(iframe);
		tab.iframe = iframe;
		tab.isDashboard = false;
	}

	tab.url = resolvedUrl;
	let parsedDomain = "";
	try {
		parsedDomain = new URL(resolvedUrl).hostname.replace("www.", "");
	} catch {
		parsedDomain = resolvedUrl;
	}

	tab.title = parsedDomain;
	tab.icon = getIconForDomain(resolvedUrl);

	mainContent.style.display = "none";
	browserViewport.style.display = "block";
	tab.iframe.style.display = "block";
	navAddress.value = resolvedUrl;

	const proxyUrl = __uv$config.prefix + __uv$config.encodeUrl(resolvedUrl);
	tab.iframe.src = proxyUrl;

	renderTabs();
}

function getIconForDomain(url) {
	if (url.includes("telegram")) return "✈️";
	if (url.includes("whatsapp")) return "💬";
	if (url.includes("youtube")) return "📺";
	if (url.includes("discord")) return "🎮";
	if (url.includes("reddit")) return "🤖";
	if (url.includes("github")) return "🐙";
	if (url.includes("chatgpt") || url.includes("openai")) return "🧠";
	if (url.includes("claude")) return "🤖";
	if (url.includes("spotify")) return "🎵";
	return "🌐";
}

function navigateActiveTab(inputUrl) {
	const currentTab = tabs.find((t) => t.id === activeTabId);
	if (currentTab) {
		loadUrlInTab(currentTab, inputUrl);
	} else {
		createTab(inputUrl);
	}
}

// Main Search Form Submit
mainSearchForm.addEventListener("submit", (e) => {
	e.preventDefault();
	const val = mainSearchInput.value.trim();
	if (!val) return;
	navigateActiveTab(val);
});

// Omnibox Navigation Submit
navSubmit.addEventListener("click", () => {
	if (navAddress.value.trim()) {
		navigateActiveTab(navAddress.value.trim());
	}
});

navAddress.addEventListener("keydown", (e) => {
	if (e.key === "Enter" && navAddress.value.trim()) {
		navigateActiveTab(navAddress.value.trim());
	}
});

// Top Navigation Controls
navBack.addEventListener("click", () => {
	const currentTab = tabs.find((t) => t.id === activeTabId);
	if (currentTab && currentTab.iframe && currentTab.iframe.contentWindow) {
		try {
			currentTab.iframe.contentWindow.history.back();
		} catch {}
	}
});

navForward.addEventListener("click", () => {
	const currentTab = tabs.find((t) => t.id === activeTabId);
	if (currentTab && currentTab.iframe && currentTab.iframe.contentWindow) {
		try {
			currentTab.iframe.contentWindow.history.forward();
		} catch {}
	}
});

navReload.addEventListener("click", () => {
	const currentTab = tabs.find((t) => t.id === activeTabId);
	if (currentTab && currentTab.iframe) {
		currentTab.iframe.src = currentTab.iframe.src;
	}
});

navHome.addEventListener("click", () => {
	createTab(null, "Dashboard", "🏠");
});

navClose.addEventListener("click", () => {
	const currentTab = tabs.find((t) => t.id === activeTabId);
	if (currentTab) {
		closeTab(currentTab.id);
	}
});

btnNewTab.addEventListener("click", () => {
	createTab(null, "New Tab", "➕");
});

// App Card Launches
document.querySelectorAll(".app-card[data-url]").forEach((card) => {
	card.addEventListener("click", () => {
		const targetUrl = card.getAttribute("data-url");
		if (targetUrl) {
			navigateActiveTab(targetUrl);
		}
	});
});

// Fullscreen Toggle
btnFullscreen.addEventListener("click", () => {
	if (!document.fullscreenElement) {
		document.documentElement.requestFullscreen().catch(() => {});
	} else {
		document.exitFullscreen().catch(() => {});
	}
});

/**
 * ====================================================================
 * 🎭 Office Stealth Cloaking System
 * ====================================================================
 */
function applyCloak(title, faviconUrl) {
	document.title = title;
	if (pageFavicon) {
		pageFavicon.href = faviconUrl;
	}
	localStorage.setItem("cloud_browser_cloak", JSON.stringify({ title, faviconUrl }));
}

function loadSavedCloak() {
	try {
		const saved = localStorage.getItem("cloud_browser_cloak");
		if (saved) {
			const { title, faviconUrl } = JSON.parse(saved);
			if (title && faviconUrl) applyCloak(title, faviconUrl);
		}
	} catch {}
}

btnStealth.addEventListener("click", () => {
	cloakModal.style.display = "flex";
});

btnCloseCloakModal.addEventListener("click", () => {
	cloakModal.style.display = "none";
});

document.querySelectorAll(".cloak-opt-btn").forEach((btn) => {
	btn.addEventListener("click", () => {
		const title = btn.getAttribute("data-title");
		const icon = btn.getAttribute("data-icon");
		if (title && icon) {
			applyCloak(title, icon);
			cloakModal.style.display = "none";
		}
	});
});

// Panic Key: Escape Key returns to safe Home Dashboard
document.addEventListener("keydown", (e) => {
	if (e.key === "Escape") {
		// Close modals if open
		cloakModal.style.display = "none";
		bookmarkModal.style.display = "none";
		// Switch to Home view
		const homeTab = tabs.find((t) => t.isDashboard);
		if (homeTab) {
			switchTab(homeTab.id);
		} else {
			createTab(null, "Dashboard", "🏠");
		}
	}
	// Alt + T: New Tab Shortcut
	if (e.altKey && e.key.toLowerCase() === "t") {
		e.preventDefault();
		createTab(null, "New Tab", "➕");
	}
});

/**
 * ====================================================================
 * ⭐ Custom Bookmarks System
 * ====================================================================
 */
function getSavedBookmarks() {
	try {
		return JSON.parse(localStorage.getItem("cloud_browser_bookmarks")) || [
			{ title: "Google", url: "https://www.google.com" },
			{ title: "DuckDuckGo", url: "https://duckduckgo.com" },
		];
	} catch {
		return [];
	}
}

function saveBookmarks(bms) {
	localStorage.setItem("cloud_browser_bookmarks", JSON.stringify(bms));
	renderBookmarks();
}

function renderBookmarks() {
	if (!bookmarksGrid) return;
	const bms = getSavedBookmarks();
	bookmarksGrid.innerHTML = "";

	if (bms.length === 0) {
		bookmarksGrid.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; grid-column: 1/-1;">هنوز بوک‌مارکی اضافه نشده است.</p>`;
		return;
	}

	bms.forEach((bm, index) => {
		const card = document.createElement("div");
		card.className = "app-card";
		card.innerHTML = `
			<div class="app-icon-wrapper custom-bg">⭐</div>
			<div class="app-info">
				<h3>${bm.title}</h3>
				<p>${bm.url}</p>
			</div>
			<button class="bm-delete-btn" title="Delete" data-idx="${index}">🗑</button>
		`;

		card.addEventListener("click", (e) => {
			if (e.target.classList.contains("bm-delete-btn")) return;
			navigateActiveTab(bm.url);
		});

		card.querySelector(".bm-delete-btn").addEventListener("click", (e) => {
			e.stopPropagation();
			const idx = parseInt(e.target.getAttribute("data-idx"), 10);
			const list = getSavedBookmarks();
			list.splice(idx, 1);
			saveBookmarks(list);
		});

		bookmarksGrid.appendChild(card);
	});
}

btnOpenAddBookmark.addEventListener("click", () => {
	bookmarkModal.style.display = "flex";
	bmTitleInput.value = "";
	bmUrlInput.value = "";
});

btnAddBookmark.addEventListener("click", () => {
	const currentTab = tabs.find((t) => t.id === activeTabId);
	bmTitleInput.value = currentTab ? currentTab.title : "";
	bmUrlInput.value = currentTab ? currentTab.url : "";
	bookmarkModal.style.display = "flex";
});

btnCloseBmModal.addEventListener("click", () => {
	bookmarkModal.style.display = "none";
});

bmForm.addEventListener("submit", (e) => {
	e.preventDefault();
	const title = bmTitleInput.value.trim();
	let url = bmUrlInput.value.trim();
	if (!title || !url) return;

	if (!url.startsWith("http://") && !url.startsWith("https://")) {
		url = "https://" + url;
	}

	const list = getSavedBookmarks();
	list.push({ title, url });
	saveBookmarks(list);
	bookmarkModal.style.display = "none";
});

// Close modals when clicking backdrop
[cloakModal, bookmarkModal].forEach((modal) => {
	modal.addEventListener("click", (e) => {
		if (e.target === modal) modal.style.display = "none";
	});
});

/**
 * ====================================================================
 * 🚀 Initialization
 * ====================================================================
 */
loadSavedCloak();
renderBookmarks();

// Initial Default Tab (Dashboard)
createTab(null, "Dashboard", "🏠");
