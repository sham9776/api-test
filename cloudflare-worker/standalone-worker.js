/**
 * ====================================================================
 * 🚀 Standalone Cloudflare Worker Web Proxy v2 (with Dynamic JS/AJAX Hooks)
 * Domain: regdaal.ir (or amirsh.regdaal.ir)
 * ====================================================================
 */

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// ۱. صفحه اصلی
		if (url.pathname === "/" || url.pathname === "/index.html") {
			const queryUrl = url.searchParams.get("url") || url.searchParams.get("q");
			if (queryUrl) {
				const target = resolveTargetUrl(queryUrl, url.searchParams.get("engine") || "duckduckgo");
				return Response.redirect(`${url.origin}/proxy/${target}`, 302);
			}
			return new Response(getLandingHTML(), {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		}

		// ۲. مسیر پروکسی /proxy/...
		if (url.pathname.startsWith("/proxy/")) {
			let targetUrlStr = url.pathname.slice(7) + url.search;
			if (!targetUrlStr.startsWith("http://") && !targetUrlStr.startsWith("https://")) {
				targetUrlStr = "https://" + targetUrlStr;
			}

			let targetUrl;
			try {
				targetUrl = new URL(targetUrlStr);
			} catch (e) {
				return new Response("آدرس نامعتبر است: " + targetUrlStr, { status: 400 });
			}

			return handleProxyRequest(request, targetUrl, url.origin);
		}

		// ۳. مسیرهای عمومی یا بدون پیشوند (فال‌بک برای درخواست‌های ایجکس ریشه)
		const referer = request.headers.get("Referer");
		if (referer && referer.includes("/proxy/")) {
			try {
				const refTargetMatch = referer.match(/\/proxy\/(https?:\/\/[^/?#]+)/);
				if (refTargetMatch) {
					const originTarget = refTargetMatch[1];
					const resolved = new URL(url.pathname + url.search, originTarget);
					return Response.redirect(`${url.origin}/proxy/${resolved.toString()}`, 302);
				}
			} catch { }
		}

		return new Response(getLandingHTML(), {
			headers: { "Content-Type": "text/html; charset=utf-8" },
		});
	},
};

async function handleProxyRequest(request, targetUrl, proxyOrigin) {
	if (request.headers.get("Upgrade") === "websocket") {
		return fetch(targetUrl.toString(), { headers: request.headers });
	}

	const reqHeaders = new Headers();
	const forwardedHeaders = [
		"accept",
		"accept-language",
		"accept-encoding",
		"cookie",
		"user-agent",
		"content-type",
	];

	for (const [key, value] of request.headers.entries()) {
		if (forwardedHeaders.includes(key.toLowerCase())) {
			reqHeaders.set(key, value);
		}
	}

	reqHeaders.set("Host", targetUrl.host);
	reqHeaders.set("Referer", targetUrl.origin);
	reqHeaders.set("Origin", targetUrl.origin);
	if (!reqHeaders.has("User-Agent")) {
		reqHeaders.set(
			"User-Agent",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
		);
	}

	try {
		const targetResponse = await fetch(targetUrl.toString(), {
			method: request.method,
			headers: reqHeaders,
			body: (request.method !== "GET" && request.method !== "HEAD") ? request.body : null,
			redirect: "manual",
		});

		// مدیریت ریدایرکت‌ها
		if ([301, 302, 303, 307, 308].includes(targetResponse.status)) {
			const location = targetResponse.headers.get("location");
			if (location) {
				const resolvedLocation = new URL(location, targetUrl.origin).toString();
				return Response.redirect(`${proxyOrigin}/proxy/${resolvedLocation}`, targetResponse.status);
			}
		}

		const resHeaders = new Headers(targetResponse.headers);
		resHeaders.delete("Content-Security-Policy");
		resHeaders.delete("Content-Security-Policy-Report-Only");
		resHeaders.delete("X-Frame-Options");
		resHeaders.delete("X-Content-Type-Options");
		resHeaders.delete("Cross-Origin-Opener-Policy");
		resHeaders.delete("Cross-Origin-Embedder-Policy");
		resHeaders.set("Access-Control-Allow-Origin", "*");
		resHeaders.set("Access-Control-Allow-Credentials", "true");

		const contentType = resHeaders.get("content-type") || "";

		if (contentType.includes("text/html")) {
			const rewriter = new HTMLRewriter()
				.on("head", new ClientInterceptorInjector(targetUrl, proxyOrigin))
				.on("a", new AttributeRewriter("href", targetUrl, proxyOrigin))
				.on("link", new AttributeRewriter("href", targetUrl, proxyOrigin))
				.on("script", new AttributeRewriter("src", targetUrl, proxyOrigin))
				.on("img", new AttributeRewriter("src", targetUrl, proxyOrigin))
				.on("img", new AttributeRewriter("srcset", targetUrl, proxyOrigin, true))
				.on("source", new AttributeRewriter("src", targetUrl, proxyOrigin))
				.on("source", new AttributeRewriter("srcset", targetUrl, proxyOrigin, true))
				.on("form", new AttributeRewriter("action", targetUrl, proxyOrigin))
				.on("iframe", new AttributeRewriter("src", targetUrl, proxyOrigin))
				.on("body", new ToolbarInjector(targetUrl.toString(), proxyOrigin));

			return rewriter.transform(
				new Response(targetResponse.body, {
					status: targetResponse.status,
					statusText: targetResponse.statusText,
					headers: resHeaders,
				})
			);
		}

		return new Response(targetResponse.body, {
			status: targetResponse.status,
			statusText: targetResponse.statusText,
			headers: resHeaders,
		});
	} catch (err) {
		return new Response(getErrorHTML(targetUrl.toString(), err.message), {
			status: 500,
			headers: { "Content-Type": "text/html; charset=utf-8" },
		});
	}
}

/**
 * تزریق هوک رهگیری ایجکس (AJAX / Fetch) برای اجرای صحیح برنامه‌های تک صفحه‌ای (SPA)
 */
class ClientInterceptorInjector {
	constructor(baseUrl, proxyOrigin) {
		this.baseUrl = baseUrl;
		this.proxyOrigin = proxyOrigin;
	}

	element(element) {
		element.prepend(
			`
			<script>
			(function() {
				const PROXY_ORIGIN = "${this.proxyOrigin}";
				const TARGET_ORIGIN = "${this.baseUrl.origin}";
				const TARGET_BASE = "${this.baseUrl.href}";

				function toProxy(url) {
					if (!url || typeof url !== "string") return url;
					if (url.startsWith(PROXY_ORIGIN + "/proxy/")) return url;
					if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("javascript:")) return url;
					try {
						const absolute = new URL(url, TARGET_BASE).toString();
						return PROXY_ORIGIN + "/proxy/" + absolute;
					} catch(e) {
						return url;
					}
				}

				// Intercept fetch
				const _fetch = window.fetch;
				window.fetch = function(input, init) {
					if (typeof input === "string") {
						input = toProxy(input);
					} else if (input && input.url) {
						input = new Request(toProxy(input.url), input);
					}
					return _fetch.call(this, input, init);
				};

				// Intercept XMLHttpRequest
				const _open = XMLHttpRequest.prototype.open;
				XMLHttpRequest.prototype.open = function(method, url, ...args) {
					return _open.call(this, method, toProxy(url), ...args);
				};

				// Intercept window.open
				const _openWindow = window.open;
				window.open = function(url, ...args) {
					return _openWindow.call(this, toProxy(url), ...args);
				};
			})();
			</script>
			`,
			{ html: true }
		);
	}
}

class AttributeRewriter {
	constructor(attributeName, baseUrl, proxyOrigin, isSrcset = false) {
		this.attributeName = attributeName;
		this.baseUrl = baseUrl;
		this.proxyOrigin = proxyOrigin;
		this.isSrcset = isSrcset;
	}

	element(element) {
		const attribute = element.getAttribute(this.attributeName);
		if (!attribute) return;

		if (this.isSrcset) {
			const parts = attribute.split(",").map((part) => {
				const trimmed = part.trim().split(" ");
				if (!trimmed[0]) return part;
				try {
					const resolved = new URL(trimmed[0], this.baseUrl.origin).toString();
					trimmed[0] = `${this.proxyOrigin}/proxy/${resolved}`;
					return trimmed.join(" ");
				} catch {
					return part;
				}
			});
			element.setAttribute(this.attributeName, parts.join(", "));
			return;
		}

		if (attribute.startsWith("data:") || attribute.startsWith("blob:") || attribute.startsWith("javascript:")) {
			return;
		}

		try {
			const resolved = new URL(attribute, this.baseUrl.origin).toString();
			element.setAttribute(this.attributeName, `${this.proxyOrigin}/proxy/${resolved}`);
		} catch { }
	}
}

class ToolbarInjector {
	constructor(currentUrl, proxyOrigin) {
		this.currentUrl = currentUrl;
		this.proxyOrigin = proxyOrigin;
	}

	element(element) {
		element.append(
			`
			<div id="__regdaal_toolbar" style="position: fixed; top: 0; left: 0; width: 100vw; height: 42px; background: rgba(15, 17, 26, 0.95); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; padding: 0 12px; gap: 8px; z-index: 2147483647; font-family: sans-serif; box-sizing: border-box; box-shadow: 0 2px 10px rgba(0,0,0,0.5);">
				<a href="${this.proxyOrigin}" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 5px 10px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;">🏠 خانه</a>
				<button onclick="location.reload()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 13px;">🔄</button>
				<input id="__regdaal_url" type="text" value="${this.currentUrl}" style="flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; color: #fff; padding: 4px 12px; font-size: 13px; outline: none;" onkeydown="if(event.key==='Enter') window.location.href='${this.proxyOrigin}/proxy/'+(this.value.startsWith('http')?this.value:'https://'+this.value)" />
				<button onclick="var val=document.getElementById('__regdaal_url').value; window.location.href='${this.proxyOrigin}/proxy/'+(val.startsWith('http')?val:'https://'+val)" style="background: #6366f1; border: none; color: #fff; padding: 5px 14px; border-radius: 20px; cursor: pointer; font-size: 13px; font-weight: 600;">برو</button>
				<button onclick="document.getElementById('__regdaal_toolbar').style.display='none'; document.body.style.paddingTop='0px';" style="background: transparent; border: none; color: #aaa; cursor: pointer; font-size: 16px; padding: 0 6px;" title="بستن نوار">✖</button>
			</div>
			<script>document.body.style.paddingTop = '42px';</script>
			`,
			{ html: true }
		);
	}
}

function resolveTargetUrl(input, engine = "duckduckgo") {
	input = input.trim();
	if (input.startsWith("http://") || input.startsWith("https://")) return input;
	if (input.includes(".") && !input.includes(" ")) return "https://" + input;

	const engines = {
		// DuckDuckGo HTML version is 100% reliable, fast, and does not require complex JS or bot checks!
		duckduckgo: "https://html.duckduckgo.com/html/?q=",
		bing: "https://www.bing.com/search?q=",
		brave: "https://search.brave.com/search?q=",
		google: "https://www.google.com/search?q=",
	};
	return (engines[engine] || engines.duckduckgo) + encodeURIComponent(input);
}

function getLandingHTML() {
	return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>amirsh Cloud Browser | مرورگر ابری بدون نیاز به ادمین</title>
	<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;700&display=swap" rel="stylesheet">
	<style>
		:root {
			--bg: #07090e;
			--card: rgba(18, 24, 38, 0.75);
			--card-hover: rgba(28, 36, 56, 0.9);
			--accent: #6366f1;
			--accent-hover: #4f46e5;
			--border: rgba(255, 255, 255, 0.08);
			--text: #f8fafc;
			--muted: #94a3b8;
		}
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			font-family: 'Vazirmatn', 'Plus Jakarta Sans', sans-serif;
			background: radial-gradient(circle at top, #18153e 0%, var(--bg) 70%);
			color: var(--text);
			min-height: 100vh;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: flex-start;
			padding: 40px 20px 60px;
		}
		.container { width: 100%; max-width: 860px; text-align: center; }
		.status-badge {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			background: rgba(255, 255, 255, 0.05);
			border: 1px solid var(--border);
			border-radius: 30px;
			padding: 6px 16px;
			font-size: 0.82rem;
			color: #10b981;
			margin-bottom: 20px;
		}
		.dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 10px #10b981; }
		.logo {
			font-size: 3rem;
			font-weight: 800;
			margin-bottom: 10px;
			background: linear-gradient(135deg, #fff 0%, #a5b4fc 50%, #d946ef 100%);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
		}
		.tagline { color: var(--muted); font-size: 1rem; margin-bottom: 35px; line-height: 1.6; }
		.search-form {
			background: rgba(20, 26, 42, 0.9);
			border: 1px solid rgba(255, 255, 255, 0.15);
			border-radius: 50px;
			padding: 6px 8px 6px 14px;
			display: flex;
			align-items: center;
			box-shadow: 0 10px 40px rgba(0,0,0,0.6), 0 0 25px rgba(99, 102, 241, 0.25);
			margin-bottom: 40px;
		}
		.search-form:focus-within { border-color: var(--accent); box-shadow: 0 0 35px rgba(99, 102, 241, 0.4); }
		.engine-select {
			background: rgba(255, 255, 255, 0.08);
			color: #fff;
			border: 1px solid var(--border);
			border-radius: 30px;
			padding: 8px 12px;
			font-size: 0.85rem;
			font-family: inherit;
			outline: none;
			cursor: pointer;
			margin-left: 8px;
		}
		.engine-select option { background: #121727; color: #fff; }
		.search-input {
			flex: 1;
			background: transparent;
			border: none;
			outline: none;
			color: #fff;
			font-size: 1rem;
			font-family: inherit;
			padding: 8px;
			direction: rtl;
			text-align: right;
		}
		.search-input::placeholder { color: rgba(255, 255, 255, 0.35); }
		.submit-btn {
			background: linear-gradient(135deg, #6366f1, #8b5cf6);
			color: #fff;
			border: none;
			border-radius: 30px;
			padding: 10px 24px;
			font-size: 0.95rem;
			font-weight: 700;
			cursor: pointer;
			transition: all 0.2s;
		}
		.submit-btn:hover { opacity: 0.9; transform: scale(1.02); }
		.categories { display: flex; flex-direction: column; gap: 20px; text-align: right; }
		.cat-title { font-size: 1.05rem; font-weight: 700; color: #e2e8f0; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
		.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
		.card {
			background: var(--card);
			border: 1px solid var(--border);
			border-radius: 14px;
			padding: 12px 14px;
			text-decoration: none;
			color: var(--text);
			display: flex;
			align-items: center;
			gap: 12px;
			transition: all 0.2s;
		}
		.card:hover {
			background: var(--card-hover);
			border-color: var(--accent);
			transform: translateY(-2px);
			box-shadow: 0 6px 20px rgba(0,0,0,0.4);
		}
		.card-icon {
			width: 38px;
			height: 38px;
			border-radius: 10px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 1.2rem;
			flex-shrink: 0;
		}
		.tg-icon { background: linear-gradient(135deg, #2aabee, #229ed9); }
		.wa-icon { background: linear-gradient(135deg, #25d366, #128c7e); }
		.yt-icon { background: linear-gradient(135deg, #ff0000, #cc0000); }
		.dc-icon { background: linear-gradient(135deg, #5865f2, #4752c4); }
		.gpt-icon { background: linear-gradient(135deg, #10a37f, #0d8a6b); }
		.gh-icon { background: linear-gradient(135deg, #24292e, #0f141a); }
		.wiki-icon { background: linear-gradient(135deg, #6b7280, #374151); }
		.sp-icon { background: linear-gradient(135deg, #1db954, #128c3e); }
		.card-text h4 { font-size: 0.88rem; font-weight: 600; margin-bottom: 2px; }
		.card-text p { font-size: 0.72rem; color: var(--muted); }
		footer { margin-top: 50px; font-size: 0.82rem; color: rgba(255, 255, 255, 0.35); }
	</style>
</head>
<body>
	<div class="container">
		<div class="status-badge"><span class="dot"></span> <span>Zero-Install Cloud Gateway Online</span></div>
		<div class="logo">amirsh Cloud Browser</div>
		<p class="tagline">مرورگر ابری تحت وب برای سیستم‌های سازمانی و اداری بدون نیاز به دسترسی ادمین و نصب برنامه</p>
		
		<form class="search-form" action="/" method="GET">
			<select name="engine" class="engine-select">
				<option value="duckduckgo">🦆 DuckDuckGo</option>
				<option value="google">🌐 Google</option>
				<option value="bing">🔎 Bing</option>
				<option value="brave">⚡ Brave</option>
			</select>
			<input type="text" name="url" class="search-input" placeholder="آدرس سایت (مثلاً web.telegram.org) یا عبارت جستجو..." autofocus autocomplete="off" required />
			<button type="submit" class="submit-btn">ورود ➔</button>
		</form>

		<div class="categories">
			<div>
				<div class="cat-title">💬 پیام‌رسان‌ها (ورود سریع با QR Code)</div>
				<div class="grid">
					<a class="card" href="/proxy/https://web.telegram.org/k/">
						<div class="card-icon tg-icon">✈️</div>
						<div class="card-text">
							<h4>Telegram Web</h4>
							<p>ورود با اسکن QR تلگرام</p>
						</div>
					</a>
					<a class="card" href="/proxy/https://web.whatsapp.com">
						<div class="card-icon wa-icon">💬</div>
						<div class="card-text">
							<h4>WhatsApp Web</h4>
							<p>ورود با اسکن QR واتساپ</p>
						</div>
					</a>
					<a class="card" href="/proxy/https://discord.com/app">
						<div class="card-icon dc-icon">🎮</div>
						<div class="card-text">
							<h4>Discord Web</h4>
							<p>چت و سرورهای دیسکورد</p>
						</div>
					</a>
				</div>
			</div>

			<div>
				<div class="cat-title">📺 رسانه و استریم</div>
				<div class="grid">
					<a class="card" href="/proxy/https://www.youtube.com">
						<div class="card-icon yt-icon">📺</div>
						<div class="card-text">
							<h4>YouTube</h4>
							<p>ویدیوها و کانال‌ها</p>
						</div>
					</a>
					<a class="card" href="/proxy/https://open.spotify.com">
						<div class="card-icon sp-icon">🎵</div>
						<div class="card-text">
							<h4>Spotify Web</h4>
							<p>پخش موسیقی</p>
						</div>
					</a>
				</div>
			</div>

			<div>
				<div class="cat-title">⚡ هوش مصنوعی و وب</div>
				<div class="grid">
					<a class="card" href="/proxy/https://chatgpt.com">
						<div class="card-icon gpt-icon">🧠</div>
						<div class="card-text">
							<h4>ChatGPT</h4>
							<p>دستیار هوش مصنوعی</p>
						</div>
					</a>
					<a class="card" href="/proxy/https://github.com">
						<div class="card-icon gh-icon">🐙</div>
						<div class="card-text">
							<h4>GitHub</h4>
							<p>مخازن و کدها</p>
						</div>
					</a>
					<a class="card" href="/proxy/https://www.wikipedia.org">
						<div class="card-icon wiki-icon">🌐</div>
						<div class="card-text">
							<h4>Wikipedia</h4>
							<p>دانشنامه آزاد</p>
						</div>
					</a>
				</div>
			</div>
		</div>

		<footer>amirsh Cloud Browser • Regdaal.ir</footer>
	</div>
</body>
</html>`;
}

function getErrorHTML(target, msg) {
	return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>خطا</title><style>body { font-family: sans-serif; background: #0b0d17; color: #fff; text-align: center; padding: 60px 20px; } .box { background: #1a1c29; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 30px; max-width: 550px; margin: auto; } h2 { color: #f87171; } a { color: #818cf8; text-decoration: none; display: inline-block; margin-top: 20px; }</style></head><body><div class="box"><h2>خطا در اتصال</h2><p style="color: #ccc; word-break: break-all;">${target}</p><p style="color: #f87171; font-size: 12px; margin: 10px 0;">${msg}</p><a href="/">⬅ بازگشت به خانه</a></div></body></html>`;
}
