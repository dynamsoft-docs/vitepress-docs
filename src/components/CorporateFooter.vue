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
