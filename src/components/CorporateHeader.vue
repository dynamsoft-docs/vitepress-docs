<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import headerHtml from "../chrome/page-header.html?raw";
import "../chrome/chrome.css";

const host = ref<HTMLElement | null>(null);

// The corporate layout.js binds the visitor block's "Log in" control to its
// sign-in flyout, so the vendored markup ships a dead `href="#"` (the live
// corporate header does too). Point it at the customer portal login, carrying
// the same `callback` the corporate header.min.js sends so signing in returns
// to the page the reader left. GLOBAL.SiteRoot per the corporate site.min.js.
const SITE_ROOT = "https://www.dynamsoft.com/api-common";

const loginHref = () =>
	`${SITE_ROOT}/Login/Login?callback=${encodeURIComponent(window.location.href)}`;

// The header mounts once and survives SPA route changes, so a mount-time
// callback goes stale; onHostClick refreshes it as the click is dispatched.
function wireLogin() {
	const links = host.value?.querySelectorAll<HTMLAnchorElement>(".header-visitor a");
	for (const link of links ?? []) link.href = loginHref();
}

// ── Corporate session ────────────────────────────────────────────────────
// In production the docs are served from www.dynamsoft.com, so the corporate
// session is readable here. This mirrors the corporate header.min.js: gate on
// the token cookie, take the display name from localStorage["user"] (which the
// corporate site fills from Api/User/Info), fall back to that API when the
// store is cold, then render initials. Corporate-owned storage is only ever
// read, never written — the corporate pages own its shape.
const COOKIE_DOMAIN = "dynamsoft.com";
const TOKEN_COOKIE = "DynamsoftTokenBackup";
/** Everything the corporate logout clears (site.min.js D_CookieName + authMethod). */
const SESSION_COOKIES = [
	"DynamsoftEmail",
	"DynamsoftRole",
	"DynamsoftTokenBackup",
	"DynamsoftUser",
	"DynamsoftUserName",
	"DynamsoftUserLastName",
	"DynamsoftLTSToken",
	"DynamsoftLTSTokenV2",
	"DynamsoftCompanyId",
	"DynamsoftDLSServerId",
	"DynamsoftLTSVersion",
	"DynamsoftCompanyName",
	"DynamsoftPhone",
	"DynamsoftTitle",
	"authMethod",
];

function cookie(name: string) {
	const hit = document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`));
	return hit ? hit.slice(name.length + 1) : "";
}

function isSignedIn() {
	const token = cookie(TOKEN_COOKIE);
	return !!token && token !== "null";
}

/** First letter of each word, or the first two of a single one — header.min.js. */
function initials(name: string) {
	const first = name.charAt(0);
	if (!first) return "AN";
	if (!/[A-Za-z]/.test(first)) return first;
	const words = name.split(" ").filter(Boolean);
	return words.length > 1 ? words.map((word) => word.charAt(0)).join("") : first + name.charAt(1);
}

/** The corporate store, honouring the expiry stamp it writes alongside. */
function storedName() {
	try {
		const raw = localStorage.getItem("user");
		if (!raw) return "";
		const info = JSON.parse(raw) as { UserName?: string; Exp?: string };
		if (info.Exp && new Date(info.Exp) < new Date()) return "";
		return info.UserName ?? "";
	} catch {
		return "";
	}
}

/** The same call the corporate header makes when its store is cold. */
async function fetchName() {
	try {
		const response = await fetch(`${SITE_ROOT}/Api/User/Info`, {
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": "application/json" },
			credentials: "include",
		});
		const body = await response.json();
		if (body?.code !== 0) return "";
		return `${body.data?.firstName ?? ""} ${body.data?.lastName ?? ""}`.trim();
	} catch {
		// Cross-origin during local dev, or the network refused: stay logged out.
		return "";
	}
}

async function applySession() {
	if (!isSignedIn()) return;
	// No profile means no session to show — the corporate header bails here too
	// rather than reveal an empty userbox.
	const name = storedName() || (await fetchName());
	if (!name) return;
	// Two account blocks ship in the markup (wide and narrow headers) and the
	// corporate JS fills both; missing one leaves an empty avatar circle.
	const labels = host.value?.querySelectorAll<HTMLElement>(".header-signin .username");
	for (const label of labels ?? []) label.textContent = initials(name);
	// The vendored "Log out" calls a global that came from the corporate
	// layout.js; hand those clicks to onHostClick instead.
	const outs = host.value?.querySelectorAll<HTMLAnchorElement>(".userbox-more a[onclick]");
	for (const out of outs ?? []) {
		out.removeAttribute("onclick");
		out.dataset.dsLogout = "";
	}
	// Reveal last, so the placeholder never flashes before the initials land.
	host.value?.classList.add("ds-signed-in");
}

async function logout() {
	try {
		const response = await fetch(
			`${SITE_ROOT}/Api/User/Logout?token=${encodeURIComponent(cookie(TOKEN_COOKIE))}`,
			{ credentials: "include" },
		);
		if ((await response.json())?.code !== 0) return;
	} catch {
		return;
	}
	for (const name of SESSION_COOKIES) {
		document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${COOKIE_DOMAIN}`;
	}
	localStorage.removeItem("user");
	sessionStorage.removeItem("userInfo");
	sessionStorage.removeItem(btoa("DM_USER"));
	sessionStorage.removeItem("isUserInfoFinished");
	window.location.href = loginHref();
}

