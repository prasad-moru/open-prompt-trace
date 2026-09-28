# OpenPromptTrace

A React + TypeScript + Vite prompt profiler. Tokenization and heuristic analysis run locally through `@dqbd/tiktoken` WebAssembly. The application fetches only its bundled assets; prompts are never sent to a service. No credentials, telemetry, backend, or persistent storage are required. Once loaded, profiling works without a connection. Offline reload is not provided by a service worker.

## Development

```sh
npm install
npm run dev
npm test
npm run lint
npm run build
```

On PowerShell systems that disable script shims, use `npm.cmd`.

## Architecture

- `src/core/tokenizer/engine.ts`: app-lifetime WASM initialization, owned encoder allocation, exact streaming UTF-8 decoding, UTF-16 token ranges, and count-only tokenization.
- `src/core/tokenizer/ownership.ts`: shared ownership leases with microtask-deferred release to tolerate React StrictMode effect replay.
- `src/core/profiler/linter.ts`: deterministic diagnostics, bounded analysis, non-overlapping replacement preview, and full-context savings calculations.
- `src/hooks/TokenizerProvider.tsx`: application-level owner. Final unmount releases the encoder; subsequent initialization reuses the same WASM module.
- `src/hooks/usePromptProfile.ts`: typed, 200ms-debounced access with stale-result cancellation and explicit error states.
- `src/core/pricing/calculator.ts`: static September 2026 input pricing and gross/net monthly cost calculations.
- `src/components/`: editor, diagnostic token heatmap, pruned diff with clipboard copy, invocation slider, and diagnostics using plain dark-mode CSS.
- `src/lib/tokenizer.ts`: compatibility facade for the original `tokenizePrompt()` API, sharing the new engine.

`initTokenizer(): Promise<void>` shares in-flight initialization. `tokenizeRaw(text)` is synchronous after initialization, returning `tokens`, `decodedPieces`, `offsets`, and `charCount`. `isTokenizerReady()` reports encoder availability. `freeTokenizer()` invalidates pending encoder creation and releases the encoder; it does not destroy the app-lifetime WASM module. Explicitly freeing an encoder requires awaiting initialization before the next synchronous call.

For valid Unicode, `decodedPieces.join('') === text`. Partial character bytes are buffered until the closing token. Earlier pieces may be empty. Every token range uses half-open UTF-16 code units, so `text.slice(startIndex, endIndex)` equals its decoded piece. BOMs, CRLFs, and controls are preserved. Unpaired UTF-16 surrogates are rejected explicitly. Character counts use Unicode code points, not grapheme clusters.

Counts are authoritative for the `cl100k_base` encoding, not full chat-request billing. All pricing models are labeled **estimates based on cl100k proxy**. Pricing is the user-specified September 2026 baseline, not a live vendor quote: GPT-4o $2.50, Claude 3.5 Sonnet $3.00, GPT-4o mini $0.15, and Claude 3.5 Haiku $0.80 per million input tokens. Gross and net monthly costs use original and pruned token counts respectively, multiplied by the rate and monthly invocations. Monthly savings use the difference in token counts. The slider spans 1,000 to 1,000,000 invocations, defaulting to 50,000. These projections exclude output tokens, cached-token discounts, and request overhead. No remote pricing requests are made.

## Heuristics and limits

The profiler accepts up to 50,000 UTF-16 code units, 5,000 tokens, and 200 diagnostics. It reports an error without modifying or truncating input when a bound is exceeded. The token bound is checked before decoding and constructing visualization objects.

- **JSON formatting / warning:** scans balanced objects and arrays, including fenced or embedded JSON, with string and escape awareness. Validates JSON and removes whitespace outside string literals. Preserves large numbers, numeric notation, duplicate keys, and spaces inside strings. Invalid candidates are ignored. This is a deterministic scanner, not a full Markdown parser; malformed enclosing delimiters can prevent recognition of a nested candidate.
- **Redundant constraints / warning:** flags negative instructions separated by 1–80 characters for manual review. Does not assume semantic redundancy or assign speculative savings.
- **Whitespace bleed / info:** suggests normalizing three or more LF/CRLF breaks to `\n\n` and removing trailing spaces/tabs. The original token stream preserves all line endings. These are review-only suggestions because whitespace may affect Markdown or code.
- **Dynamic variables / neutral:** identifies `{{name}}`, `${name}`, and `<name>` with balanced delimiters. Angle-bracket matches can also be HTML. No replacement or savings is assigned.

Diagnostic IDs are deterministic. All ranges are UTF-16 offsets with exclusive ends. Suggestions never automatically alter the editor. The preview selects non-overlapping edits in source order, preferring outer edits at equal starts, then applies them in descending offset order. Savings come from retokenizing the complete preview rather than adding local estimates. If the combined preview increases token usage, it falls back to the original text. Empty-input bloat is zero. A finding does not imply that removing it is semantically safe.

## Verification

`npx vitest run` (or `npm test`) tests the actual Vite-bundled engine with local WASM bytes. Tests cover failed initialization/retry, concurrent initialization, cleanup races, ownership replay, reinitialization, exact Unicode reconstruction and offsets, heuristic categories, overlapping edits, bounded input, the compatibility API, exact diff reconstruction, heatmap ranges, and all four pricing formulas. The warm 5,000-token benchmark depends on hardware and is not a browser latency guarantee.

Vite is configured with `vite-plugin-wasm` and `vite-plugin-top-level-await`, targeting modern evergreen browsers. The engine retains its explicit asynchronous `.wasm?url` loader, which works even if a host supplies a generic binary MIME type. Rollup and esbuild are explicit development dependencies because the top-level-await plugin expects them but Vite 8 no longer supplies them transitively. The bundled vocabulary is large enough to produce Vite's chunk-size advisory.
