# Stundenlauf-Auswertung – UI/UX Redesign Specification

## Purpose

This document defines the target frontend structure for the new React + TypeScript version of the Stundenlauf-Auswertung application.

The goal is to replace the organically grown legacy UI with a clearer, guided, scalable application interface suited for:

* non-technical users
* elderly users
* infrequent users
* fast seasonal administration workflows
* future feature growth

The application should feel calm, obvious, trustworthy, and task-oriented.

---

# 1. Core Design Principles

## 1.1 Prioritize clarity over density

Prefer:

* clear headings
* explicit labels
* visible next actions
* generous spacing
* larger click targets
* short explanations

Avoid:

* crowded control clusters
* hidden functionality
* unexplained abbreviations
* technical jargon

---

## 1.2 Task-first design

The UI should reflect what users want to do, not the internal backend structure.

Primary user tasks:

1. Open or create a season
2. View current standings
3. Import a new race
4. Resolve participant matches
5. Export results
6. Correct mistakes later
7. Review what happened

---

## 1.3 Guided workflows

Complex operations (especially import + matching) should guide users step by step.

The user should always know:

* where they are
* what they are seeing
* what to do next

---

## 1.4 Stable orientation

Use a persistent application shell with visible navigation on desktop.

Do not rely on hidden hamburger navigation as the default desktop experience.

---

# 2. Application Shell

```text
┌─────────────────────────────────────────────────────────────┐
│ Top Bar                                                    │
├──────────────────┬──────────────────────────────────────────┤
│ Sidebar          │ Main Content                            │
│                  │                                          │
│                  │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

---

# 3. Layout Regions

# 3.1 Top Bar

Persistent horizontal bar.

## Contents

Left:

* App title: **Stundenlauf-Auswertung**

Right:

* Current season selector dropdown
* Open review count badge (if applicable)
* Optional settings/help button

## Example

```text
Stundenlauf-Auswertung             Saison: Stundenlauf 2026 ▼   Offene Prüfungen: 2
```

## Behavior

* Season can be switched globally here
* Current season always visible
* Important unresolved tasks always visible

---

# 3.2 Sidebar

Visible by default on desktop.

Collapsible only as an optional action.

Width recommendation:

* expanded: 240–280 px
* collapsed: icon-only mode

---

# 3.3 Sidebar Structure

Split vertically into:

## Top: Bereiche

Main app sections and route switching.

## Bottom: Bereich-specific Controls

This block replaces the former "Next steps" area.
It should stay visible and use the remaining sidebar height for controls that belong to the active Bereich.
For `Auswertung`, this includes imported-run overview, category selectors, and export actions.

---

# 4. Navigation Sections

Use icon + label entries.

Recommended order:

1. Saison
2. Auswertung
3. Import
4. Korrekturen
5. Historie

---

# 5. Main Routing Model

```ts
type AppRoute =
  | "season"
  | "standings"
  | "import"
  | "corrections"
  | "history";
