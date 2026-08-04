# Example — Redesign of "Executive Performance — Monthly Results"

## Context

A sales leadership team views this dashboard daily in a dim executive boardroom on a large wall display. The current report uses a light theme that feels washed out in the dark room and lacks visual depth. The goal is to convert it to a **Dark Premium — Performance Cyan** theme that feels immersive, premium, and depth-aware.

## Current-state diagnosis

### Critical

- The page background (`#FFFFFF`) causes glare in the dim boardroom, reducing readability.
- All visuals share the same white background — there is no surface hierarchy or depth.
- KPI cards are flat with no elevation, making them blend into the surrounding charts.
- Gridlines are dark gray on white, which inverts contrast expectations for a dark-room display.

### High

- The revenue trend chart uses default Power BI blue (`#118DFF`) with no gradient fill, looking generic.
- The donut chart uses 8 unrelated colors from the default palette — no monochromatic progression.
- The target indicator is a basic gauge with a thick arc, consuming too much space for a single KPI.
- Slicers float without alignment to the header region.

### Medium

- Chart titles repeat field names ("Sum of Revenue") instead of providing analytical context.
- Seller names are truncated in the donut chart legend.
- The page lacks a navigation mechanism — users switch pages via the bottom tabs, which are hard to see in the dark room.

## Proposed direction

**Theme Mode:** Dark Premium (Performance Cyan Dark).

**Tone:** executive premium dark — immersive, cinematic, depth-aware.

**Signature:** cyan-first with elevation hierarchy. Cyan drives attention to KPIs and positive trends. Muted pink signals underperformance. The page uses 4 surface levels to create depth: canvas → containers → cards → elevated KPI cards.

**10-second narrative:** "Revenue is trending above target for the year. The top 3 sellers drive 60% of results. One region is below 90% of goal and needs immediate attention."

## Wireframe

```text
┌───┬──────────────────────────────────────────────────────────────────────────┐
│ N │ Executive Performance                    Gerente [Felipe]  Ano [2026]      │
│ A ├──────────┬──────────┬──────────┬─────────────────────────────────────────┤
│ V │ Receita  │ Margem   │ Cresc.   │         Revenue Monthly Trend            │
│   │ R$ 4.2M  │  32.8%   │ +12% vs  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│ B │ ⊹ glow   │          │   LY     │  ░░cyan gradient area fill░░░░░░░░░░░░  │
│ A ├──────────┴──────────┴──────────┼────────────────────┬────────────────────┤
│ R │                                │ Resultado Mensal   │ Sellers            │
│   │     Monthly Result Trend       │ ░░░░░░░░░░░░░░░░░░ │   ╭──╮            │
│   │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ cyan gradient area │  ╱    ╲ colors    │
│   │  ░░cyan gradient area fill░░░░ │ highlighted max/min│ ╱ cyan ▸╲          │
│   │                                │                    │ ╲teal   ╱         │
│   │                                ├────────────────────┤  ╰────╯          │
│   │                                │    92%             │                  │
│   │                                │ ████████████░░░░░░ │ Target Indicator │
│   │                                │       Meta 100%    │                  │
└───┴────────────────────────────────┴────────────────────┴──────────────────┘
```

## Changes by visual

### Page background

- Change from `#FFFFFF` to `#1A1E2B` (canvas).
- This immediately reduces glare and sets the dark premium foundation.

### Navigation rail (NEW)

- Add a 60 px vertical rail on the left edge (`#161A24` background).
- 4 icon buttons for page switching (Home, Performance, Details, Settings).
- Idle icons: `#6B7A8D`. Active icon: `#F3F6F8` inside a rounded `#252D3A` container.
- Construct with rectangle shape + text boxes using Segoe UI MDL2 icon glyphs.

### Header

- Convert title to `#F3F6F8`, 30 px Semibold.
- Add subtitle below: "Monthly Results — 2026" in `#9EA8B3`, 13 px Regular.
- Slicers (Manager, Year): dark background `#212836`, 1 px `#3A4858` border, white selected values, compact 32 px height, aligned right.

### KPI cards (3 cards, left row)

