# Contributing

Thanks for helping make a friendlier mobile companion for Hermes Agent.

1. Keep the interface original. Do not contribute proprietary assets, copied layouts, or scraped code from other AI products.
2. Never include gateway tickets, API keys, bearer tokens, private chat history, real client files or credentials in issues, tests, screenshots or commits.
3. Run `npm run test` and `npm run build` before submitting a pull request.
4. For gateway protocol changes, link the upstream Hermes documentation or implementation and state which Hermes version was actually tested.
5. Preserve fail-closed approvals, browser-side credential isolation and the loopback-only bridge by default.
6. Describe visual behavior on Android narrow viewports as well as desktop.

We welcome fixes to Hermes session interoperability, profile image support, accessibility and responsive layout. New integrations should be optional and permission-scoped.
