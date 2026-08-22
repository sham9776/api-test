"use strict";
/**
 * @type {HTMLFormElement}
 */
const form = document.getElementById("uv-form");
/**
 * @type {HTMLInputElement}
 */
const address = document.getElementById("uv-address");
/**
 * @type {HTMLInputElement}
 */
const searchEngine = document.getElementById("uv-search-engine");
/**
 * @type {HTMLParagraphElement}
 */
const error = document.getElementById("uv-error");
/**
 * @type {HTMLPreElement}
 */
const errorCode = document.getElementById("uv-error-code");
const frame = document.getElementById("uv-frame");

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
		console.log("BareMux & Epoxy Transport initialized with:", wispUrl);
	} catch (err) {
		console.warn("Proxy initialization warning:", err);
	}
}

initializeProxy();

form.addEventListener("submit", async (event) => {
	event.preventDefault();

	try {
		await registerSW();
	} catch (err) {
		error.textContent = "Failed to register service worker.";
		errorCode.textContent = err.toString();
		throw err;
	}

	try {
		// Ensure transport is set with accurate wispUrl
		await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
	} catch (err) {
		console.error("Failed to set Epoxy transport:", err);
	}

	const url = search(address.value, searchEngine.value);

	frame.style.display = "block";
	frame.src = __uv$config.prefix + __uv$config.encodeUrl(url);
});
