<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import headerHtml from "../chrome/page-header.html?raw";
import "../chrome/chrome.css";

const host = ref<HTMLElement | null>(null);

// The vendored "Log in" control ships a dead `href="#"`, because on the
// corporate site its own JS opens a sign-in flyout. Send it to the customer
// portal instead, with a callback so signing in returns to this page.
const SITE_ROOT = "https://www.dynamsoft.com/api-common";

const loginHref = () =>
	`${SITE_ROOT}/Login/Login?callback=${encodeURIComponent(window.location.href)}`;

// The header outlives route changes, so the callback is stamped on at click
// time rather than on mount.
function wireLogin() {
	const links = host.value?.querySelectorAll<HTMLAnchorElement>(".header-visitor a");
	for (const link of links ?? []) link.href = loginHref();
}

// ── Corporate session ────────────────────────────────────────────────────
// The docs are served from www.dynamsoft.com, so the corporate session is
// readable here: check the token cookie, take the name from the profile the
// corporate site caches, ask the portal if nothing is cached, show initials.
// That storage is only ever read — the corporate pages own its shape.
const COOKIE_DOMAIN = "dynamsoft.com";
const TOKEN_COOKIE = "DynamsoftTokenBackup";
/** The cookies a corporate logout clears. */
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

/** First letter of each word, or the first two letters of a single one. */
function initials(name: string) {
	const first = name.charAt(0);
	if (!first) return "AN";
	if (!/[A-Za-z]/.test(first)) return first;
	const words = name.split(" ").filter(Boolean);
	return words.length > 1 ? words.map((word) => word.charAt(0)).join("") : first + name.charAt(1);
}

/** The cached profile, unless the expiry stamped on it has passed. */
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

/** Ask the portal for the profile when nothing is cached. */
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
		// Cross-origin in local dev, or the network refused: stay logged out.
		return "";
	}
}

async function applySession() {
	if (!isSignedIn()) return;
	// No profile, no session worth showing: an empty avatar is worse than the
	// logged-out state.
	const name = storedName() || (await fetchName());
	if (!name) return;
	// The markup carries an account block per header width; fill both.
	const labels = host.value?.querySelectorAll<HTMLElement>(".header-signin .username");
	for (const label of labels ?? []) label.textContent = initials(name);
	// The vendored "Log out" calls a global that does not exist here; send
	// those clicks to onHostClick instead.
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

// Menu toggle class → the panel it opens.
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

// The account popup is display:none until something reveals it, and only the
// corporate JS ever did — so its entries would be unreachable. Toggle it the
// same way as the menu panels.
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

// The corporate header scrolls away with the page while the VitePress nav bar
// stays docked at the top. The header height is responsive, so measure it.
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
	<!-- vp-raw keeps the VitePress router out of this subtree. The docs are
		served from www.dynamsoft.com, so every corporate link is same-origin:
		without it the router swallows the click and renders this site's 404 at
		the corporate URL, and only a refresh gets the reader there. -->
	<div
		ref="host"
		class="ds-corporate ds-corporate-header vp-raw"
		v-html="headerHtml"
		@click="onHostClick"
	/>
</template>
