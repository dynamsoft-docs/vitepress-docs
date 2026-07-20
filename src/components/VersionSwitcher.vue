<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useData } from "vitepress";

interface VersionEntry {
	label: string;
	/** Path of this version relative to docsRoot: "" for latest, "v1.5/" for a frozen copy. */
	path: string;
}

const { theme } = useData();
const versions = ref<VersionEntry[]>([]);
const current = ref("");

onMounted(async () => {
	try {
		// versions.json is served from the docs root and shared by every
		// deployed version, so a frozen copy can still list newer releases.
		const res = await fetch(`${theme.value.docsRoot}versions.json`);
		if (!res.ok) return;
		versions.value = (await res.json()).versions ?? [];
		const here = location.pathname;
		const match = [...versions.value]
			.sort((a, b) => b.path.length - a.path.length)
			.find((v) => here.startsWith(theme.value.docsRoot + v.path));
		current.value = match?.path ?? "";
	} catch {
		// Leave the switcher hidden when versions.json is unavailable.
	}
});

async function go(event: Event) {
	const path = (event.target as HTMLSelectElement).value;
	const root: string = theme.value.docsRoot;
	// Try the same page in the target version (server-side redirects count:
	// fetch follows them, and the browser will follow the same one). Fall
	// back to the version root when the page has no counterpart. Caveat:
	// the dev server answers 200 for any live-site path (SPA fallback), so
	// the probe is only meaningful against static versions and production.
	const samePage = location.pathname.slice((root + current.value).length) + location.hash;
	const candidate = root + path + samePage;
	try {
		// The header lets the dev server answer from the page sources instead
		// of its 200-for-everything SPA fallback; production ignores it.
		const probe = await fetch(candidate, { method: "HEAD", headers: { "x-ds-probe": "1" } });
		location.href = probe.ok ? candidate : root + path;
	} catch {
		location.href = root + path;
	}
}
</script>

<template>
	<label v-if="versions.length" class="ds-version-switcher">
		Version
		<select :value="current" aria-label="Documentation version" @change="go">
			<option v-for="v in versions" :key="v.path" :value="v.path">{{ v.label }}</option>
		</select>
	</label>
</template>

<style>
/* Rendered at the top of the sidebar. */
.ds-version-switcher {
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 16px 0 8px;
	font-size: 13px;
	color: var(--vp-c-text-2);
}

.ds-version-switcher select {
	flex: 1;
	padding: 4px 8px;
	border: 1px solid var(--vp-c-divider);
	border-radius: 6px;
	background: var(--vp-c-bg);
	color: var(--vp-c-text-1);
	font-size: 13px;
}
</style>