Each card receives the dark premium KPI treatment:
- Background: `surface-elevated` (`#2A3342`).
- Border: 1 px `#3A4858`, radius 16 px.
- Shadow: Heavy preset (Offset 6, Blur 12, Black 45%).
- Glow simulation: border color changes to `accent-primary` (`#00BCD0`) at 40% opacity.
- KPI value: 28–32 px Semibold, cyan (`#00BCD0`).
- KPI label: 11 px Regular, `#9EA8B3`.
- Delta: small text in `positive` (`#42B894`) or `negative` (`#BD6079`).

### Revenue trend chart (upper-center)

- Line color: cyan (`#00BCD0`), 2 px width.
- Area fill: cyan gradient, 70% opacity at top fading to 100% at axis.
- Gridlines: hidden (horizontal only at 10% opacity `#3A4858` if needed).
- X-axis labels: `#9EA8B3`, 10 px.
- Y-axis: hidden (data labels on best/worst points only).
- Best month (July): cyan circle marker (10 px), large value callout "$ 4.2 M", month label below.
- Worst month (February): muted pink marker (`#BD6079`), smaller value label.
- Title: "Revenue Monthly Trend" → changed to "Revenue peaks in July at $4.2M", 14 px Semibold, `#DDE3E8`.

### Result trend chart (lower-center)

Same styling as revenue chart for visual consistency.
- Line: cyan (`#00BCD0`), 2 px.
- Gradient area fill: matching.
- Best/worst highlighted with the same marker pattern.

### Donut chart — Seller contribution (upper-right)

- Segments reduced to top 4 sellers + "Others".
- Colors: monochromatic cyan/teal (`#00BCD0`, `#0794A6`, `#126B78`, `#174B57`, `#697685` for Others).
- Segment spacing: 3 px.
- Inner radius: 65%.
- Labels: external, category name + percentage, `#DCE1E6`, 10 px.
- Legend: OFF.
- Center: empty, `#212836` background.
- Title: "Top 4 sellers represent 62% of revenue".

### Target indicator (lower-right)

Replace bulky gauge with bullet-style indicator:
- Build via Deneb/Vega-Lite or compose with native bar chart + shapes.
- Horizontal bar: pink portion (`#BD6079`) for below-target, teal (`#126B78`) for above.
- Target line: 1 px white at 100% mark.
- Position marker: white triangle at current 92% position.
- Large "92%" above the bar, 34 px Regular, `#F3F6F8`.
- Compact "Meta 100%" label near the target line.
- Title: "Overall goal achievement".

## Expected result

- The page feels immersive and premium on the boardroom wall display — no more white glare.
- Depth hierarchy is immediately visible: the 3 cyan-bordered KPI cards float above the chart containers.
- The gradient area charts feel smooth and executive, not like default Excel exports.
- The donut chart reads as a custom design element, not a default Power BI visual.
- The target indicator communicates "92% of goal" in under 2 seconds.
- Navigation is persistent and visible in the dark environment via the left rail.

## Quick formatting values for implementation

| Property | Value | Native path |
|---|---|---|
| Page background | `#1A1E2B` | Format → Page background → Color |
| Nav rail background | `#161A24` | Insert → Shapes → Rectangle |
| KPI card background | `#2A3342` | Format → Visual → Background |
| KPI card border | 1px `#00BCD0` 40% opacity | Format → Visual → Border |
| KPI card shadow | Custom: Offset 6, Blur 12, Black 45% | Format → Visual → Effects → Shadow |
| KPI card radius | 16 px | Format → Visual → Border → Rounded corners |
| Chart container background | `#212836` | Format → Visual → Background |
| Chart container border | 1px `#3A4858` | Format → Visual → Border |
| Chart container radius | 12 px | Format → Visual → Border → Rounded corners |
| Chart container shadow | Custom: Offset 4, Blur 8, Black 35% | Format → Visual → Effects → Shadow |
| Area gradient fill | Cyan `#00BCD0`, 70% transparency | Format → Visual → Area → Apply shading |
| Gridlines | `#3A4858`, 10% opacity | Format → X/Y Axis → Gridlines |
| Slicer background | `#212836` | Format → Slicer → Background |
| Slicer border | 1px `#3A4858` | Format → Slicer → Border |
| Donut segment spacing | 3 px | Format → Visual → Slices → Spacing |
| Donut inner radius | 65% | Format → Visual → Slices → Inner radius |
