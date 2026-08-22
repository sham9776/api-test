/**
 * Cloudflare Worker Reverse Proxy for Ultraviolet + Wisp on Railway
 * Domain: regdaal.ir (or any custom domain)
 */

// ⚙️ آدرس دامنه سرویس خود در Railway را اینجا قرار دهید:
const UPSTREAM_HOSTNAME = "api-test-production-5d84.up.railway.app";

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// ساخت آدرس مقصد در Railway
		const upstreamUrl = new URL(request.url);
		upstreamUrl.hostname = UPSTREAM_HOSTNAME;
		upstreamUrl.protocol = "https:";
		upstreamUrl.port = "443";

		// کپی و تنظیم هدرها
		const newHeaders = new Headers(request.headers);
		newHeaders.set("Host", UPSTREAM_HOSTNAME);
		newHeaders.set("X-Forwarded-Host", url.hostname);
		newHeaders.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
		newHeaders.set("X-Real-IP", request.headers.get("CF-Connecting-IP") || "");

		// مدیریت ترافیک WebSocket برای پروتکل پرسرعت Wisp
		const isWebSocket = request.headers.get("Upgrade") === "websocket";

		try {
			const response = await fetch(upstreamUrl.toString(), {
				method: request.method,
				headers: newHeaders,
				body: (request.method !== "GET" && request.method !== "HEAD") ? request.body : null,
				redirect: "manual",
			});

			// اگر درخواست وب‌سوکت است، مستقیماً پاسخ بازگردانده می‌شود
			if (isWebSocket) {
				return response;
			}

			// کپی هدرهای پاسخ و اطمینان از اعمال هدرهای ایزولاسیون امنیتی
			const responseHeaders = new Headers(response.headers);
			responseHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
			responseHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
			responseHeaders.set("Access-Control-Allow-Origin", "*");

			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: responseHeaders,
			});
		} catch (error) {
			return new Response(
				`<!DOCTYPE html>
				<html lang="fa" dir="rtl">
				<head>
					<meta charset="utf-8">
					<title>خطا در اتصال به سرور</title>
					<style>
						body { font-family: sans-serif; background: #0f111a; color: #fff; text-align: center; padding: 50px; }
						.box { background: #1a1c29; border: 1px solid #333; border-radius: 12px; padding: 30px; max-width: 500px; margin: auto; }
						h2 { color: #f87171; }
					</style>
				</head>
				<body>
					<div class="box">
						<h2>خطا در برقراری ارتباط با سرور Railway</h2>
						<p>لطفاً مطمئن شوید سرویس Railway در وضعیت Active قرار دارد.</p>
						<p style="color: #999; font-size: 12px;">${error.message}</p>
					</div>
				</body>
				</html>`,
				{
					status: 502,
					headers: { "Content-Type": "text/html; charset=utf-8" },
				}
			);
		}
	},
};
