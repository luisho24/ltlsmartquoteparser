# Android Project Blueprint

## Goal

Define the technical structure for an internal Android version of Smart LTL Quote Parser using a native stack that is suitable for future overlay support.

## Recommended Stack

- Language: Kotlin
- UI: Jetpack Compose
- Architecture: MVVM
- Persistence: Room (optional, phase 2)
- JSON parsing: kotlinx.serialization or Moshi
- Background / overlay: Android Foreground Service + overlay permission in phase 2

## High-Level Modules

Recommended Gradle modules:

1. `app`
- Android application module
- navigation
- DI setup
- activities / services

2. `core:model`
- shared domain models
- quote data structures
- parsed result structures
- hazmat entities

3. `core:data`
- JSON asset loading
- repositories
- static config access

4. `core:parser`
- quote parser engine
- carrier normalization
- rules evaluator
- sorting helpers

5. `feature:parser`
- quote input screen
- parsed results screen
- clipboard actions

6. `feature:hazmat`
- local hazmat search UI

7. `feature:settings`
- theme, version, preferences

8. `feature:overlay` (phase 2)
- floating bubble
- compact parser surface
- service integration

## Suggested Package Structure

```text
com.luisho24.ltlsmartquoteparser
  app/
  core/
    model/
    data/
    parser/
  feature/
    parser/
    hazmat/
    settings/
    overlay/
```

## Shared Data Files

Bundle these as app assets so Android and web can share the same source-of-truth structure over time.

Suggested files:

- `rules.json`
- `filters.json`
- `carrier-aliases.json`
- `hazmat.json`
- `app-version.json`

## Core Domain Models

### QuoteInput
- rawText: String

### ParsedQuote
- id: String
- from: String
- to: String
- items: List<Item>
- accessorials: List<String>
- rawRates: List<Rate>

### Rate
- carrier: String
- normalizedName: String
- rateType: String
- cost: Double
- quoteNumber: String
- liability: String
- service: String
- transitDays: String
- warnings: List<String>
- infos: List<String>
- isAllowed: Boolean

### FilterState
- destinationType
- commodityType
- insurance
- splitRates
- sortMode
- checkLiftgate
- checkCubic

## Screens for MVP

### 1. Home / Parser Screen

Contains:

- quote input area
- paste from clipboard action
- parse button
- clear button
- quick settings row

### 2. Results Screen / Results Panel

Contains:

- quote summary card
- rate list
- sort controls
- split LTL / Volume toggle
- copy/share actions

### 3. Hazmat Screen

Contains:

- search bar
- local results list

### 4. Settings Screen

Contains:

- light / dark mode
- color theme preset
- app version
- future overlay toggle placeholder

## Overlay Phase (Phase 2 / 3)

### Components

1. Foreground service
2. Draggable floating bubble
3. Compact parser sheet
4. Permission onboarding screen

### Notes

- Requires `SYSTEM_ALERT_WINDOW`
- Should not be part of the first functional parser release
- Build after parser parity is stable

## Parser Strategy

Recommended:

- Rewrite the parser in Kotlin
- Keep rules / aliases / hazmat as JSON assets

Why:

- cleaner Android integration
- easier testing
- no embedded JS engine complexity
- easier overlay support later

## Test Strategy

### Unit tests
- carrier normalization
- transit-day parsing
- accessorial parsing
- rule application

### Fixture tests
- real Priority1 quote samples
- LTL-only quote
- LTL + Volume quote
- advanced quote with internal cost / margin
- overlength / excessive length quote
- hazmat-heavy quote

### UI tests
- paste from clipboard
- parse action
- sorting changes
- split rates toggle

## Delivery Recommendation

### Milestone A
- parser engine
- parser UI
- copy/share
- hazmat lookup

### Milestone B
- settings polish
- versioning
- local history if needed

### Milestone C
- floating overlay service

## Next Build Step

The most effective next implementation step is:

1. extract the current web rules / aliases / hazmat data into JSON
2. define Android models around that structure
3. create parser fixture tests before UI implementation
