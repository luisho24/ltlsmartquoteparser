# Professional quote workspace

Branch: `design/professional-workspace`
Based on: `49a6c7132ddeee04a0b834609d12e7d0a0e21ccc`

## Design

A compact application header replaces the gradient hero. A neutral, lightly tinted canvas, restrained green accent, system typography, and thin borders keep attention on shipment details and carrier prices. There are no new font, icon-library, or framework dependencies.

The quote input sits beside the shipment summary and carrier comparison. Email appearance, language, color mode, accent themes, and advanced settings remain available without dominating the workspace. The carrier table keeps prices, liability, service, and transit together; the lowest-rate annotation is derived from the allowed rates, not a carrier recommendation.

On smaller screens the input and results stack. The comparison scrolls horizontally, with the carrier column pinned on phone-sized screens. Keyboard focus indicators, reduced-motion support, labeled selection controls, dialog focus return, Escape dismissal, and Ctrl/Command+Enter analysis are included.

## Implementation boundaries

- `index.html`: reorganized semantic shell, preserving all 139 pre-existing element IDs and their handlers.
- `styles.css`: replacement workspace styles, including all existing color accents and light/dark modes.
- `workspace-ui.js`: presentation adapter loaded after `script.js` and before `initApp()`. Its explicit post-render hooks decorate the legacy views without changing the parser or quote export implementation.
- `verify-workspace.js`: dependency-free structural and export regression checks.

`script.js`, `parser-core.js`, carrier rules, Android code, and the existing email template remain unchanged. The email heading remains **Estimated Transit time** in English and **Tiempo de tránsito estimado** in Spanish. PDF report HTML retains its previous label.

Two existing presentation edge cases are handled in the adapter: hidden batch comparisons no longer hide the export controls or prevent newly added quotes from being processed, and a spare internal-cost placeholder cell is removed when its corresponding header is absent. Empty selections disable the two main email actions.

## Verification

Run from the repository root:

```sh
node --check workspace-ui.js
node verify-roundtrip.js
node verify-workspace.js
```

The workspace verifier checks unique control IDs and compares 264 report outputs before and after the presentation adapter: two languages, eleven themes, email/PDF HTML, three layouts, and internal columns on/off. Excluded carriers must remain excluded.

Browser checks were also performed in headless Chromium using inlined copies of the repository assets. These covered real quote rates/transit, sorting, individual and all-carrier selection, email preview, clipboard payloads, Spanish, dark mode, experimental controls, batch layout, hidden-table processing, internal-column alignment, reference search, keyboard interaction, and document overflow at 390, 768, 1024, and 1480 pixels. Clipboard writing was captured in a test stub; no email was sent. External resources were not required for these UI checks.

The quote supplied for visual review and its screenshots are not committed to the public repository. Browser screenshots are previews of this branch, not a production deployment. GitHub Pages configuration and `main` are unchanged.
