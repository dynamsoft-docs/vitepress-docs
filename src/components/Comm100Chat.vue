<script setup lang="ts">
import { onMounted } from "vue";
import { useData } from "vitepress";

const { theme } = useData();

// Fleet-wide defaults from Docs-Template-Repo's livehelp.html.
const DEFAULTS = { siteId: 90003305, planId: "20242b05-3781-4d86-9b7f-fab63ddcdde3" };

onMounted(() => {
	if (document.getElementById("ds-comm100")) return;
	const { siteId, planId } = { ...DEFAULTS, ...(theme.value.comm100 ?? {}) };

	const button = document.createElement("div");
	button.id = `comm100-button-${planId}`;
	document.body.appendChild(button);

	type Comm100 = {
		chat_buttons?: { code_plan: string; div_id: string }[];
		site_id?: number;
		main_code_plan?: string;
		loaded?: boolean;
	};
	const api: Comm100 = ((window as unknown as { Comm100API?: Comm100 }).Comm100API ??= {});
	api.chat_buttons ??= [];
	api.chat_buttons.push({ code_plan: planId, div_id: button.id });
	api.site_id = siteId;
	api.main_code_plan = planId;

	const load = (base: string, id?: string) => {
		const script = document.createElement("script");
		if (id) script.id = id;
		script.async = true;
		script.src = base + siteId;
		document.head.appendChild(script);
	};
	load("https://vue.comm100.com/livechat.ashx?siteId=", "ds-comm100");
	setTimeout(() => {
		if (!api.loaded) load("https://standby.comm100vue.com/livechat.ashx?siteId=");
	}, 5000);
});
</script>

<template>
	<span style="display: none" aria-hidden="true" />
</template>
