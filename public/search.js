"use strict";
/**
 * Smart Search and URL resolver
 * @param {string} input
 * @param {string} template Template for a search query.
 * @returns {string} Fully qualified URL
 */
function search(input, template) {
	input = input.trim();

	// 1. Direct Popular Shortcuts (Instant navigation without search engine captcha)
	const popularAliases = {
		youtube: "https://www.youtube.com",
		yt: "https://www.youtube.com",
		telegram: "https://web.telegram.org/k/",
		tg: "https://web.telegram.org/k/",
		whatsapp: "https://web.whatsapp.com",
		wa: "https://web.whatsapp.com",
		discord: "https://discord.com/app",
		instagram: "https://www.instagram.com",
		insta: "https://www.instagram.com",
		twitter: "https://x.com",
		x: "https://x.com",
		reddit: "https://www.reddit.com",
		github: "https://github.com",
		chatgpt: "https://chatgpt.com",
		claude: "https://claude.ai",
		spotify: "https://open.spotify.com",
		wiki: "https://www.wikipedia.org",
		wikipedia: "https://www.wikipedia.org",
	};

	const lower = input.toLowerCase();
	if (popularAliases[lower]) {
		return popularAliases[lower];
	}

	try {
		// input is a valid URL:
		return new URL(input).toString();
	} catch (err) {
		// not a full URL
	}

	try {
		// input is a domain: e.g. youtube.com, google.com, test.org
		const url = new URL(`https://${input}`);
		if (url.hostname.includes(".") && !input.includes(" ")) {
			return url.toString();
		}
	} catch (err) {
		// not a simple domain
	}

	// Default fallback to reliable search engine
	const engine = template || "https://duckduckgo.com/?q=%s";
	return engine.replace("%s", encodeURIComponent(input));
}

