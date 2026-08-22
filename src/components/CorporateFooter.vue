<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import footerHtml from "../chrome/page-footer.html?raw";
import "../chrome/chrome.css";

const host = ref<HTMLElement | null>(null);

const footer = computed(() => footerHtml.replaceAll("%%YEAR%%", String(new Date().getFullYear())));

// Every footer entry is a plain link except the back-to-top control, which
// the vendored markup ships as a dead `javascript:void(0)` anchor: revealing
// it past the fold and scrolling the page are the corporate layout.js's job
// (not vendored). Reproduce both, like the header's menu shim.
const REVEAL_AFTER = 400;
let raf = 0;

function onScroll() {
	cancelAnimationFrame(raf);
	raf = requestAnimationFrame(() => {
		host.value?.classList.toggle("ds-past-fold", window.scrollY > REVEAL_AFTER);
	});
}

function onHostClick(event: Event) {
	if (!(event.target as HTMLElement).closest?.("#toTop")) return;
	event.preventDefault();
	window.scrollTo({ top: 0, behavior: "smooth" });
}

onMounted(() => {
	onScroll();
	window.addEventListener("scroll", onScroll, { passive: true });
});

onUnmounted(() => {
	window.removeEventListener("scroll", onScroll);
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
		class="ds-corporate ds-corporate-footer vp-raw"
		v-html="footer"
		@click="onHostClick"
	/>
</template>
