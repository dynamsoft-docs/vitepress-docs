<script setup lang="ts">
import { computed } from "vue";
import footerHtml from "../chrome/page-footer.html?raw";
import "../chrome/chrome.css";

const footer = computed(() => footerHtml.replaceAll("%%YEAR%%", String(new Date().getFullYear())));
</script>

<template>
	<!-- Keeps the VitePress router from intercepting the corporate
		links that would otherwise SPA-navigate to the docs base -->
	<div class="ds-corporate ds-corporate-footer vp-raw" v-html="footer" />
</template>
