<script setup lang="ts">
import { useData } from "vitepress";

// defineDynamsoftConfig adds the loader script and picks the container. Only
// the noscript half has to be markup — a visitor without scripting cannot run
// an injector.
const { theme } = useData();
const iframe = `<iframe src="https://www.googletagmanager.com/ns.html?id=${theme.value.gtm}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
</script>

<template>
	<!-- v-html: with scripting on, browsers parse noscript content as text,
	so hydrating it as elements would mismatch. -->
	<noscript v-if="theme.gtm" v-html="iframe" />
</template>
