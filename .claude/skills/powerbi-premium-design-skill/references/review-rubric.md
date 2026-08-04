# Review Rubric — 100 Points

Approved for delivery: at least 85/100 with no critical blockers.

| Criterion | Points | What to evaluate |
|---|---:|---|
| Hierarchy and narrative | 20 | Can the situation be understood in 10 seconds? Is there a dominant focus? |
| Clarity and readability | 15 | Are axes, labels, titles, contrast, and density appropriate? |
| Chart suitability | 15 | Does each visual answer the question effectively and match the data shape? |
| Layout and spacing | 12 | Grid, alignment, margins, gutters, and visual balance |
| Depth and elevation (dark) / Surface clarity (light) | 3 | Dark: correct surface hierarchy (≥3 levels), shadow levels applied, no flat blending. Light: clean separation between canvas and surfaces. |
| Color and semantics | 10 | Consistent color map; red/pink reserved for exceptions; dark themes use desaturated accents |
| Typography | 8 | Scale, weight, consistency, and readability per theme |
| Interactivity | 7 | Do slicers, tooltips, drillthrough, and cross-filtering add value? |
| Accessibility | 5 | Contrast, non-color cues, alt text, font size; dark: light text meets ≥4.5:1 on all surfaces |
| Performance and robustness | 5 | Do visual count, custom visuals, and effects preserve usability? |

## Critical blockers

- A visual or slicer is clipped or overlapping another element.
- An essential legend is truncated.
- Color semantics are contradictory.
- Empty future periods are presented as actual data.
- A percentage is incorrectly formatted.
- A scrollbar is required to understand the main message.
- A technical field name is exposed to the end user.
- An outlier makes all other categories unreadable.
- Essential text has insufficient contrast (light: dark text < 4.5:1; dark: light text < 4.5:1 on any surface level).
- **Dark theme only**: the page uses a single surface background throughout — no depth hierarchy. Minimum 2 distinct surface levels required.
- **Dark theme only**: accent color is fully saturated (e.g., pure cyan `#00FFFF`, pure red `#FF0000`), causing visual vibration on a dark background.
- **Dark theme only**: white text (`#FFFFFF`) used for body/paragraph text instead of off-white (`#F3F6F8`), causing eye strain.

## Typical penalties

### Both themes

- More than eight primary visuals: −3 to −8.
- Four equally weighted containers with no hierarchy: −5.
- Generic field title: −2 for each critical visual.
- Variance matrix without conditional formatting: −4.
- Vertical or unreadable labels: −3.
- Decoration that does not encode information: −3.

### Light theme

- Shadow applied to more than 2 visuals: −3.
- Heavy shadow (Medium or Heavy preset) on any light-theme card: −4.
- Canvas and visual backgrounds indistinguishable (both white with no border): −3.

### Dark theme

- No shadow applied to any visual (flat appearance): −5.
- All shadows at the same level without hierarchy: −3.
- Glow border effect on more than 4 KPI cards (dilutes impact): −2.
- Gradient area fill on more than 2 charts on one page (overuse): −3.
- Gridlines brighter than the container background (e.g., white gridlines on dark chart): −3.
- Missing surface hierarchy — canvas and all cards share the same hex color: −5.

### Theme consistency

- Light and dark surfaces mixed on the same page: −5.
- Different accent strategies mixed (e.g., cyan KPI cards next to orange KPI cards): −4.
