/**
 * Wrap a docs package's typedoc config with the fleet-wide Dynamsoft
 * defaults; site-provided values override them.
 *
 * Source links point at the branch being documented, which versions.json
 * already names, so nothing has to be kept in step with the source. That
 * branch must exist on the repository `repo` names.
 *
 * Path-type options (out, docsRoot, basePath, tsconfig, entryPoints)
 * resolve against the caller's typedoc.config.mjs.
 *
 * @param {import("./types.js").DynamsoftTypedocConfig} [config]
 * @returns {Record<string, unknown>}
 */
export function defineDynamsoftTypedoc(config?: import("./types.js").DynamsoftTypedocConfig): Record<string, unknown>;
