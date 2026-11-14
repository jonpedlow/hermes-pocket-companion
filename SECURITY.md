# Security

Pocket is a single-owner interface to a trusted local Hermes installation. A person with the Pocket password can use the connected bots under their existing Hermes permissions. Use a trusted OS account, source checkout and device. Restrict tailnet access to the owner.

## Access controls

- The server binds to IPv4 loopback and rejects unknown Host headers and browser origins. Configure exactly one additional private HTTPS origin if needed.
- Setup stores a salted scrypt verifier with a current-user Windows ACL outside the repository. Login is rate limited. A random 256-bit bearer token is kept in this browser origin’s local storage. The server keeps its digest in memory for up to seven days. Sign-out revokes the token and restarting the server ends all logins. An authenticated browser tab is a credential-bearing device.
- Profile and avatar endpoints require authentication. WebSocket upgrades check the origin, host, session token and selected profile. The server redeems a native single-use profile-bound Hermes ticket over loopback. Browser requests pass a chat-operation allowlist. Unsupported interactions are rejected. One-time approval and denial use Hermes’ security policy.
- Markdown is rendered without raw HTML. External image links need an explicit click. A restrictive content security policy applies.
- The bridge accepts bounded encoded PNG/JPEG bytes, checks their signatures, limits decoded pixels, strips metadata through JPEG re-encoding, then stages the image on the selected profile’s native socket. It validates the receipt directory and filename. An ambiguous delivery may leave a staging file in Hermes’ cache. Hermes owns admitted conversation data and its retention. There is no general file-upload or local file-download endpoint.
- The installer makes no automatic network exposure changes. Never send startup configuration, sessions, screenshots of private conversations or credentials in issue reports. Browser dictation may use a service supplied by the browser vendor.

Report security concerns privately to the maintainer. Use GitHub private vulnerability reporting once enabled.
