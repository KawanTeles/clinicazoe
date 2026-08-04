# The Seven QC Tools — construction and interpretation

Selected by Kaoru Ishikawa from statistical technique; between them they handle the large majority of shop-floor problems. Two things matter more than memorizing them:
1. Knowing them isn't enough — you have to *use* them.
2. Know **which step of the QC Story** each one belongs to, and why.

Contents:
1. [Stratification (the idea underneath all seven)](#0-stratification)
2. [Graphs](#1-graphs)
3. [Pareto chart](#2-pareto-chart)
4. [Check sheet](#3-check-sheet)
5. [Histogram](#4-histogram)
6. [Scatter diagram](#5-scatter-diagram)
7. [Control chart](#6-control-chart)
8. [Cause-and-effect (Ishikawa) diagram](#7-cause-and-effect-ishikawa-diagram)
9. [Which tool in which step](#which-tool-in-which-step)

---

## 0. Stratification

Classify data into groups by attribute to get more defined data. This is not an eighth tool — it's the operating principle of the other seven.

Why it matters: aggregate data averages away the signal. Stratify and the problem becomes specific, the factor becomes visible, and the magnitude of its impact becomes estimable.

Axes: **time / worker / machine / method / material / measurement / other** (region, customer, weather, use condition).

**Canonical example.** A site logs 30 failures to answer phone inquiries immediately in a month. By day: noise. Stratify by person → A: 18, B: 2, C: 1, D: 9. Stratify by content → delivery date 16, quality 10, price 4. Cross-tabulate the two:

| Person (experience) | Quality | Delivery | Price | Total |
|---|---|---|---|---|
| A (1 yr) | 7 | 9 | 2 | 18 |
| B (3 yr) | 1 | 0 | 1 | 2 |
| C (6 yr) | 0 | 0 | 1 | 1 |
| D (3 yr) | 2 | 7 | 0 | 9 |
| **Total** | **10** | **16** | **4** | **30** |

Now you can see it: failures concentrate in the newest person, and delivery-date questions defeat even experienced staff. Those are two different problems needing two different countermeasures — training vs. an information-access fix. The unstratified total would have produced one blunt, wrong answer.

**Population and sample.** Data collected is a *sample*; the thing you want to improve is the *population*. Sampling must be unbiased, and you must know how to reason about variation, or your estimate of the population is worthless.

---

## 1. Graphs

Turning numbers into shape. A table requires scrutiny; a chart delivers the trend immediately.

| Type | Use |
|---|---|
| Bar | Compare magnitudes between items |
| Line | Change over time |
| Pie | Proportion of a whole |
| Band (stacked %) | Proportions compared across periods |
| Radar | Multi-dimensional level, before/after |
| Combination | Two units at once (e.g. sales bars + share line) |

**Before drawing, ask:** what will this chart say, and how will it be used? Then design for that.

**Rules:** title; axis labels; units on both axes; data collection period; n; author and date; values on the plot; legible at final size (Excel charts pasted small into slides are usually unreadable).

**Classic mistake:** comparing two pie charts across years. Proportions look identical while the totals doubled — pies hide the total, so the comparison is meaningless. Use bars when magnitude matters.

---

## 2. Pareto chart

Ranks stratified items by magnitude, with a cumulative percentage line. **Pareto law: ~80% of effects come from ~20% of causes.**

**Purpose:** decide *where to start*. This is the prioritization tool, and it is the reason Step 1 isn't guesswork.

**How to build:**
1. Stratify the problem by cause / phenomenon / equipment / location / process — pick the axis matching your purpose.
2. Choose a data period appropriate to when the problem occurs (a week, a month).
3. Bar chart, items sorted descending by value.
4. Add the cumulative percentage line on a secondary axis.
5. State n and the period.

**Construction rules:**
- No gaps between bars.
- "Others" always rightmost, regardless of its size. If "Others" is large, stratify it further.
- Second axis labeled *cumulative percentage*.
- Shade/color the vital few.
- Always include the cumulative curve.

**Reading it:** which factors dominate, how severe each is, how much each contributes, and which to attack first. Example: 20 defect categories; scratches + cracks + dents + dirt = 85% of all defects. Eliminate those four and you eliminate 85% of the problem — the other 16 categories can wait.

**Also used in Step 6:** the before/after Pareto is the cleanest possible proof that the countermeasure worked.

---

## 3. Check sheet

A pre-formatted record sheet — the frame and item names written *in advance* — so that data can be collected and classified quickly, completely, and without error, by anyone.

Two types:
- **Investigation check sheet:** categories laid out so occurrences can be tallied (e.g. frequency-distribution survey by measurement bin).
- **Inspection check sheet:** a list of items that must be verified, to prevent omission.

Include: process, part, measurement location, survey period, instrument, method, unit, n, and who measured. If you're about to analyze data whose collection method you can't describe, the analysis is not fact-based.

**When the user has no data, this is the tool to reach for first.**

---

## 4. Histogram

Frequency (y) against class/bin (x). Shows the **distribution** — the variation — which no summary statistic can.

Bins: 5–12 across the range from min to max. Show mean, σ, n, period, process, author. Draw the spec limits if they exist.

**Why it's necessary:** even with the same process, materials, and standards, output varies. Quality characteristics cluster around a center and thin out — that's a distribution, and the histogram is what makes it visible. It's also the fastest way to spot outliers or non-random sampling.

**Reading the shape:**

| Shape | Meaning / what to check |
|---|---|
| Symmetric (bell) | Normal. The common, healthy case. |
| Multimodal (comb) | Bin width is a bad multiple of the measurement increment, or the measurer is rounding. Fix the measurement, not the process. |
| Skewed (right/left) | Asymmetric tail. Natural where a physical bound exists near zero (warpage, impurity %). Suspicious otherwise. |
| Cliff / end cut off | Out-of-spec units were sorted out and removed. Check for measurement fudging or inspection error — you're looking at filtered data. |
| Plateau (uniform) | Several distributions with different means, mixed. Stratify and redraw. |
| Bimodal (two peaks) | Two populations mixed — two machines, two shifts, two lots. Stratify. |
| Symmetric with an island | Foreign data mixed in, measurement error, or a process abnormality. |

**Against spec limits:**

| Situation | Action |
|---|---|
| Centered, comfortably inside spec | Maintain. |
| Spread OK but shifted, defects on one side | Find and remove the bias. |
| Centered but spread ≈ spec width, no margin | Monitor closely; reduce variation. |
| Spread > spec, defects both ends | Find the source of the variation. Centering won't save you. |

The last two are the important distinction: a *centering* problem and a *variation* problem need completely different countermeasures, and the histogram is what tells them apart.

Mean, variance, σ:
- Deviation = xᵢ − x̄
- Variance V = s² = Σ(xᵢ − x̄)² / (n − 1)
- Standard deviation s = √V (square root taken so the unit matches the original data)

---

## 5. Scatter diagram

Plot pairs of values to test a relationship between two variables. Mainly Step 2 (grasping condition) and Step 4 (factor analysis).

**Axis convention: factor (cause) on X, result (characteristic) on Y.** This is not cosmetic — it changes the reading. "Vehicle weight → fuel economy" answers *how does changing weight affect economy*; flipped, it answers *what weight is needed to hit an economy target*. Choose the one matching your question.

**Correlation coefficient r (−1 ≤ r ≤ 1):**

| \|r\| | Reading |
|---|---|
| 0.7 – 1.0 | Strong correlation |
| 0.4 – 0.7 | Moderate |
| 0.2 – 0.4 | Weak |
| 0 – 0.2 | Little or none |

(For R², use ≥ 0.5 as the rough threshold.) Sign gives direction. Non-linear relationships exist and won't show up in r — always *look* at the plot; never trust the coefficient alone.

**Stratify the scatter.** The essential lesson: an ice-cream stand plots temperature vs. customers and gets a mediocre cloud. Stratify weekday vs. weekend and two clean relationships appear — the same temperature yields far more customers on a weekend. One aggregate answer would have been wrong for both cases. Actions differ accordingly: forecast tomorrow's demand from temperature, *and* prepare more stock at weekends.

**Outliers.** Excluding two points can move R² from 0.69 to 0.83 — but don't delete points to flatter the model. Investigate them first: an outlier is either a measurement error (remove it, and fix the measurement) or a real signal about a condition you haven't stratified (keep it, and go find the condition).

---

## 6. Control chart

A line chart over time with a center line (CL) and control limits (UCL/LCL, typically ±3σ). Its job is to distinguish two kinds of variation:

- **Chance/common cause:** normal variation in a stable process. Investigating it is a waste of time; no action needed.
- **Assignable/special cause:** something specific broke. Investigate and act.

Confusing the two is expensive in both directions: chasing noise wastes effort and destabilizes a good process; ignoring a signal lets a real problem run.

Primarily a **Step 7** tool — it's how you *hold* the gain and detect drift, which is exactly what SDCA requires.

**The eight anomaly rules (zones: A = 2–3σ, B = 1–2σ, C = 0–1σ):**

| Rule | Signal | Interpretation |
|---|---|---|
| 1 | A point outside the control limit | Abnormality. Investigate, act. |
| 2 | 7+ consecutive points on one side of CL | The process mean has shifted. |
| 3 | 6+ points continuously rising or falling | A trend — tool wear, fatigue, drift. |
| 4 | 14 points alternating up/down | Systematic alternation — often two mixed populations (e.g. two shifts, two machines). |
| 5 | 2 of 3 consecutive points in zone A or beyond | Variation increasing. |
| 6 | 4 of 5 consecutive points in zone B or beyond, same side | Mean shifting. |
| 7 | 15 consecutive points within zone C | Suspiciously *good*. Usually a grouping/measurement problem — the subgrouping is masking real variation. |
| 8 | 8 consecutive points outside zone C | Variation has increased; possibly mixed populations. |

Rule 7 deserves attention: data that looks *too* well-behaved is a warning, not a triumph. It usually means the subgrouping is wrong or non-conforming units aren't reaching the chart.

---

## 7. Cause-and-effect (Ishikawa) diagram

Organizes, stratifies, and displays the factors affecting a characteristic. The Step 4 workhorse, and the main tool for *language* data (as opposed to numerical).

**Build it in three moves:**

**1. Clarify the characteristic.** Write a *characteristic*, not a problem. "Pizza is not delicious" is a problem; "the crust is too hard" is a characteristic — and only the latter can be analyzed. Choose one with large variation and reliable data.

**2. Brainstorm factors.** The four rules:
- Quantity over quality — quantity produces quality.
- Be freewheeling — wild ideas welcome.
- Never criticize — criticism kills the flow.
- Build on others' ideas by association.

Target ~30 ideas in 10 minutes, with a facilitator. Everyone with domain knowledge participates; the diagram is only as good as the knowledge poured into it.

**3. Compile.** Backbone → large bones → medium bones → small bones. Simply listing factors doesn't reveal relationships; the grouping is what does.

Large bones — typically **4M: Man, Machine, Material, Method.** Also valid: Information, Tool, Customer, Environment, Time, Facility. Choose whatever genuinely partitions your domain rather than forcing 4M.

Two construction directions:
| | Large-bone development (large→small) | Small-bone consolidation (small→large) |
|---|---|---|
| **Strength** | Systematic; causal relations clear | Free discussion; many more factors surfaced |
| **Weakness** | The large-bone frame constrains ideas | Hard to organize afterwards |

**Then narrow.** Identify the important factors, using:
- **Data:** correlation, ANOVA, design of experiments, multivariate methods, on-site investigation.
- **Knowledge** (when data is unavailable): pairwise ranking, DARE, voting by show of hands.

Two questions to test any candidate factor:
1. Is this factor's level actually changeable?
2. If it changes, does the characteristic change?

If either answer is no, it's not a factor worth pursuing — however true it may be.

**Ten check-points for a good diagram:**
1. Any omitted factors?
2. Are the end factors concrete enough to act on or collect data on?
3. Are large/medium/small bones organized systematically?
4. Is the magnitude (level) of each factor right?
5. Any factors unrelated to the characteristic?
6. Have factors been weighted and prioritized?
7. Any abstract factors? (Kill them — they can't be acted on.)
8. Is it merely a level chart (e.g. "age: 20s, 30s") rather than a causal one?
9. Is the characteristic expressed concretely enough that data can be collected and anyone can understand it?
10. Have many people's opinions been incorporated?

**The trap:** treating the completed diagram as the answer. It isn't. A fishbone *generates hypotheses*; only data *selects* among them. A team that draws a beautiful diagram and then acts on the branch everyone liked best has skipped the entire point of fact-finding.

---

## Which tool in which step

| Step | Tools |
|---|---|
| 1. Select theme | Pareto, bar/line/pie chart, evaluation matrix |
| 2. Grasp condition & set target | Pareto, bar/line chart, histogram, scatter, check sheet, stratification |
| 3. Activity plan | Gantt / schedule chart |
| 4. Analyze factors | Ishikawa, why-tree/KFTA, scatter, stratification |
| 5. Countermeasures | Histogram, 5W1H |
| 6. Verify effects | Same chart as Step 2; before/after Pareto; radar (intangibles); control chart |
| 7. Standardize & control | Control chart, Pareto, standards |
| 8. Reflect | Pareto |
