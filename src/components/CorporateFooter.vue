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

// The sidebar and the outline are fixed to the viewport. Write the visible
// height of the footer to --ds-footer-overlap, so that custom.css can end both
// above the footer. Scrolling, resizing, and a change of the page height move
// the footer.
let overlap = -1;

function update() {
	cancelAnimationFrame(raf);
	raf = requestAnimationFrame(() => {
		const el = host.value;
		if (!el) return;
		const next = Math.max(0, window.innerHeight - el.getBoundingClientRect().top);
		el.classList.toggle("ds-past-fold", window.scrollY > REVEAL_AFTER);
		if (next === overlap) return;
		overlap = next;
		document.documentElement.style.setProperty("--ds-footer-overlap", `${next}px`);
	});
}

function onHostClick(event: Event) {
	if (!(event.target as HTMLElement).closest?.("#toTop")) return;
	event.preventDefault();
	window.scrollTo({ top: 0, behavior: "smooth" });
}

let pageHeight: ResizeObserver | undefined;

onMounted(() => {
	update();
	window.addEventListener("scroll", update, { passive: true });
	window.addEventListener("resize", update, { passive: true });
	pageHeight = new ResizeObserver(update);
	pageHeight.observe(document.body);
});

onUnmounted(() => {
	window.removeEventListener("scroll", update);
	window.removeEventListener("resize", update);
	pageHeight?.disconnect();
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
