<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useData, useRoute } from "vitepress";

const { page, site, theme } = useData();
const route = useRoute();

// Every page has a markdown copy at its own URL with a .md extension (see the
// config factory). Deriving it from the route keeps `cleanUrls` and `rewrites`
// out of the picture.
const markdownHref = computed(
	() => `${route.path.replace(/\.html$/, "").replace(/\/$/, "/index")}.md`,
);

const enabled = computed(() => theme.value.agentMarkdown !== false && !page.value.isNotFound);

/** Point the assistant at the markdown, not at the rendered page. */
const prompt = () =>
	`Read ${new URL(markdownHref.value, location.origin).href} so you can answer ` +
	`questions about "${page.value.title}" from the ${site.value.title} documentation.`;

const CHATS = [
	{ label: "Open in Claude", url: "https://claude.ai/new?q=" },
	{ label: "Open in ChatGPT", url: "https://chatgpt.com/?q=" },
];

const open = ref(false);
const copied = ref(false);
let clear = 0;

function close() {
	open.value = false;
}

function onKey(event: KeyboardEvent) {
	if (event.key === "Escape") close();
}

function toggle() {
	open.value = !open.value;
	// Only listen while the menu is open.
	if (open.value) {
		document.addEventListener("click", close);
		document.addEventListener("keydown", onKey);
	} else {
		document.removeEventListener("click", close);
		document.removeEventListener("keydown", onKey);
	}
}

async function copy() {
	try {
		const response = await fetch(markdownHref.value);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		await navigator.clipboard.writeText(await response.text());
		copied.value = true;
		clearTimeout(clear);
		clear = window.setTimeout(() => (copied.value = false), 2000);
	} catch {
		// No clipboard permission, or nothing to fetch: just show the markdown.
		window.open(markdownHref.value, "_blank", "noreferrer");
	}
}

function ask(url: string) {
	window.open(url + encodeURIComponent(prompt()), "_blank", "noreferrer");
	close();
}

onUnmounted(() => {
	document.removeEventListener("click", close);
	document.removeEventListener("keydown", onKey);
	clearTimeout(clear);
});
</script>

<template>
	<div v-if="enabled" class="ds-md-actions" @click.stop>
		<button class="ds-md-button" type="button" @click="copy">
			{{ copied ? "Copied" : "Copy page" }}
		</button>
		<button
			class="ds-md-button ds-md-toggle"
			type="button"
			aria-haspopup="menu"
			aria-label="More markdown actions"
			:aria-expanded="open"
			@click="toggle"
		>
			<span class="ds-md-caret" />
		</button>
		<div v-if="open" class="ds-md-menu" role="menu">
			<a :href="markdownHref" target="_blank" rel="noreferrer" role="menuitem" @click="close">
				View as Markdown
			</a>
			<button
				v-for="chat in CHATS"
				:key="chat.label"
				type="button"
				role="menuitem"
				@click="ask(chat.url)"
			>
				{{ chat.label }}
			</button>
		</div>
	</div>
</template>

<style>
/* Rendered above the article, right-aligned with its text column. */
.ds-md-actions {
	position: relative;
	display: flex;
	justify-content: flex-end;
	gap: 1px;
	margin-bottom: 8px;
}

.ds-md-actions .ds-md-button {
	padding: 3px 10px;
	border: 1px solid var(--vp-c-divider);
	background: var(--vp-c-bg-alt);
	color: var(--vp-c-text-2);
	font-size: 12px;
	font-weight: 500;
	line-height: 20px;
	transition:
		color 0.25s,
		border-color 0.25s;
}

.ds-md-actions .ds-md-button:first-child {
	border-radius: 4px 0 0 4px;
}

.ds-md-actions .ds-md-button:hover {
	border-color: var(--vp-c-brand-1);
	color: var(--vp-c-brand-1);
}

.ds-md-actions .ds-md-toggle {
	border-radius: 0 4px 4px 0;
	border-left: 0;
	padding: 3px 8px;
}

.ds-md-caret {
	display: inline-block;
	border-top: 4px solid currentcolor;
	border-right: 4px solid transparent;
	border-left: 4px solid transparent;
	vertical-align: 3px;
}

.ds-md-menu {
	position: absolute;
	top: calc(100% + 4px);
	right: 0;
	z-index: 20;
	display: flex;
	flex-direction: column;
	min-width: 168px;
	padding: 4px;
	border: 1px solid var(--vp-c-divider);
	border-radius: 6px;
	background: var(--vp-c-bg-elv);
	box-shadow: var(--vp-shadow-3);
}

.ds-md-menu > * {
	padding: 6px 10px;
	border-radius: 4px;
	color: var(--vp-c-text-1);
	font-size: 13px;
	line-height: 20px;
	text-align: left;
	white-space: nowrap;
}

.ds-md-menu > *:hover {
	background: var(--vp-c-default-soft);
	color: var(--vp-c-brand-1);
}
</style>
