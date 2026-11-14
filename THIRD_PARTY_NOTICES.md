# Third-party notices

The README launch graphic depicts adaptations of the flat bot avatar designs from Hermes Bot Mode. Copyright (c) 2026 Nous Research. The owner supplied the ChatGPT-created composite. Pocket is an independent project. [Upstream avatar renderer](https://github.com/NousResearch/hermes-agent/blob/2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19/apps/desktop/src/plugins/hermes-bots/avatar.tsx) · [Full upstream MIT notice](licenses/hermes-bot-mode-MIT.txt)

Pocket Companion’s [MIT licence](LICENSE) covers the project’s original code and artwork. The named third-party components retain their upstream copyrights and licences. The [licence audit](LICENSE_AUDIT.md) identifies the reviewed versions, provenance and release restrictions.

| Material | Notices to retain |
|---|---|
| All nine direct runtime and nine development packages | [Installed package notices](licenses/direct-packages.txt). This file reproduces each package’s shipped licence text, grouping identical texts under all applicable package names. It includes TypeScript’s additional third-party notices and Vite’s bundled-dependency notices. Sharp credits Lovell Fuller and others, copyright 2013. |
| Browser dependencies, including transitive Markdown packages | [Versioned browser notice inventory](licenses/browser-packages.txt). Vite emits the current bundle’s full package texts at `licenses/browser-packages.md` in every production build. |
| Lucide and Feather icons, the Vite runtime helper, the Modernizr portion of React DOM, and CommonMark tag-list credits | [Browser supplement](public/licenses/browser-supplement.txt). This file is copied to `licenses/browser-supplement.txt` in the web build. Lucide’s package notice credits Lucide Contributors and Cole Bemis. Feather’s MIT grant and copyright notice are included. |
| Windows and WASM Sharp packages | [Platform-specific upstream licensing tables and library versions](licenses/sharp-native-upstream.txt). These are the package publishers’ notices. Keep the original upstream package files intact when installing. Consult the audit before distributing any native binary. |

Ship the two generated/copied browser notice files alongside the JavaScript and CSS. The source inventory records the audited baseline. Rebuild and review the notices whenever the lockfile or import graph changes. Retain third-party names and copyright lines in all notice copies.

Hermes Agent is a separately installed project from Nous Research. Its gateway and profile images are used locally. Pocket Companion is an independent, unofficial client. The app icon was drawn specifically for Pocket. No Grok Bot artwork is distributed.

[Lucide licensing](https://lucide.dev/license) · [Feather licensing](https://github.com/feathericons/feather/blob/v4.29.2/LICENSE) · [Sharp licensing and native builds](https://github.com/lovell/sharp-libvips) · [Hermes Agent licence](https://github.com/NousResearch/hermes-agent/blob/main/LICENSE)
