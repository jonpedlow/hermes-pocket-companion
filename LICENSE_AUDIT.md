# Pocket Companion licence and intellectual-property audit

## Release scope and origin

This review covers the source-only v1.0.0 release, its locked dependency graph, the Windows npm installation, public artwork and documentation captures. The private development history and runtime installations are excluded from the distribution.

**Original source.** The owner reports that the original 26-file ZIP was generated for this project through ChatGPT, supplied under MIT and was not obtained from Grok Bot or another commercial app. All 26 archive entries matched the initial private import in the earlier audit. Subsequent Pocket integration and UI changes were authored for the project. This is the owner’s account, subject to third-party rights. It is not an unconditional declaration of title. The review found no identifiable copied proprietary application code or asset and no additional specific claimant. The audit cannot independently reconstruct every generation input.

**Public attribution approved, 14 November 2026.** Jon Pedlow approved retaining his name as the public copyright holder. Keep the original MIT notice, “Copyright (c) 2026 Jon Pedlow and Hermes Pocket Companion contributors”, and the applicable upstream notices. The owner approved source-only publication subject to final release checks.

## Dependency inventory

Versions below are the installed versions matched against the root lockfile. All 18 direct npm packages have a licence file in their installed package. The application/development column follows the manifest. The production launcher invokes `tsx`, despite its development classification. Its notice belongs with any installation that redistributes it.

| Direct package | Locked version | Manifest group | Licence |
|---|---|---|---|
| @types/express | 5.0.6 | Development | MIT |
| @types/node | 24.19.2 | Development | MIT |
| @types/react-dom | 19.3.0 | Development | MIT |
| @types/react | 19.3.0 | Development | MIT |
| @types/ws | 8.18.2 | Development | MIT |
| concurrently | 9.2.5 | Development | MIT |
| express | 5.3.0 | Application | MIT |
| lucide-react | 0.468.0 | Application | ISC + MIT for Feather portions |
| react-dom | 19.3.1 | Application | MIT |
| react-markdown | 10.1.0 | Application | MIT |
| react | 19.3.1 | Application | MIT |
| remark-gfm | 4.0.1 | Application | MIT |
| sharp | 0.35.5 | Application | Apache-2.0 |
| tsx | 4.23.15 | Development | MIT |
| typescript | 5.9.3 | Development | Apache-2.0 |
| vite | 7.3.8 | Development | MIT |
| ws | 8.23.0 | Application | MIT |
| yaml | 2.9.1 | Application | ISC |

The lockfile has 305 non-root package locations, including platform alternatives. Its declared identifiers include MIT, ISC, 0BSD, BSD-3-Clause, Apache-2.0 and LGPL-3.0-or-later, including compound expressions. All non-root entries declare a licence. On Windows, 231 distinct installed package/version pairs were examined. Three tool binary packages have metadata but no standalone root licence file in that package: `@esbuild/win32-x64`, `@rollup/rollup-win32-x64-gnu` and `@rollup/rollup-win32-x64-msvc`. Their matching parent packages provide MIT notices. Check upstream binary-specific credits if distributing the toolchain. Uninstalled platform variants were assessed from the lock only.

