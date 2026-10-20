<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import footerHtml from "../chrome/page-footer.html?raw";
import "../chrome/chrome.css";

const host = ref<HTMLElement | null>(null);

const footer = computed(() => footerHtml.replaceAll("%%YEAR%%", String(new Date().getFullYear())));

// Every footer entry is a plain link except back-to-top, which the vendored
// markup ships as a dead `javascript:void(0)`: on the corporate site its own
// JS reveals it past the fold and does the scrolling. Do both here.
const REVEAL_AFTER = 400;
let raf = 0;

// The sidebar and the outline are fixed to the viewport. Publish how much of
// the footer is in view, so that custom.css can end them above it.
function onScroll() {
	cancelAnimationFrame(raf);
	raf = requestAnimationFrame(() => {
		const el = host.value;
		if (!el) return;
		el.classList.toggle("ds-past-fold", window.scrollY > REVEAL_AFTER);
		const overlap = Math.max(0, window.innerHeight - el.getBoundingClientRect().top);
		document.documentElement.style.setProperty("--ds-footer-overlap", `${overlap}px`);
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
	window.addEventListener("resize", onScroll, { passive: true });
});

onUnmounted(() => {
	window.removeEventListener("scroll", onScroll);
	window.removeEventListener("resize", onScroll);
	cancelAnimationFrame(raf);
	document.documentElement.style.removeProperty("--ds-footer-overlap");
});
</script>

<template>
	<!-- vp-raw keeps the VitePress router out of this subtree. The docs are
		served from www.dynamsoft.com, so every corporate link is same-origin:
		without it the router swallows the click and renders this site's 404 at
		the corporate URL, and only a refresh gets the reader there. -->
	<div
		ref="host"
		class="ds-corporate ds-corporate-footer vp-raw"
		v-html="footer"
		@click="onHostClick"
	/>
</template>
