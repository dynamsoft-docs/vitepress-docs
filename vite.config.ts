import { defineConfig } from "vite-plus";

export default defineConfig({
	staged: {
		"*": "vp check --fix",
	},
	fmt: {
		// oxfmt markdown printer ignores useTabs
		ignorePatterns: ["**/*.md"],
	},
});
