---
name: PocketPrune
description: Compress small open LLMs to GGUF and see what each level costs, one clear pipeline at a time.
colors:
  primary: '#2F5DE1'
  primary-text: '#FFFFFF'
  primary-hover: '#2448B8'
  primary-soft: '#EAF0FD'
  background: '#F7F8FA'
  surface: '#FFFFFF'
  border: '#E3E6EB'
  border-strong: '#C9CFD8'
  text: '#1B1F24'
  text-muted: '#5F6B7A'
  ladder-baseline: '#8A94A6'
  success: '#1E9E5A'
  success-text: '#13703F'
  success-soft: '#E7F5EE'
  warning: '#C98A00'
  warning-text: '#7A5300'
  warning-soft: '#FBF3E0'
  danger: '#D2393C'
  danger-text: '#A82A2D'
  danger-soft: '#FCEBEB'
typography:
  headline:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: '24px'
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '-0.01em'
  title:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: '18px'
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: '13px'
    fontWeight: 600
    lineHeight: 1.5
rounded:
  sm: '6px'
  md: '10px'
  lg: '16px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '32px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-text}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '0 16px'
    height: '42px'
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.md}'
    padding: '0 16px'
    height: '42px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.text-muted}'
    rounded: '{rounded.md}'
    padding: '0 16px'
    height: '42px'
  button-danger:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.danger-text}'
    rounded: '{rounded.md}'
    padding: '0 16px'
    height: '42px'
  card:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.lg}'
    padding: '20px'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.md}'
    padding: '0 12px'
    height: '42px'
  choice-selected:
    backgroundColor: '{colors.primary-soft}'
    textColor: '{colors.text}'
    rounded: '{rounded.md}'
    padding: '12px 14px'
  badge-success:
    backgroundColor: '{colors.success-soft}'
    textColor: '{colors.success-text}'
    rounded: '999px'
    padding: '2px 8px'
  badge-info:
    backgroundColor: '{colors.primary-soft}'
    textColor: '{colors.primary-hover}'
    rounded: '999px'
    padding: '2px 8px'
---

# Design System: PocketPrune

## Overview

**Creative North Star: "The Job Is the Journey"**

PocketPrune is a calm, light working tool. A cool off-white page holds white cards with thin grey borders, and one blue does all the pointing: the step you are on, the thing you picked, the button that moves you forward. Everything else is grey text on white. Every job screen sits under a five-step pipeline rail (Model, Device, Preflight, Run, Results), so you always know where you are in the compression job. It is not a sidebar dashboard.

The tokens live in one file, `frontend/src/theme/theme.js`, which a future React Native app copies unchanged. `applyTheme.js` turns them into CSS variables (`--color-*`, `--font-*`, `--space-*`, `--radius-*`). That is why the system is deliberately plain: no blur, no complex gradients, no information shown only on hover, minimal motion. Anything that would not port to a phone app does not belong here. Base palette, type sizes, spacing and radii are fixed by CLAUDE.md §9; the extra shades exist only to pass contrast.

The one picture with personality is the compression ladder: grey baseline bar for F16, blue bars for the quantized levels, so you can see how much each level shrinks a model.

**Key Characteristics:**

- One accent (blue), used for current step, selection and the primary action only.
- Flat white cards on a cool grey page; 1px borders do the separating.
- Four type sizes (13/15/18/24), two weights (400/600), Inter only.
- Persistent pipeline rail plus a 340px "Your job" summary.
- Built to port: everything is a token, stacked cards, no hover-only content.

## Colors

A cool, quiet neutral base with a single confident blue and status colours used only to mean status.

### Primary

- **Pipeline Blue** (primary): current step dot, connector lines into reached steps, selected card outline, primary buttons, links, focus rings, quantized ladder bars.
- **Pressed Blue** (primary-hover): primary button hover, and text on pale-blue backgrounds (info badge, selected level size) where plain blue would be too light.
- **Selection Wash** (primary-soft): background of a selected choice card, active top-nav link, info alerts, text selection.

### Neutral

- **Cool Paper** (background): the page ground; also the hover fill for ghost buttons and nav links.
- **White Card** (surface): cards, top bar, stepper, inputs.
- **Hairline Grey** (border): card borders, dividers in the summary and checklist, idle connector lines, progress track.
- **Edge Grey** (border-strong): input borders, secondary buttons, inactive step circles, unchecked choice cards, empty-state dashed outline.
- **Ink** (text): headings and body text.
- **Slate** (text-muted): descriptions, labels in key/value lists, hints, inactive step labels.
- **Baseline Grey** (ladder-baseline): only the F16 bar in the compression ladder (and queued/cancelled status).

