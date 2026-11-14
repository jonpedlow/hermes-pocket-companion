# Pocket Companion v1.0.0

14 November 2026

Pocket Companion brings a self-hosted Hermes bot roster and streaming conversations to a mobile browser. The image-first release accepts PNG and JPEG. It includes a Windows installer, a Hermes-assisted setup guide, a standalone PWA manifest and a black sign-in screen.

| Capability | Evidence and limits |
|---|---|
| Windows guided setup | Tested from a fresh local checkout with npm ci, an independent loopback port and a separate per-user scheduled task. The installer connected to the existing Hermes v0.23.0 gateway before startup. Both task start and restart were exercised. A Windows reboot was not part of this check. |
| Authentication | Incorrect password, successful sign-in, refresh persistence, sign-out, protected profile access and an invalidated session were checked. Restarting the server discards its session map. |
| Chat | Prior private Windows/Android checks established bot switching, real streamed replies and restored history. Pocket attached to a real profile. A native clarification or interrupt UI and simultaneous Desktop handoff are outside the verified feature set. |
| Images | Earlier real-profile tests identified the contents of one PNG and one JPEG. The transfer route is retained. WebP rejection is checked in the browser and server decoder. Documents and generated file downloads are unavailable. |
| Rich Chat | Browser checks covered tables, incremental rendering, code and message copy. Markdown rendering and HTML restrictions also have automated tests. |
| Dictation | Implemented with the browser speech-recognition API. End-to-end microphone transcription is unverified. Availability depends on device, browser, permissions and speech service. |
| Installation on devices | Manifest parsed successfully, Chromium reported zero installability errors, and the installed app launched in an isolated desktop Chromium profile. Android-sized screenshots are real UI captures. The owner confirmed Windows desktop use, Android phone use and successful Android home-screen installation. Physical iOS installation is unverified. |
| Other host platforms | Windows is the verified host. Linux and macOS installation are unverified. |

## Install

Download the source ZIP from the release assets, extract it into a permanent folder and run **Setup Pocket.cmd** on Windows with Hermes running and Node.js 22.12 or newer installed. Enter your Pocket password locally.

[Windows and phone setup](https://github.com/jonpedlow/hermes-pocket-companion/blob/v1.0.0/INSTALL.md) · [Hermes-assisted setup](https://github.com/jonpedlow/hermes-pocket-companion/blob/v1.0.0/HERMES-INSTALL.md) · [Third-party notices](https://github.com/jonpedlow/hermes-pocket-companion/blob/v1.0.0/THIRD_PARTY_NOTICES.md)

This source-only release licenses original Pocket work under MIT. Dependencies retain their upstream terms.
