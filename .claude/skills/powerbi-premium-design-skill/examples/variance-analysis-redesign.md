# Example — Redesign of “Variance Analysis — Budget vs. Actual”

## Current-state diagnosis

### Critical

- The bottom-right ranking contains an outlier that compresses all remaining bars.
- The control chart displays empty future months, creating a misleading reading.
- Legends and technical titles are truncated.

### High

- Four blocks have nearly the same visual weight, so the page lacks a clear primary focus.
- Heavy shadows and rounded containers compete with the data.
- Red is used as a regular series color in the Pareto and also as the control-limit color, breaking semantic consistency.
- The Pareto requires a scrollbar and uses difficult-to-read vertical labels.
- The matrix is dense and lacks a heatmap, making exceptions hard to locate.

### Medium

- The month filter floats separately instead of belonging to the header.
- Labels such as `@Account - Name` and `@Month - Year` look like technical field names.
- The control-chart axis and legend consume disproportionate space.

## Proposed direction

**Tone:** industrial premium light.

**Signature:** exception-first — only variances and critical points receive strong color.

**10-second narrative:** “The period variance is concentrated in a small number of accounts. The user should quickly identify those accounts, verify whether the process is out of control, and locate the most critical departments.”

## Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Variance Analysis                       Period [Apr/26–Jul/26]    Status ●    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Actual         Budget       Variance $      Variance %      Critical accounts│
├───────────────────────────────────────────────┬──────────────────────────────┤
│ Which accounts explain 80% of the variance?   │ Is the process under control?│
│ Pareto Top 10 + Others                        │ Control chart + control band  │
├───────────────────────────────────────────────┼──────────────────────────────┤
│ Where did the variance occur?                 │ Largest actual values        │
│ Department × Month heatmap                    │ Top 8 + Others / outlier card │
└───────────────────────────────────────────────┴──────────────────────────────┘
```

## Changes by visual

### Pareto

- Replace crowded X-axis categories with horizontal bars, or reduce the view to Top 10 + Others.
- Use dark navy for bars; reserve red for accounts above the criticality threshold.
- Use a secondary blue for the cumulative line and a dotted 80% reference line.
- Remove the scrollbar.

### Control chart

- Show only April through July unless a forecast exists.
- Use a dotted gray mean line.
- Use thin control-limit lines or a subtle control band.
- Highlight July only when it truly violates a control rule.
- Add a text chip such as “Within expected range” or “Out of control.”

### Matrix

- Apply a diverging heatmap centered on 0%.
- Sort departments by worst variance in the selected period.
- Reduce values to one decimal place.
- Add a tooltip containing Budget, Actual, Variance Amount, and Variance %.

### Ranking

- Place the largest customer in a separate callout when it represents a disproportionately large share.
- Show the next Top 8 + Others with horizontal bars and labels.
- Add share-of-total percentage.

## Expected result

- Less of a “four spreadsheets pasted together” appearance.
- Executive-level understanding within 10 seconds.
- Truly important exceptions highlighted.
- Less scrolling, truncation, and decorative noise.