### Status

- **Success / Warning / Danger** (success, warning, danger): the saturated colour is for borders, icons and status dots. Small text on a pale `*-soft` background always uses the darker `*-text` shade (success-text, warning-text, danger-text) so it stays readable (WCAG AA).

### Named Rules

**The One Blue Rule.** Blue means "here, chosen, or go". Never use it for decoration, headings or big fills.

**The Green Means Done Rule.** Green appears only for success (completed, quick-to-demo, passed checks). It is never a second accent.

**The Soft-Pair Rule.** Every pale `*-soft` background is paired with its dark `*-text` shade, never with the bright status colour.

## Typography

**Font:** Inter (Inter Variable, then system-ui, sans-serif). One family for everything.

**Character:** Neutral and very readable, also on a projector. Hierarchy comes from size and the jump from 400 to 600, nothing else.

### Hierarchy

- **Headline** (600, 24px, 1.25, -0.01em, balanced wrap): one page title per screen (`h1`).
- **Title** (600, 18px, 1.3): card titles, section titles, summary heading, brand name (`h2`).
- **Body** (400, 15px, 1.5): default text, buttons (at 600), page descriptions capped near 68ch.
- **Label** (600 or 400, 13px): field labels, ladder levels and values, meta rows, hints, small buttons.

### Named Rules

**The Two Weights Rule.** Only 400 and 600. Emphasis is 600; muted is colour, not a lighter weight.

**The Numbers Line Up Rule.** Sizes, counts and inputs use tabular figures (`.num`, inputs) so columns of MB values align.

## Layout

- **Frame:** 60px white top bar (brand left; History, Downloads, Help right), content max-width 1280px with 32px side padding, 24px top padding.
- **Pipeline rail:** a full-width card under the top bar on job pages. Five numbered 32px circles joined by 2px lines. A step shows a tick only when it is really finished (model chosen, device chosen), not just because it comes earlier. A connector turns blue only when it leads into a step already reached.
- **Workspace:** two columns, step content left and a sticky 340px "Your job" summary right, 24px gap.
- **Grids:** model cards fill columns of at least 300px, profile cards at least 260px, choice cards at least 150px, all with 16px (choice: 8px) gaps.
- **Spacing rhythm:** 4/8/16/24/32. Sections are 24px apart, items inside a card 16px.
- **Under 960px:** one column; the summary drops below the content and its next-step button becomes a fixed white bar at the bottom of the screen (with a top hairline), page gets 96px bottom padding so nothing hides under it.
- **Under 720px:** side padding drops to 16px, top-nav keeps icons only, the rail shows only the current step's name (others show their number, circles 28px), page header stacks, and every card grid and form grid collapses to one column.

### Named Rules

**The Always Know Where You Are Rule.** Every job screen shows the pipeline rail and the job summary. The next-step button is always reachable, on phones as a fixed bottom bar.

## Elevation & Depth

Flat. Depth comes from white cards on a grey page plus 1px borders. Cards carry only a barely visible hairline shadow; selection is shown with a blue outline, never a lift.

### Shadow Vocabulary

- **Card hairline** (`box-shadow: 0 1px 2px rgba(27, 31, 36, 0.04)`): resting cards.
- **Selection ring** (`box-shadow: 0 0 0 1px var(--color-primary)`): with a blue border, makes a 2px selection outline on selected cards and checked choices.

### Named Rules

**The No-Lift Rule.** Nothing floats. No blur, no large shadows, no glass, no gradients. These do not port to the app.

## Shapes

Gently rounded and consistent: cards and the rail use 16px (lg); buttons, inputs, choice cards, alerts and nav links use 10px (md); badges are full pills; step dots are circles; bars are 10px tall with 5px fully round ends. Borders are 1px solid, except the empty state, which uses a 1px dashed edge-grey border to read as "nothing here yet".

## Components

### Buttons

Solid and plain, never decorated.

