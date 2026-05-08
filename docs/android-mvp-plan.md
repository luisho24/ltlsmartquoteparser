# Android MVP Plan

## Goal

Build an internal Android APK for the Smart LTL Quote Parser that is fast to distribute, works offline, and can later support a floating overlay above other apps.

This document defines:

- the first Android release scope
- what is intentionally excluded from the first APK
- the recommended delivery order

## Product Goal

The first APK should let an internal user:

- open the app
- paste or import quote text from Priority1
- parse the quote reliably
- review rates and restrictions
- copy/share the results quickly

The MVP should optimize for operational speed and reliability over feature completeness.

## MVP Scope

### Included in MVP v1

1. App shell
- Native Android app
- Internal APK distribution only
- Dark mode support
- Offline-capable core experience

2. Quote input
- Paste quote text manually
- Paste from clipboard button
- Clear input button
- Parse action

3. Parser output
- Quote header details
  - Quote ID
  - Origin
  - Destination
  - Items
  - Accessorials
- Parsed rate list
  - Carrier name
  - Rate
  - Liability
  - Transit days
  - Service
  - LTL / Volume chip

4. Rule checks
- Destination filters
  - Standard
  - Amazon
  - Walmart
- Commodity filters
  - General / FAK
  - Tobacco
  - Alcohol
  - Vape
  - Firearms
- Liftgate check
- Cubic / overlength check

5. Result actions
- Sort by cheapest
- Sort by fastest
- Split LTL / Volume toggle
- Copy results to clipboard
- Share text using Android share sheet

6. Hazmat quick search
- Local bundled hazmat / UN dataset
- Search by UN number, class, description, or NMFC

7. Settings
- Theme mode
- App color theme
- Paste Anywhere / Quick Capture preference placeholder
- Version display

### Explicitly excluded from MVP v1

1. Floating overlay bubble
- This should be phase 2 after the parser parity is proven

2. Pixel-perfect HTML email preview
- Keep Android exports text-first in v1

3. PDF generation
- Not needed for initial internal release

4. Advanced branding editor
- Leave for later after the Android base is stable

5. Feedback form integration
- Optional in v1
- Can be added after parser reliability is verified

6. Automatic live-user counting / telemetry
- Not required for initial APK

## User Flows

### Primary flow

1. Open app
2. Paste quote from clipboard
3. Tap Parse
4. Review sorted results
5. Copy or share selected output

### Secondary flow

1. Open app
2. Search Hazmat / UN number
3. Return to parser

## Success Criteria for MVP

The first APK is successful if it:

- parses real Priority1 quotes with parity to the web tool
- correctly reads transit days, service names, and liability
- applies carrier restriction rules consistently
- works offline after install
- feels fast on everyday Android phones

## Delivery Phases

### Phase 1
- Shared data extraction from web tool
- Android parser engine scaffold
- UI shell and quote parsing screen

### Phase 2
- Hazmat search and result actions
- Theme support and settings
- Internal QA with real quotes

### Phase 3
- Floating overlay bubble
- Foreground service
- Quick parser compact panel

## Risks

1. Parser parity drift between web and Android
- Mitigation: use shared JSON data and test fixtures

2. Overlay complexity
- Mitigation: delay to phase 3

3. Internal APK installation friction
- Mitigation: signed release APK + short install guide

## Recommendation

Build the Android app in two practical milestones:

1. `Parser-first APK`
- no overlay
- fast delivery
- validates business value

2. `Overlay-enabled APK`
- adds floating quick-capture UX later