```

---

# 6. Global UI State

```ts
type UIState = {
  route: AppRoute;
  seasonId: string | null;
  sidebarCollapsed: boolean;
  unresolvedReviews: number;
};
```

---

# 7. Section Specifications

---

# 7.1 Saison

## Purpose

Manage seasons and explicitly switch/open one.

## User Needs

* create new season
* switch to another season
* import raw season backup
* export raw season backup
* delete/archive season

---

## Page Header

**Saison verwalten**

Helper text:

> Wählen Sie eine bestehende Saison aus oder legen Sie eine neue Saison an.

---

## Layout

Two-column desktop layout.

### Left: Existing Seasons

Table or list of seasons.

Columns:

* Name
* Events imported
* Last modified
* Actions

Actions:

* Öffnen
* Exportieren
* Löschen

### Right: Create New Season

Form:

* season name input

Primary button:

* Neue Saison erstellen

Secondary button:

* Saison importieren

---

## Important Note

Season switching exists both:

* globally in top bar
* explicitly on this page

---

# 7.2 Auswertung

## Purpose

View all standings and export official results.

---

## Page Header

**Aktuelle Wertung**

Helper text:

> Hier sehen Sie die aktuellen Wertungen der geöffneten Saison und können die Gesamtauswertung exportieren.

---

## Domain Structure

Each season contains standings across:

## Einzel

* 1/2 h Frauen
* 1/2 h Männer
* 1 h Frauen
* 1 h Männer

## Paare

* 1/2 h Frauen
* 1/2 h Männer
* 1/2 h Mix
* 1 h Frauen
* 1 h Männer
* 1 h Mix

---

## Recommended Selection UI

Three-level selector:

1. Wettbewerb: Einzel / Paare
2. Dauer: 1/2 h / 1 h
3. Kategorie: Frauen / Männer / Mix

Only valid combinations shown.

---

## Main Content

Standings table.

Columns may include:

* Platz
* Name
* Jahrgang
* Verein
* Gesamtdistanz
* Gesamtpunkte

---

## Table Behavior

* sticky header
* sortable columns
* zebra rows
* scroll within table area
* responsive width
* row hover state

---

## Bereich-specific Controls (Sidebar Bottom)

The sidebar bottom is now a control panel, not guidance text.

For `Auswertung` the control panel contains:

* Importierte Läufe matrix
* Einzel category buttons
* Paare category buttons
* Export actions (PDF / Excel)

---

## Export Rules

Export always refers to the full current season context.

Buttons should be explicit:

* Gesamtwertung als PDF exportieren
* Gesamtwertung als Excel exportieren

Helper note:

> Export enthält alle Wertungen der aktuellen Saison.

---

# 7.3 Import

## Purpose

Import a new event and resolve participant assignments safely.

---

# Import must be a guided wizard

Use a stepper.

---

## Stepper Stages

1. Datei auswählen
2. Erkannte Daten prüfen
3. Zuordnungen prüfen
4. Import abschließen

---

# Step 1 – Datei auswählen

## Inputs

* File picker
* Laufnummer selector
* Wettbewerb if required (Einzel / Paare)

## Main CTA

**Import prüfen**

---

# Step 2 – Erkannte Daten prüfen

Show what the file contains.

Examples:

* Lauf 2
* Einzel
* 43 Teilnehmer erkannt

Warnings if suspicious:

* Datei leer
* Falsches Format
* Laufnummer bereits vorhanden

## CTA

Weiter zu Zuordnungen

---

# Step 3 – Zuordnungen prüfen

This is the most important workflow screen.

---

# Review Screen UX Model

## Overall Structure

```text
[ Sticky Imported Record ]

[ Candidate 1 ]
[ Candidate 2 ]
[ Candidate 3 ]
[ Neue Person anlegen ]

[ Action Buttons ]
```

---

# Imported Record (Sticky Header)

Always visible during review.

## Example Content

* Neuer Eintrag
* Name
* Jahrgang
* Verein
* Startnummer
* Wertung

## Example

```text
Neuer Eintrag
Katharina Möller
Jahrgang: 1993
Verein: —
Startnr.: 40
Wertung: 7,041 km / 30 P
```

---

# Candidate Cards

Show up to 3 candidates at once.

Ranked by backend match quality.

Candidate 1 may have badge:

* Empfohlen

Candidate 1 should be preselected by default.

---

# Candidate Card Structure

Each card is selectable.

Top row:

* radio/select control
* candidate name
* optional badge

Below: field comparisons.

---

# Field Comparison Rules

## If field matches

Show compact line only:

```text
Name       ✅ gleich
```

```text
Jahrgang   ✅ gleich
```

---

## If field differs

Show mismatch clearly:

```text
Jahrgang   ❌ abweichend
Neuer Eintrag: 1993
Bestand:      1984
```

```text
Verein     ❌ abweichend
Neuer Eintrag: —
Bestand:      HSG Uni Greifswald Triathlon / Laufgruppe
```

---

# Important Rules

* Do not show full duplicated values for matching fields
* Only expand differing fields
* Keep cards compact
* Use both icon + text
* Selected card gets strong visual highlight

---

# New Person Option

Render as a full selectable card.

## Example

```text
( ) Neue Person anlegen