- **Shape:** 10px radius, 42px tall (34px small), 600 weight, optional 18px lucide icon left.
- **Primary:** blue fill, white text; hover darkens to pressed blue. One per view, the step's forward action ("Next: check device").
- **Secondary:** white, edge-grey border, ink text; hover turns border and text blue. Used for "Select" on cards.
- **Ghost:** transparent, slate text; hover gets cool-paper fill.
- **Danger:** white, edge-grey border, danger-text; hover gets danger border and pale-red fill.
- **Disabled:** 55% opacity, not-allowed cursor. Loading swaps the icon for a spinning loader.
- **Focus:** 2px blue outline, 2px offset (global).

### Badges

- Pills, label-size text at 600, 2px by 8px padding, optional 13px icon.
- Tones: neutral (cool paper with hairline ring), info (blue wash / pressed blue), success, warning, danger (soft background / dark text). Job status maps to tones: queued and cancelled neutral, any running stage info, completed success, failed danger.

### Cards / Containers

- **Corner Style:** 16px.
- **Background:** white on the cool-paper page.
- **Border:** 1px hairline grey; selected cards swap to a 2px blue outline.
- **Internal Padding:** 20px; content stacked with 16px gaps; actions pinned to the card's bottom.

### Choice cards (radio cards)

For preferences and quantization levels. Edge-grey border, 10px radius, 12px by 14px padding, title at 600 with size on the right. Checked: blue border plus ring, blue-wash fill, size in pressed blue. The real radio is visually hidden; keyboard focus draws the blue outline on the card.

### Inputs / Fields

- **Style:** 42px tall, white, 1px edge-grey border, 10px radius, tabular figures. Label above at 13px/600 with an optional muted unit; hint below at 13px muted.
- **Focus:** border and 2px outline turn blue.
- **Error:** danger border, message in danger-text.

### Navigation

Top bar links: 18px icon plus 15px text, slate; hover ink on cool paper; active link blue text at 600 on blue wash. Under 720px only the icons remain (each keeps its aria-label).

### Pipeline rail (StageStepper)

Numbered circles: todo is an edge-grey ring with slate number; done is a blue ring with a blue tick; current is a filled blue circle with a white number and the label in ink at 600. Steps with a page are links. Also used later for job progress stages.

### "Your job" summary

A card with the title, then key/value rows (72px muted label column, 600 value, optional muted sub-line) divided by hairlines, the job's compression ladder, and the full-width primary next-step button.

### Compression ladder (signature)

A three-column grid: level name (13px/600, optional muted hint), a 10px rounded bar, and the size right-aligned in tabular figures. F16 is the baseline-grey bar; Q5_K_M and Q4_K_M are blue. Bar length is proportional to file size. Before a job runs, sizes are estimates and carry a "≈" prefix; measured sizes drop it. In the catalog every card shares one scale (the largest F16 in the list), so bigger models really look bigger. A tiny file still gets a 3px bar. Bar width eases in over 0.5s.

### Progress bar

10px pill track in hairline grey with a blue fill, value at 600 on the right. Fill width eases over 0.4s.

### Alerts, empty and loading states

Alerts: 10px radius, 16px padding, soft background (danger or blue wash), 20px icon, bold title, 13px hint. Empty state: centred, dashed border, 28px muted icon, short description, one action. Loader: spinner plus muted text.

### Named Rules

**The Honest Tick Rule.** A tick, a blue connector or a green badge is only shown for something that is actually true.

**The Shared Scale Rule.** Ladders that sit side by side use one scale, or the comparison lies.

## Do's and Don'ts

### Do:

- **Do** take every colour, size, space and radius from `theme.js` through its CSS variables; never hard-code a hex in a component.
- **Do** keep blue for the current step, the selection and the single primary action.
- **Do** pair every `*-soft` background with its `*-text` colour.
- **Do** put the compression ladder wherever a model's sizes are shown, F16 grey, quantized blue, "≈" when estimated.
- **Do** make every grid collapse to one column under 720px and keep the next-step button reachable as a fixed bottom bar under 960px.
- **Do** keep motion to short ease-outs on bar widths and button colours, and respect reduced motion.
- **Do** use lucide line icons at 18px in buttons and nav, always next to a text label or an aria-label.

### Don't:

- **Don't** use blur, glass, complex gradients or large shadows; they do not port to React Native.
- **Don't** put information only in a hover state or tooltip; phones have no hover.
- **Don't** add a third font weight, a second font family, or new type sizes.
- **Don't** use green or blue as decoration; they carry meaning (done, here/go).
- **Don't** mark a step done, or colour its connector blue, before it is really reached.
- **Don't** replace the pipeline rail with a sidebar dashboard layout.
