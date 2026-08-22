<script setup lang="ts">
import { computed } from "vue";
import { useData, withBase } from "vitepress";

const { page, frontmatter, theme } = useData();

// Each directory in the path becomes a linked crumb, named by
// themeConfig.breadcrumbLabels where it says so; the page title ends the trail.
const crumbs = computed(() => {
	const labels: Record<string, string> = theme.value.breadcrumbLabels ?? {};
	const dirs = page.value.relativePath
		.replace(/[^/]*$/, "")
		.split("/")
		.filter(Boolean);
	const list = dirs.map((dir, i) => ({
		text: labels[dir] ?? dir.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
		link: withBase(`/${dirs.slice(0, i + 1).join("/")}/`),
	}));
	// An index page usually repeats its directory's name; drop that crumb.
	if (list.length > 0 && list[list.length - 1].text === page.value.title) list.pop();
	return list;
});
</script>

<template>
	<nav v-if="frontmatter.layout !== 'home'" class="ds-breadcrumbs" aria-label="Breadcrumb">
		<a :href="withBase('/')">Docs</a>
		<template v-for="c in crumbs" :key="c.link">
			<span>/</span>
			<a :href="c.link">{{ c.text }}</a>
		</template>
		<span>/</span>
		<span class="ds-breadcrumbs-current">{{ page.title }}</span>
	</nav>
</template>

<style>
/* Rendered at the start of the nav-bar content row; margin pushes the
   search/download/theme-switcher group to the right. */
.ds-breadcrumbs {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	margin-right: auto;
	font-size: 13px;
	font-weight: 400;
	color: var(--vp-c-text-3);
	white-space: nowrap;
}

@media (max-width: 768px) {
	.ds-breadcrumbs {
		display: none;
	}
}

.ds-breadcrumbs a {
	color: var(--vp-c-text-2);
}

.ds-breadcrumbs a:hover {
	color: var(--vp-c-brand-1);
}

.ds-breadcrumbs-current {
	overflow: hidden;
	text-overflow: ellipsis;
	color: var(--vp-c-text-1);
}
</style>