// Menu toggle class → dropdown panel id, standing in for the corporate
// layout.js (which is not vendored).
const PANELS: Record<string, string> = {
	proMenu: "subMenu",
	demoMenu: "demoSubMenu",
	developerMenu: "developerSubMenu",
	solutionMenu: "solutionSubMenu",
	companyMenu: "companySubMenu",
};

let openPanel: string | null = null;

function setPanel(id: string | null) {
	openPanel = id;
	if (id) closeUserboxes();
	for (const [toggleClass, panelId] of Object.entries(PANELS)) {
		const open = panelId === id;
		const panel = host.value?.querySelector<HTMLElement>(`#${panelId}`);
		if (panel) panel.style.display = open ? "block" : "none";
		host.value?.querySelector(`.${toggleClass}`)?.closest("li")?.classList.toggle("on", open);
	}
}

// The signed-in account popup is display:none with nothing but the corporate
// JS to reveal it, so its entries (trial licence, downloads, orders, team,
// sales portal, log out) would be unreachable once applySession reveals the
// userbox. Toggle it here, like the menu panels.
function closeUserboxes() {
	for (const popup of host.value?.querySelectorAll<HTMLElement>(".userbox-more") ?? []) {
		popup.style.display = "none";
	}
}

function toggleUserbox(box: Element) {
	const popup = box.querySelector<HTMLElement>(".userbox-more");
	const open = popup?.style.display !== "block";
	closeUserboxes();
	if (popup && open) popup.style.display = "block";
}

function onHostClick(event: Event) {
	if ((event.target as HTMLElement).closest?.("[data-ds-logout]")) {
		event.preventDefault();
		void logout();
		return;
	}
	// Re-stamp the login callback with the route the reader is actually on.
	if ((event.target as HTMLElement).closest?.(".header-visitor a")) return wireLogin();
	// The avatar, but not the links inside the popup it opens.
	const box = (event.target as HTMLElement).closest?.(".userbox");
	if (box && !(event.target as HTMLElement).closest?.(".userbox-more")) {
		event.preventDefault();
		event.stopPropagation();
		return toggleUserbox(box);
	}
	const toggle = (event.target as HTMLElement).closest?.(".mdMenuToggle");
	if (!toggle) return;
	const entry = Object.entries(PANELS).find(([cls]) => toggle.classList.contains(cls));
	if (!entry) return;
	event.preventDefault();
	event.stopPropagation();
	setPanel(openPanel === entry[1] ? null : entry[1]);
}

function closeAll() {
	setPanel(null);
	closeUserboxes();
}

function onKey(event: KeyboardEvent) {
	if (event.key === "Escape") closeAll();
}

// The corporate header scrolls away with the page while the VitePress nav
// bar — offset by --vp-layout-top-height — docks at the viewport top. The
// header height is responsive, so measure it.
let height = 0;
let raf = 0;
let observer: ResizeObserver | undefined;

function onScroll() {
	cancelAnimationFrame(raf);
	raf = requestAnimationFrame(() => {
		const off = Math.min(window.scrollY, height);
		const root = document.documentElement.style;
		root.setProperty("--ds-header-offset", `${-off}px`);
		root.setProperty("--vp-layout-top-height", `${height - off}px`);
	});
}

onMounted(() => {
	wireLogin();
	void applySession();
	document.addEventListener("click", closeAll);
	document.addEventListener("keydown", onKey);
	window.addEventListener("scroll", onScroll, { passive: true });
	if (host.value) {
		observer = new ResizeObserver(() => {
			height = host.value?.offsetHeight ?? 0;
			onScroll();
		});
		observer.observe(host.value);
	}
});

onUnmounted(() => {
	document.removeEventListener("click", closeAll);
	document.removeEventListener("keydown", onKey);
	window.removeEventListener("scroll", onScroll);
	observer?.disconnect();
	cancelAnimationFrame(raf);
});
</script>

<template>
	<!-- vp-raw opts the subtree out of the VitePress router's click
		handler. The docs are served from www.dynamsoft.com, so every
		corporate link is same-origin: without this the router swallows the
		click, pushes the URL, finds no page in this site and renders its own
		404 — the target page only appears on a manual refresh. -->
	<div
		ref="host"
		class="ds-corporate ds-corporate-header vp-raw"
		v-html="headerHtml"
		@click="onHostClick"
	/>
</template>
