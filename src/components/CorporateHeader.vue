<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import headerHtml from "../chrome/page-header.html?raw";
import "../chrome/chrome.css";

const host = ref<HTMLElement | null>(null);

// The corporate layout.js binds the visitor block's "Log in" control to its
// sign-in flyout, so the vendored markup ships a dead `href="#"` (the live
// corporate header does too). Point it at the customer portal login instead.
const LOGIN_URL = "https://www.dynamsoft.com/api-common/Login/Login";

function wireLogin() {
	const links = host.value?.querySelectorAll<HTMLAnchorElement>('.header-visitor a[href="#"]');
	for (const link of links ?? []) link.href = LOGIN_URL;
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
	for (const [toggleClass, panelId] of Object.entries(PANELS)) {
		const open = panelId === id;
		const panel = host.value?.querySelector<HTMLElement>(`#${panelId}`);
		if (panel) panel.style.display = open ? "block" : "none";
		host.value?.querySelector(`.${toggleClass}`)?.closest("li")?.classList.toggle("on", open);
	}
}

function onHostClick(event: Event) {
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
	<!-- Keeps the VitePress router from intercepting the corporate
		links that would otherwise SPA-navigate to the docs base -->
	<div
		ref="host"
		class="ds-corporate ds-corporate-header vp-raw"
		v-html="headerHtml"
		@click="onHostClick"
	/>
</template>
