# Visual Patterns

## Variance Pareto

### Purpose
Show which categories explain most of the total variance.

### Rules

- Display the Top 8–12 categories plus "Others."
- Sort by absolute variance value in descending order.
- Bars: primary brand color; critical exceptions may use red.
- Cumulative line: supporting color, scaled from 0–100%.
- Mark 80% with a subtle reference line.
- Use horizontal labels or horizontal bars when category names are long.
- Avoid a scrollbar in the primary visual.
- When the first category dominates, create a callout or a separate visual for it.

## Horizontal Pareto with ABC Classes (Dark Premium)

### Purpose
Rank products or categories by revenue (or any metric), color-code by ABC classification, and overlay a cumulative percentage line. The key analytical event is the 80% threshold.

### Visual structure

This is a **horizontal bar chart** with a cumulative line overlay:

- Products are listed vertically, one per row, sorted from highest to lowest value.
- Each product has one horizontal bar extending from left to right.
- Bars are color-coded by ABC class, not by data series.
- A cumulative percentage line runs across the bars (descending visually from upper-left to lower-right as the percentage accumulates to 100%).
- The 80% threshold is highlighted with a distinct color marker and annotation.

### Rules

- Display Top 10–15 products minimum. More is acceptable if space allows (this visual benefits from height).
- Bar colors by ABC class:
  - **Class A** (top ~20% of products, ~80% of revenue): `accent-primary` (e.g., orange `#E8662D`).
  - **Class B** (middle ~30%): light gray (`#B2BAC0`).
  - **Class C** (bottom ~50%): blue-gray (`#697685`).
- Bars sorted vertically: highest revenue at top, lowest at bottom.
- Product name and value displayed aligned with each bar (data labels positioned inside or at bar end).
- Cumulative line: white or very light gray (`#F3F6F8`), 2 px width.
- Circular markers (6–8 px diameter) on the cumulative line at each product.
- Cumulative percentage labels near each marker (right-aligned, 9–10 px).
- The ~80% threshold marker: yellow-green (`#D5DD28`), slightly larger (10 px), with a short text annotation: "8 products = 80% of revenue".
- Y-axis: hidden (product names serve as labels via data labels).
- X-axis: muted (`text-secondary`), no title needed.
- Gridlines: hidden or very subtle (`border` color at 50% transparency).
- Background: `surface-secondary` or `surface-elevated`.
- No scrollbar — size the visual to fit all products, or limit to Top 15 + Others.

### Power BI implementation notes

- Use a **stacked horizontal bar chart** or **clustered bar chart** with conditional color by ABC class (measure-based color via DAX).
- The cumulative line requires a **line and stacked bar chart** combo visual, or a Deneb/Vega-Lite custom visual if precise control is needed.
- If using Deneb: map the cumulative percentage to a secondary Y-axis line, and use conditional encoding for bar color based on the ABC class field.

### Avoid

- Vertical columns for the product values (they compress labels and break the ranking readability).
- All bars in the same color (loses ABC classification signal).
- Hiding the 80% threshold (it is the main analytical insight).
- A separate legend when direct labels are present.

---

## Control chart

### Purpose
Distinguish common variation from exceptional events.

### Rules

- Show only periods with actual data unless a forecast is explicitly included.
- Actual line: primary brand color.
- Mean: dotted gray line.
- Limits: use a soft band or thin lines that do not compete with the main series.
- Highlight only points outside the limits or points that violate run rules.
- The title should answer: "Is the process under control?"
- Display a text status: Within expected range / Attention / Out of control.

---

## Variance matrix by department and month

### Purpose
Quickly locate where and when variances occurred.

### Rules

- Apply a diverging heatmap centered on 0%.
- Positive/favorable and negative/unfavorable colors must follow the business rule.
- Limit values to zero or one decimal place.
- Freeze or visually prioritize the first column.
- Sort departments by worst month, cumulative variance, or criticality.
- Hide months without data or separate forecast periods.
- Use a tooltip with Budget, Actual, Variance Amount, and Variance %.
- Apply a visual cap to extreme values so they do not wash out the rest of the heatmap.

### Dark theme matrix specifics

- Header background: `surface-primary` (`#212836`), text `#F3F6F8`.
- Row background: `surface-secondary` (`#252D3A`).
- Alternating row: `#252D3A` and `#283040` (very subtle difference).
- Row separators: 1 px `border` or none (padding alone often suffices).
- Heatmap colors: use the semantic color map. In dark themes, favorable = `#1A3A2E` (dark green bg), unfavorable = `#3A1A2A` (dark pink bg).
- Total row: `surface-elevated` background, Semibold text.

---

## Ranking with an outlier

### Purpose
Compare entities without allowing one extreme value to hide the long tail.

### Strategies

