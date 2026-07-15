<script setup lang="ts">
import VPTheme from "vitepress/theme";
import { useData } from "vitepress";
import Breadcrumbs from "./components/Breadcrumbs.vue";
import Comm100Chat from "./components/Comm100Chat.vue";
import CorporateFooter from "./components/CorporateFooter.vue";
import CorporateHeader from "./components/CorporateHeader.vue";
import VersionSwitcher from "./components/VersionSwitcher.vue";

const { theme } = useData();
</script>

<template>
	<VPTheme.Layout>
		<template #layout-top>
			<CorporateHeader v-if="theme.dynamsoftChrome" />
		</template>
		<template #nav-bar-content-before>
			<Breadcrumbs />
		</template>
		<template #sidebar-nav-before>
			<VersionSwitcher />
		</template>
		<template #layout-bottom>
			<CorporateFooter v-if="theme.dynamsoftChrome" />
			<Comm100Chat v-if="theme.dynamsoftChrome" />
		</template>
	</VPTheme.Layout>
</template>
