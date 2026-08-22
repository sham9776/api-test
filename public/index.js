"use strict";

const form = document.getElementById("uv-form");
const address = document.getElementById("uv-address");
const searchEngine = document.getElementById("uv-search-engine");
const error = document.getElementById("uv-error");
const errorCode = document.getElementById("uv-error-code");
const frame = document.getElementById("uv-frame");
const proxyNav = document.getElementById("proxy-nav");
const navAddress = document.getElementById("nav-address");
const navGo = document.getElementById("nav-go");
const navHome = document.getElementById("nav-home");
const navReload = document.getElementById("nav-reload");
const navClose = document.getElementById("nav-close");
const mainContent = document.getElementById("main-content");

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

const wispUrl =
	(location.protocol === "https:" ? "wss" : "ws") +
	"://" +
	location.host +
	"/wisp/";

// Initialize Service Worker and Epoxy Transport immediately
async function initializeProxy() {
	try {
		await registerSW();
		await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		console.log("BareMux & Epoxy initialized with:", wispUrl);
	} catch (err) {
		console.warn("Proxy initialization warning:", err);
	}
}

initializeProxy();

async function launchUrl(targetUrl) {
	try {
		await registerSW();
		await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
	} catch (err) {
		error.textContent = "Failed to register service worker or transport.";
		errorCode.textContent = err.toString();
		throw err;
	}

	const resolved = search(targetUrl, searchEngine.value);

	proxyNav.style.display = "flex";
	frame.style.display = "block";
	navAddress.value = resolved;
	frame.src = __uv$config.prefix + __uv$config.encodeUrl(resolved);
}

// Form Submit
form.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!address.value.trim()) return;
	await launchUrl(address.value.trim());
});

// Shortcut Chips Click
document.querySelectorAll(".shortcut-chip").forEach((chip) => {
	chip.addEventListener("click", async () => {
		const target = chip.getAttribute("data-url");
		if (target) {
			address.value = target;
			await launchUrl(target);
		}
	});
});

// Navigation Bar Controls
navGo.addEventListener("click", async () => {
	if (navAddress.value.trim()) {
		await launchUrl(navAddress.value.trim());
	}
});

navAddress.addEventListener("keydown", async (e) => {
	if (e.key === "Enter" && navAddress.value.trim()) {
		await launchUrl(navAddress.value.trim());
	}
});

navReload.addEventListener("click", () => {
	frame.contentWindow.location.reload();
});

navHome.addEventListener("click", () => {
	proxyNav.style.display = "none";
	frame.style.display = "none";
	frame.src = "about:blank";
});

navClose.addEventListener("click", () => {
	proxyNav.style.display = "none";
	frame.style.display = "none";
	frame.src = "about:blank";
});