1. Top N + Others.
2. Separate outlier card + ranking of the remaining entities.
3. Dot plot with a broken axis, when supported and clearly indicated.
4. Share-of-total percentage when the absolute value is insufficient.
5. Small multiples by group.

Use horizontal bars, descending sort order, and value labels at the end of each bar.

---

## KPIs

### Recommended set for Budget vs. Actual

- Actual for the selected period.
- Budget for the selected period.
- Variance amount.
- Variance percentage.
- Number of critical accounts or departments.

Every KPI should include useful context such as comparison with the previous month, target, average, or status. Avoid repeating the same number without additional meaning.

---

## Gradient Area Chart (Line + Fill)

### Purpose
Show time-series evolution with a smooth, premium aesthetic. The semi-transparent gradient fill adds depth without the heaviness of a solid area chart. Best for executive dashboards and performance pages.

### Visual structure

- A line chart with the area below filled by a semi-transparent gradient.
- The gradient fades from the accent color at the line level to near-transparent at the axis.
- Minimal or no gridlines — the gradient provides the visual structure.
- Key data points are highlighted directly on the line.

### Rules

- Line color: `accent-primary`, 2–3 px width, solid.
- Area fill: same accent color with transparency gradient (65–75% at the top, fading to 95–100% at the axis).
- X-axis: muted labels (`text-secondary`), no title.
- Y-axis: hidden or muted with minimal labels.
- Gridlines: hidden entirely, or horizontal-only at very low opacity (border color, 10–20%).
- Best data point: highlighted with a circle marker (8–10 px) and a large value callout.
- Worst data point (if relevant): highlighted with `negative` color marker and muted value.
- Visual title: descriptive, 12–14 px Semibold.
- Background: integrated with the card (`surface-secondary` in dark themes).

### Highlight pattern (dark theme example)

```
Best month:  circle marker in accent-primary (e.g., cyan #00BCD0)
             large value label next to marker (e.g., "$ 4.2 M")
             small month label below the value

Worst month: circle marker in negative (e.g., muted pink #BD6079)
             smaller value label
             small month label below
```

### Power BI implementation

- Use a native **Area chart** or **Line chart** visual.
- Set area fill via Format → Visual → Area → Apply shading → set color and transparency.
- For finer gradient control, use a **Deneb** or **htmlContent** custom visual with Vega-Lite or ECharts.
- Remove vertical gridlines: Format → Y-Axis → Gridlines → off.
- Remove X-axis title and Y-axis title unless they add essential context.

### Avoid

- Solid, opaque area fill (looks heavy and obscures the background).
- Bright gridlines competing with the gradient.
- Unlabeled extremes — the best/worst points are the narrative.

---

## Donut Chart Premium

### Purpose
Compare part-to-whole contributions with a polished, modern look. Best for 3–6 categories. For executive and performance dashboards.

### Visual structure

- A donut chart with visible gaps between segments.
- Segments use a monochromatic color progression (variations of the same hue family).
- Labels are external, connected or adjacent to their segments.
- The center is empty and matches the page/card background.

### Rules

- Segments: 3–6 maximum. More than 6 → use a horizontal bar chart instead.
- Gap between segments: 2–3 px (Format → Visual → Slices → Spacing).
- Color progression (cyan/teal example):
  - Segment 1 (largest): bright cyan `#00BCD0`
  - Segment 2: medium cyan `#0794A6`
  - Segment 3: teal `#126B78`
  - Segment 4+ (if needed): dark teal `#174B57`
- Inner radius: 60–70% (creates a substantial center void).
- Labels: external, with category name + value + percentage. Position beside or around the donut.
- Center: empty, matching the visual background color.
- Background: `surface-secondary` in dark themes, `#FFFFFF` in light.
- No legend box — direct labels are preferred.
- Data label text: `text-primary` color, 10–11 px.

### Dark theme specifics

- Segment border: 2 px `canvas` color (creates the gap illusion cleanly).
- The dark empty center naturally frames the donut.

### Power BI implementation

- Native **Donut chart** visual.
- Format → Slices → Spacing: 2–3 px.
- Format → Slices → Colors: set each slice color individually (disable default auto-coloring).
- Format → Data labels → Position: Outside or Preferred.
- Format → Legend → Off (when using direct labels).

### Avoid

- More than 6 slices (the gaps disappear visually and it becomes unreadable).
- Default Power BI color palette (bright, unrelated colors).
- Tiny inner radius (pie chart masquerading as a donut).
- Side legend when direct labels fit.

---

## Bullet / Target Indicator

### Purpose
Show current performance against a target with immediate visual clarity. The user should understand "are we above or below target?" in under 2 seconds.

### Visual structure

- A horizontal bar divided into colored regions.
- A thin vertical marker line at the 100% target position.
- A pointer (triangle or circle) indicating the current value position.
- A large percentage value displayed above or beside the indicator.

### Rules

