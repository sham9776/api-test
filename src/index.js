import { join } from "node:path";
import { hostname } from "node:os";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import express from "express";
import compression from "compression";
import wisp from "wisp-server-node";

import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

// 🚀 Force IPv4 priority over IPv6 across all Node.js DNS lookups
// This prevents Google / Cloudflare from triggering datacenter IPv6 bot CAPTCHAs
if (dns.setDefaultResultOrder) {
	dns.setDefaultResultOrder("ipv4first");
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicPath = join(__dirname, "../public");

const app = express();

// High-performance gzip/brotli compression for all HTTP responses
app.use(compression({ level: 6 }));

// Security and Isolation Headers (Required for SharedArrayBuffer & Service Worker)
app.use((req, res, next) => {
	res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
	res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
	next();
});

// Health check endpoint for Railway & cloud health checks
app.get("/health", (req, res) => {
	res.status(200).send("OK");
});

// Static cache options for maximum performance
const cacheOptions = {
	maxAge: "1d",
	immutable: true,
};

// Serve frontend static files
app.use(express.static(publicPath, { maxAge: "1h" }));

// Serve vendor assets with high caching
app.use("/uv/", express.static(uvPath, cacheOptions));
app.use("/epoxy/", express.static(epoxyPath, cacheOptions));
app.use("/baremux/", express.static(baremuxPath, cacheOptions));

// 404 Fallback
app.use((req, res) => {
	res.status(404).sendFile(join(publicPath, "404.html"));
});

const server = createServer(app);

// WebSocket upgrade handling for Wisp protocol
server.on("upgrade", (req, socket, head) => {
	if (req.url.endsWith("/wisp/") || req.url.startsWith("/wisp")) {
		req.url = "/wisp/";
		wisp.routeRequest(req, socket, head);
		return;
	}
	socket.end();
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

server.on("listening", () => {
	const address = server.address();
	console.log("🚀 Web Proxy is listening on:");
	console.log(`\thttp://0.0.0.0:${address.port}`);
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
});

// Graceful shutdown
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	console.log("SIGTERM signal received: closing HTTP server");
	server.close(() => {
		process.exit(0);
	});
}

server.listen(port, "0.0.0.0");
