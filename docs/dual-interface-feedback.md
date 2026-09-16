# Classic + workspace, with shared feedback

Status: development branch only. Production `main` is unchanged. Feedback service deployment in PartsPilot remains pending; its public endpoint is intentionally unconfigured.

## Interface behavior

- `index.html`: redesigned workspace. On an ordinary visit with no preference, its early bootstrap routes to `classic.html`.
- `classic.html` + `styles-classic.css`: original interface, retaining the shared parser, carrier rules and email exporter.
- `experience.js`: shared preference, invitation and reversible switching. A fresh classic visitor can try the new look, keep classic, or snooze the invitation for seven days. Escape also snoozes. Keeping classic or explicitly switching records the choice, so the prompt is not repeated each visit.
- A visible button in both interfaces always provides the other look. Explicit `?ui=classic` and `?ui=workspace` links override the saved choice. A normal root visit follows the saved preference.
- Switching transfers the current quote, pasted input, selected carriers, sort, applicable controls and language through a one-time, per-tab sessionStorage record with a five-minute validity check. It is consumed immediately, not sent over the network and never triggers a fresh automatic clipboard copy. This is not a persistent save feature.
- If the browser cannot store the transfer and a quote is present, switching is blocked with a warning rather than silently losing data. The interface preference is browser-local, not an account setting.

`script.js`, `parser-core.js`, and the established email/PDF generation remain unchanged. Both interfaces keep the simplified paste hint and the email's “Estimated Transit time” label. Auto-parsing retains its existing behavior.

## Feedback behavior

Both existing feedback/report buttons call the same new `feedback.js` dialog. The old external Google Form action is intercepted; submissions are handled by the bounded private service. Form categories are bug, suggestion and other. Title and message are required; steps and reply email are optional. Quote ID is opt-in. Raw pasted data is not silently attached.

Responses display the receipt returned by the server only after a successful response. A timeout/failure retains form text; rate limits show a retry duration. An empty service endpoint disables submission and explicitly says nothing was sent.

See `feedback-service/README.md` for limits, deployment, private inbox access, security boundaries and testing limitations. Do not release an unconfigured Feedback button as a completed live feature.
