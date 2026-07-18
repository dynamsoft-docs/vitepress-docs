<script setup lang="ts">
import { computed } from "vue";
import footerHtml from "../chrome/page-footer.html?raw";
import "../chrome/chrome.css";

const footer = computed(() => footerHtml.replaceAll("%%YEAR%%", String(new Date().getFullYear())));
</script>

<template>
	<div class="ds-corporate ds-corporate-footer" v-html="footer" />
</template>
