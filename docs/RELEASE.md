# v1.0.0 release review

## Proposed release

Pocket Companion brings a self-hosted Hermes bot roster and streaming conversations to a mobile browser. The image-first release accepts PNG and JPEG. It includes a Windows installer, a Hermes-assisted setup guide, a standalone PWA manifest and a black sign-in screen.

| Capability | Evidence and limits |
|---|---|
| Windows guided setup | Tested from a fresh local checkout with npm ci, an independent loopback port and a separate per-user scheduled task. The installer connected to the existing Hermes v0.23.0 gateway before startup. Both task start and restart were exercised. A Windows reboot was not part of this check. |
| Authentication | Incorrect password, successful sign-in, refresh persistence, sign-out, protected profile access and an invalidated session were checked. Restarting the server discards its session map. |
| Chat | Prior private Windows/Android checks established bot switching, real streamed replies and restored history. The candidate attached to a real profile. A native clarification or interrupt UI and simultaneous Desktop handoff are outside the verified feature set. |
| Images | Earlier real-profile tests identified the contents of one PNG and one JPEG. The transfer route is retained. WebP rejection is checked in the browser and server decoder. Documents and generated file downloads are unavailable. |
| Rich Chat | Browser checks covered tables, incremental rendering, code and message copy. Markdown rendering and HTML restrictions also have automated tests. |
| Dictation | Implemented with the browser speech-recognition API. Actual microphone recognition depends on device, browser, permissions and speech service. |
| Installation on devices | Manifest parsed successfully, Chromium reported zero installability errors, and the installed app launched in an isolated desktop Chromium profile. Android-sized screenshots are real UI captures. Physical Android and iOS home-screen installation of this candidate remains unverified. |
| Other host platforms | Windows is the verified host. Linux and macOS installation are unverified. |

## Publication checklist for the maintainer

1. Retain the approved public credit to Jon Pedlow and Hermes Pocket Companion contributors. Review LICENSE_AUDIT.md, LICENSE and THIRD_PARTY_NOTICES.md. The MIT grant applies to original Pocket work. Use a source-only release.
2. Review final public screenshots, the single-root source repository and the final verification report. Keep private development history, personal avatars, environment settings and build outputs out of the public project.
3. After owner approval, set the final package version to 1.0.0 in the manifest and lockfile. Update CHANGELOG.md. Run npm ci, npm test, npm run build, npm audit and redacted working-tree and history secret scans on that final commit. Include both browser licence files if distributing a browser build.
4. Create an empty GitHub repository for the approved project. Check that the local checkout is the reviewed public-source repository and inspect git remote -v and git log --oneline --all. Add the approved repository URL as its remote and push only the reviewed main branch. Enable private security reporting.
5. Tag the approved release commit v1.0.0, push that tag and create a GitHub release from it. Link README.md, INSTALL.md and HERMES-INSTALL.md in the release description. Offer the source archive. Do not attach node_modules, credential files, a personal installer state or a native-binary bundle.
