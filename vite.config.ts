import { defineConfig } from "vite-plus";

export default defineConfig({
	staged: {
		"*": "vp check --fix",
	},
	fmt: {
		ignorePatterns: [
			// oxfmt markdown printer ignores useTabs
			"**/*.md",
			// The corporate chrome that scripts/sync-chrome.mts vendors. It stays byte-exact.
			"src/chrome/**",
			// The output of pnpm run types. A format pass would fight the tsc emit.
			"types/**",
		],
	},
});
