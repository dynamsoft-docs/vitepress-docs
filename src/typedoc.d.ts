/**
 * A docs package's typedoc options, plus the one fleet-specific key
 * `defineDynamsoftTypedoc` consumes rather than forwards. Typedoc's own
 * option types are not imported: this package does not depend on typedoc.
 */
export interface DynamsoftTypedocConfig {
	/** `owner/name` of the GitHub repository source links point at. */
	repo?: string;
	[option: string]: unknown;
}

/**
 * Wrap a docs package's typedoc config with the fleet-wide Dynamsoft
 * defaults (typedoc.base.json) and point its source links at the branch
 * being documented. See typedoc.js.
 */
export declare function defineDynamsoftTypedoc(
	config?: DynamsoftTypedocConfig,
): Record<string, unknown>;