Die importierte Person wird als neuer Datensatz übernommen.
Es erfolgt keine Zusammenführung.
```

---

# Action Buttons

Bottom sticky action area.

If candidate selected:

Primary:

* Mit ausgewählter Person zusammenführen

Secondary:

* Zusammenführen und Namen korrigieren

If “Neue Person” selected:

Primary:

* Neue Person anlegen

---

# Progress Indicator

Always visible:

```text
Zuordnung 2 von 5
```

---

# After Action

After confirmation:

* automatically advance to next unresolved review
* keep progress updated

---

# Step 4 – Import abschließen

Summary page.

Show:

* imported entries
* merged entries
* new persons created
* corrections added
* warnings if any

Primary CTA:

* Import abschließen

Success message:

> Import erfolgreich abgeschlossen.

---

# Bereich-specific Controls During Import

Sidebar bottom may contain:

* Datei ändern
* Import abbrechen
* Matching-Hilfe
* Offene Prüfungen anzeigen

---

# 7.4 Korrekturen

## Purpose

Future correction workflows.

Placeholder for now, but page should already exist.

---

## Header

**Korrekturen**

Helper text:

> Hier können Namen, Zuordnungen und Wettkampfzuweisungen später nachträglich korrigiert werden.

---

## Future Planned Features

* Rename participant
* Correct typos
* Merge duplicates
* Move person between 1 h / 1/2 h
* Change event assignment
* Adjust club/team data

---

## Placeholder State

Friendly info card:

> Diese Funktionen folgen in einer späteren Version.

---

# 7.5 Historie

## Purpose

Read-only audit trail of what happened.

---

## Header

**Historie**

Helper text:

> Hier sehen Sie nachvollziehbar, welche Änderungen an der Saison vorgenommen wurden.

---

## Table Columns

* Datum / Uhrzeit
* Aktion
* Details
* Benutzer (optional)
* Rückgängig (future optional)

---

## Example Entries

* Lauf 2 importiert
* Person zusammengeführt
* Name korrigiert
* Saison exportiert

---

# 8. Notifications & Feedback

Use two layers of feedback.

---

## 8.1 Inline Messages

Near relevant actions.

Examples:

* Import erfolgreich abgeschlossen
* Datei konnte nicht gelesen werden
* 2 Zuordnungen müssen geprüft werden

---

## 8.2 Status Bar (optional)

Bottom passive messages:

* Bereit
* Export abgeschlossen
* Saison gewechselt

---

# 9. Accessibility & Elderly-Friendly UX

## Required Principles

* large click targets
* readable font sizes
* strong contrast
* clear labels
* no tiny icon-only controls
* forgiving spacing
* obvious primary buttons
* visible progress indicators

---

## Wording

Prefer plain German.

Use:

* Öffnen
* Prüfen
* Weiter
* Zusammenführen
* Neue Person anlegen

Avoid unexplained technical terms.

---

# 10. Visual Style Direction

## Tone

Calm, trustworthy, modern, administrative but friendly.

---

## Recommendations

* roomy spacing
* soft panel cards
* subtle borders
* restrained colors
* one strong accent color
* clear selected states
* warning color only when needed

---

# 11. Component Architecture

```text
AppShell
├── TopBar
├── Sidebar
│   ├── NavSection
│   └── BereichControlsSection
└── MainContent
    ├── SeasonPage
    ├── StandingsPage
    ├── ImportPage
    ├── CorrectionsPage
    └── HistoryPage
```

---

# 12. Suggested React File Structure

```text
src/
  app/
    AppShell.tsx

  pages/
    SeasonPage.tsx
    StandingsPage.tsx
    ImportPage.tsx
    CorrectionsPage.tsx
    HistoryPage.tsx

  components/
    layout/
    tables/
    forms/
    import/
    feedback/

  state/
    uiStore.ts
    api.ts
```

---

# 13. Implementation Priorities

## Phase 1

* App shell
* Navigation
* Season page
* Standings page
* Basic export actions

## Phase 2

* Full import wizard
* Matching review screen
* Progress flow

## Phase 3

* History page
* Correction placeholder

## Phase 4

* Real correction workflows
* Undo actions
* Power-user enhancements

---

# 14. Success Criteria

The redesign is successful if a non-technical user can:

1. Open the correct season
2. Understand where to click next
3. Import a race without fear
4. Resolve name matches confidently
5. Export results easily
6. Understand what happened afterwards

---

# 15. Final Product Vision

This should no longer feel like a script with controls.

It should feel like a focused desktop application for managing an annual race series confidently and efficiently.