- Bar total width represents 0–100%+ (can exceed 100%).
- Below-target region (0–100%): `negative` color (e.g., muted pink `#BD6079`).
- Above-target region (100%+): `accent-primary` or `positive` color (e.g., cyan/teal).
- Target line: thin (1 px) vertical line in `text-primary`, positioned at the 100% mark.
- Current position indicator: upward-pointing triangle ▼ in `text-primary` or white, aligned precisely with the current percentage.
- Large percentage value: 28–36 px, positioned above the indicator bar.
- Small "target" or "meta" label near the target line.
- Background: `surface-secondary` in dark themes.

### Example (dark theme)

```
    92%
 ───●──────────────────────
████████████████████░░░░░░░░  bar (pink = below 100%, teal = above)
                    │
                  Meta 100%
```

The triangle (●) sits at the 92% position inside the pink region, immediately communicating underperformance.

### Power BI implementation

- Not natively available as a single visual in Power BI.
- Options:
  1. **Deneb** with Vega-Lite: layer a bar mark + rule mark + point mark. Most flexible and recommended.
  2. **Stacked bar chart** + text boxes + shapes: position a native stacked bar, overlay shapes for the target line and pointer.
  3. **Gauge visual** with custom formatting: set min=0, max=target*1.2, use the native gauge with a thin needle.

### Avoid

- Gauge visual with a thick arc (takes too much space for a single metric).
- Forgetting to include the percentage value (the bar alone is ambiguous).
- Using a gauge that spans 360° — a 180° arc or horizontal bar communicates faster.

---

## Glow KPI Cards

### Purpose
Present key metrics as elevated, premium cards that draw attention through subtle depth and a soft accent glow. The signature visual of dark premium dashboards.

### Visual structure

- A card with a dark background, rounded corners, thin border, and a soft colored glow.
- The glow is positioned to feel like it emanates from one corner (typically upper-left).
- Contains: large KPI value, small label, and a delta indicator (vs prior period or vs target).

### Rules

- Card background: `surface-elevated` (`#2A3342`), distinct from the main container background.
- Border radius: 12–16 px.
- Border: 1 px `border` (`#354251`).
- Shadow: Elevated level (medium shadow: 8 px blur, 4 px offset, 30% transparency).
- Glow: accent-primary, radius 15–25 px, transparency 70–85%.
- KPI value: 26–38 px Semibold, `text-primary` color (or context color for variance KPIs).
- KPI label: 10–12 px Regular, `text-secondary` color, positioned below the value.
- Delta: small text or chip adjacent to the value ("+12% vs LY" in `positive` or `negative`).
- Internal padding: 16–24 px on all sides.

### KPI card layout

```
┌──────────────────────────────┐
│  ⊹ (soft glow top-left)      │
│                              │
│  $ 4.2 M   +12% vs LY       │  ← value + delta on same line
│  Receita Realizada           │  ← label below
│                              │
└──────────────────────────────┘
```

### Variations

**Variance KPI card:** value color changes based on status (positive = `positive`, negative = `negative`). Glow color follows the status color. Best for the center/hero KPI.

**Comparison KPI card:** two values stacked (Actual vs Budget). Actual in `text-primary`, Budget in `text-secondary`. Glow uses accent color. Best for side KPIs.

**Status KPI card:** value + status chip ("Acima da meta" / "Abaixo da meta"). Glow color follows status. Best for operational dashboards.

### Row of KPI cards

- 3–5 KPI cards in a horizontal row.
- Equal width, equal height (100–130 px).
- 16–20 px gap between cards.
- All cards share the same elevation level and glow color.
- The first card may optionally be slightly wider or use a different glow intensity to serve as the primary KPI.

### Power BI implementation

- Use native **Card** visual or **Multi-row Card**.
- Apply background, border, shadow, and glow via Format → General.
- For the delta, use a separate measure displayed as a data label or a small text box overlay.
- To achieve the corner-glow illusion, the card content should be positioned with slight internal padding (the glow radiates from the visual center, but generous padding makes it feel offset from the content).

### Avoid

- Glow on more than one row of cards (it dilutes the effect).
- Glow + shadow on the same card at full intensity (reduce shadow to Raised or remove it when using glow).
- Glow radius > 30 px (Power BI clamps it, and large values look muddy).
- Bright neon glow colors — the effect should be "premium diffused light," not "game LED."

---

## Tooltips

Use tooltips to:

- provide values that do not fit on the canvas;
- explain calculation logic;
- show a breakdown by entity;
- display a short history;
- avoid permanently dense tables on the page.

### Dark theme tooltip styling

- Background: `surface-elevated` (`#2A3342`).
- Text: `#F3F6F8` (primary), `#9EA8B3` (secondary).
- Border: 1 px `border`.
- Shadow: Floating level.
- Border radius: 8 px.
- Build tooltip pages with the same background color for seamless integration.