The workflow references `actions/checkout@v4` and `actions/setup-node@v4`. Both upstream actions are MIT-licensed and run on GitHub’s CI infrastructure. Git tracks the workflow references. Node.js, npm, Windows PowerShell, the browser, Hermes, its models and Tailscale are separately obtained runtime or installation components. The source release contains no copy of those installations. [Checkout licence](https://github.com/actions/checkout/blob/v4/LICENSE) · [Setup Node licence](https://github.com/actions/setup-node/blob/v4/LICENSE.md)

## Third-party and adapted material

The browser build emits 74 package notice entries. All carry licence text. Browser packages declare MIT or ISC. The native runtime, local Hermes source, personal profile avatars and model weights are installed independently. The bridge uses the native helper and protocol. No Hermes implementation or artwork was copied into the release. See [third-party notices](THIRD_PARTY_NOTICES.md) for the bundled permission texts.

- **Within dependencies.** Lucide credits Cole Bemis for Feather-derived portions. The supplement preserves the Feather MIT grant alongside Lucide’s shipped ISC notice. React DOM’s production client identifies Modernizr 3.0.0pre custom-build code under MIT. The Markdown parser’s `micromark-util-html-tag-name` explicitly sources two arrays of HTML tag names from section 4.6 of the CommonMark specification and notes version changes. The specification declares CC BY-SA 4.0. The package declares MIT for its implementation. The supplement attributes the source lists and describes the adaptation. **If a release requires every bundled element to be permissively licensed, resolve the status of those lists first** or substitute an independently implemented parser/data source with documented provenance. No broader MIT grant over specification material is asserted. [Supplement](public/licenses/browser-supplement.txt) · [CommonMark licence](https://github.com/commonmark/commonmark-spec/blob/0.30/LICENSE)
- **Build tools.** TypeScript ships a separate third-party notice file. Vite’s licence file includes its bundled dependencies’ terms. Both are retained in full in [direct package notices](licenses/direct-packages.txt). Build-time tools do not become Pocket-authored code.
- **Server image stack.** Sharp 0.35.5 is Apache-2.0. The installed Windows x64 native package declares Apache-2.0 AND LGPL-3.0-or-later. The installed WASM fallback also declares MIT. The Windows package includes the sharp native binding and two libvips DLLs, and reports libvips 8.18.7. Its licence file alone is insufficient to describe redistribution. The upstream package README additionally identifies MPL-1.1 for cairo, LGPL components, AOM patent terms, font and codec library terms and permissive notices. Its libimagequant entry points to a specific BSD-2-Clause fork. Do not infer the licence from the generic library name. The exact platform tables and version maps are preserved in [native package credits](licenses/sharp-native-upstream.txt).
- **Native distribution decision.** An installer can install dependencies directly from their upstream package distributions. If offering preinstalled binaries later, inventory the exact architecture and backend, retain notices and licence texts, document library replacement/relinking as applicable, and supply or arrange access to the corresponding source matching the shipped binaries as required. Verify codecs and patent terms separately. If that cannot be supported, keep the release source-only with locally fetched dependencies. Substituting another image codec requires a new audit. [Upstream binary builds and licensing](https://github.com/lovell/sharp-libvips) · [LGPLv3 terms](https://www.gnu.org/licenses/lgpl-3.0.html)

## Artwork, fonts and public captures

**Post-v1.0.0 README launch illustration.** The owner supplied the ChatGPT-created JPEG in `docs/pocket-launch.jpg`. Its phone mockups depict adaptations of the drop, cloud, hexagon and squircle designs defined in the Hermes Bot Mode renderer. The plugin directory carries a specific MIT licence, copyright (c) 2026 Nous Research. The illustration is reproduced as supplied. The credit appears directly below the banner and the full plugin notice accompanies the image. This documentation addition is subsequent to the v1.0.0 release archive. [Pinned avatar renderer](https://github.com/NousResearch/hermes-agent/blob/2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19/apps/desktop/src/plugins/hermes-bots/avatar.tsx) · [Pinned upstream licence](https://github.com/NousResearch/hermes-agent/blob/2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19/apps/desktop/src/plugins/hermes-bots/LICENSE) · [Included notice](licenses/hermes-bot-mode-MIT.txt)

| Asset | Origin and evidence | Release treatment |
|---|---|---|
| `public/pocket-companion.svg` | Codex authored the SVG for this project in the bot-picker revision after the owner requested a simpler Hermes/Grok-inspired character. The authoring session inspected local avatars and Hermes’ source SVGs. A first pointed-ear design was discarded. The accepted geometry consists of a dark rounded square, one original asymmetrical purple body path and four eye/pupil circles. No source path, raster, font or external reference is embedded. | Pocket MIT. Authored source SHA-256 `2213bc2158d72dca519245d5308a158a0480f38aed6f9cbba8c696e2336a9854`. No official affiliation or upstream trademark grant is claimed. |
| `pocket-192.png`, `pocket-512.png`, `pocket-maskable-512.png`, `apple-touch-icon.png`, `favicon.ico` | The local Pocket rendering script used Sharp to rasterise the SVG. The maskable export uses an opaque field and an inset character. The touch icon was flattened at 180 px. The ICO contains 16, 32 and 48 px PNGs. The source and all five checked-in outputs match the creation artifacts byte-for-byte. | Pocket MIT. No third-party graphical attribution for the character. |
| Interface glyphs | ArrowRight, Check, CircleHelp, Clock3, ImagePlus, Settings2, History, LockKeyhole, Menu, Mic, Moon, Plus, Search, Send, ShieldCheck, Sparkles, Sun and X from lucide-react. | Lucide ISC and applicable Feather MIT. |
| Fonts | System-provided fonts and CSS fallbacks only. No font files, external font requests or stock image assets are shipped. | No bundled font licence. |
| Documentation screenshots | Captured from the running Pocket UI in Chromium. The login page is empty. Chat, roster and composer use synthetic profiles, initials, a fictional conversation and an original solid-colour swatch. The additional README roster and settings captures use four original illustrations drawn for the demo (lantern, compass, seedling and book), fictional profiles and synthetic conversation text. The project MIT licence covers these captures and illustrations. | Project documentation under MIT, with the same upstream UI-icon credits as the app. |

The three unused legacy icon files from the import were excluded. The current launcher character is original to Pocket. The renderer and installer added no third-party packages or artwork. The app is independent and unofficial. The Grok Bot reference informed spacing and simplicity. No Grok branding, assets or code were identified.

## Release checks and remaining decisions

The non-root lock entries matched the audited private baseline, including integrity values. SHA-256 for this release lockfile is e3380dda9a0204615a2f5427ac2c857eb2ef4a768e5eb00c126ab2e5c76b46dc. Browser notices and supplement accompany the build. The release consists only of source that fetches upstream packages locally. Native-binary redistribution, an offline installer or a prebuilt container would require a separate review.

The parser credits CommonMark tag-list material separately under CC BY-SA 4.0 to the extent applicable. Retain the attribution, linked terms and upstream change description. The MIT notice covers original Pocket work. It does not relicense the third-party lists or Sharp’s native components. No replacement of the current Pocket icon is indicated. The private provenance record remains with the owner. The owner approved the public copyright attribution. The approved distribution is the source-only v1.0.0 release.
