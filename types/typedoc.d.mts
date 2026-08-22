/**
 * Wrap a docs package's typedoc config with the Dynamsoft defaults; anything
 * the package sets overrides them.
 *
 * Source links follow the branch being documented, which versions.json already
 * names — so nothing here has to be kept in step with the source. That branch
 * has to exist on the repository `repo` names. Path options resolve against
 * the caller's typedoc.config.mjs.
 * @param {import("./types.js").DynamsoftTypedocConfig} [config]
 * @returns {Record<string, unknown>}
 */
export declare function defineDynamsoftTypedoc(config?: import("./types.js").DynamsoftTypedocConfig): Record<string, unknown>;
