# Smart LTL Quote Parser

Web tool for reviewing Priority1 LTL quotes, comparing carriers, and exporting quote options.

## Features

- Parses Priority1 quote exports and freeform quote text
- Shows LTL and Volume rates with carrier logos
- Optional split view for `LTL` vs `Volume`
- Rule checks for destination type, commodity, liftgate, and cubic/overlength
- Email-friendly export and preview
- Hazmat / NMFC quick search

## Local preview

Open the published site or run locally:

```bash
node serve-local.js
```

Then open:

```text
http://127.0.0.1:5500/index.html
```

## Files

- `index.html`: main UI markup
- `styles.css`: app styles
- `script.js`: parser, rules, rendering, exports
- `logos/`: local carrier logos used by the UI

## Notes

- Carrier logos are served from the local `logos/` folder in this repository.
- The insurance field is intended for the insurance premium, not declared value.
