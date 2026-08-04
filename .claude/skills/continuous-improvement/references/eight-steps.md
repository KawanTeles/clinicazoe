# The Eight Steps of the QC Story — detailed procedure

Contents:
1. [Step 1 — Select the theme](#step-1--select-the-theme)
2. [Step 2 — Grasp the actual condition and set the target](#step-2--grasp-the-actual-condition-and-set-the-target)
3. [Step 3 — Draft the activity plan](#step-3--draft-the-activity-plan)
4. [Step 4 — Analyze factors](#step-4--analyze-factors)
5. [Step 5 — Devise and implement countermeasures](#step-5--devise-and-implement-countermeasures)
6. [Step 6 — Verify the effects](#step-6--verify-the-effects)
7. [Step 7 — Standardize and establish control](#step-7--standardize-and-establish-control)
8. [Step 8 — Reflect: residual issues and future plans](#step-8--reflect-residual-issues-and-future-plans)
9. [Worked example — pizza restaurant](#worked-example--pizza-restaurant)
10. [Worked example — document search time](#worked-example--document-search-time)

---

## Step 1 — Select the theme

**Purpose:** decide *which* problem to work on. Most teams have many; energy spent on the wrong one is wasted regardless of how well the rest of the cycle is executed.

**Procedure:** identify problems → narrow down → name the theme → restate why it was chosen.

Ways to surface candidate problems:
- What problems face the department/company right now?
- What upper-level policy needs implementing?
- Where is there a gap between target and reality?
- Are there warning signs a problem is coming?
- Has the same failure recurred?

Screening questions for narrowing:
- Can we solve this ourselves? (If it needs another department's authority, either get them in or pick a different theme.)
- Is it aligned with company/department/superior's policy?
- Have we used a Pareto chart to rank by impact?
- Is it more important than the alternatives?
- Is the background — why this matters — clear?

**Evaluation matrix.** When candidates are hard to rank, score them. Typical criteria (1 = lowest, 5 = highest): urgency, importance, efficiency gain, investment efficiency, alignment with superiors' policy, self-responsibility, time required. Sum and pick the top.

**Naming the theme.** State the objective and the purpose in plain words. Convention: "*[Verb] the [characteristic]* activity" — e.g. "An activity to reduce the time taken to respond to customer inquiries." A good theme name tells you what will be measured.

**Typical scope:** 3 months for a single-team theme; 3–6 months if other departments must join.

---

## Step 2 — Grasp the actual condition and set the target

The step people most often skip, and the one that determines whether everything downstream is real or fiction.

**Grasping the actual condition** means clarifying the current state of the theme *and finding the characteristic* — the specific, measurable result that is going wrong.

The move is: **collect facts → stratify → visualize → find where the variation lives.**

Stratification axes to try:
| Axis | Examples |
|---|---|
| Time | hour, day, day/night, week, month, season |
| Worker | line, skill level, new/experienced, shift, team |
| Machine | machine, model, age, jig, structure |
| Method | temperature, pressure, process condition, work method |
| Material | supplier, lot, composition, manufacturer |
| Measurement | instrument, method, inspector |
| Other | region, customer, use condition, weather, location |

Cross-tabulating two axes often reveals what neither shows alone (e.g. failures by person *and* by inquiry type).

**Problem vs. characteristic.** The problem is the complaint; the characteristic is the measurable result behind it.
- Problem: "The pizza isn't good." → Characteristics: "the crust is too hard", "the sauce is off", "the cheese is burnt."
- Problem: "We're late responding to customers." → Characteristic: "search time for the required document (minutes)."

Choose a characteristic that (a) shows large variation and (b) has trustworthy data. You cannot analyze what you cannot measure.

**Setting the target.** Specify **what, how much, by when.** Ground it in something — the theoretical ideal, a benchmark, or an observed best case. Example: response time averages 15 min when the responsible person is present but 110–150 min when absent, so the target is "under 15 min even when the PIC is absent" (a ~90% reduction). That is defensible; "reduce by 30%" pulled from the air is not.

---

## Step 3 — Draft the activity plan

Define **who does what by when** across the remaining steps. A master schedule (Gantt) with the eight steps as rows and weeks/months as columns; plan row and actual row for each.

Rules:
- Master schedule up front; detailed sub-schedules created *at* each step, not before.
- The plan evolves as the activity progresses; update and share changes.
- The person in charge records progress; the manager checks it regularly.
- If a delay or new problem appears, add countermeasures rather than quietly slipping the date.
- Get the supervisor's approval — you'll need their cooperation later.

---

## Step 4 — Analyze factors

**Purpose:** go from *many factors* to *the true cause*, using data.

**Factor vs. cause — the distinction that makes the step work:**
- A **factor** is anything that influences the characteristic. There are always several.
- A **cause** is the source that actually produced this result. Essentially, there's one.

Step 4 is the funnel. Brainstorming widens it; data narrows it.

**Procedure:**
1. **Clarify the characteristic** (from Step 2, measurable, data-backed).
2. **Brainstorm factors.** Rules: quantity over quality; be freewheeling; never criticize; build on others' ideas. Target ~30 ideas in 10 minutes. Everyone with domain knowledge participates.
3. **Compile into an Ishikawa diagram.** Group into large bones (typically 4M: Man, Machine, Material, Method — but also Information, Tool, Customer, Environment, Time, Facility), then medium and small bones.
   - *Large-bone development* (large→medium→small): systematic, clear causal structure, but constrains ideas.
   - *Small-bone consolidation* (small→medium→large): more ideas, harder to organize. Choose based on whether you need breadth or structure.
4. **Narrow to important factors.** Two checks:
   - Is the level of this factor actually changeable?
   - If the factor changes, does the characteristic change?
5. **Verify.** This is the part people skip. Methods:
   - **Data-based:** correlation analysis, ANOVA, design of experiments, comparison before/after, on-site investigation, survey.
   - **Knowledge-based:** ranking (pairwise scoring), DARE, voting. Use these *only* when data is unobtainable, and label the result as a hypothesis.

**KFTA / Why-tree.** An alternative to the fishbone that produces a verification table. Lay out event → primary factor (why) → secondary → tertiary, and for each leaf record a judgment (✗ cause / △ possible / ○ not a cause) and the *reason* for that judgment. Forces you to state the evidence, not just the hunch. Excellent when you need a defensible audit trail.

**Check-points:**
- Did you draw on the knowledge of everyone involved?
- Have factors been narrowed using data and facts, not opinion alone?
- Has the *magnitude* of each shortlisted factor's impact been verified?
- Are the end factors concrete enough that you can act on them or collect data on them?
- No abstract factors ("poor attitude"), no blame ("carelessness") — ask why the process allowed it.

---

## Step 5 — Devise and implement countermeasures

Generate **multiple** countermeasures against the true cause; select on feasibility (technology, cost, workability); implement decisively.

Use 5W1H to specify each: what, why, where, when, who, how.

**Check-points — the ones that matter:**
- Is the countermeasure aimed at the *true* factor, or the symptom?
- Is it reactive (temporary fix) or permanent?
- Could it create a new problem elsewhere (adverse effect)?
- Were several options generated and their pros/cons compared, or did you take the first idea?

Distinguish **primary measures** (immediate, contain the damage) from **secondary measures** (structural, prevent recurrence). Both are legitimate; a plan with only primary measures is incomplete.

---

## Step 6 — Verify the effects

Quantify the result. **Use the same chart and the same metric as Step 2** — this is what makes before/after comparison honest.

Report:
- **Tangible effects:** the number moved, against the target. (Target 47.8; result 55.9 — 40% up against a 20% target.)
- **Intangible effects:** skills gained, problem-solving awareness, teamwork, improvement mindset. Real, but never a substitute for the number.
- **Ripple effects:** benefits elsewhere.

**Check-points:**
- Was the original target achieved?
- Has the target quietly been swapped for a different one?
- Were estimates replaced with actuals?

**If there is no effect, return to Step 2 — not Step 5.** The likely errors, in order:
1. The characteristic identified in Step 2 was wrong.
2. The factors narrowed in Step 4 were wrong.
3. The countermeasures in Step 5 were wrong.

Most failures are (1) or (2). Trying a different countermeasure against an unverified cause is just guessing faster.

---

## Step 7 — Standardize and establish control

Prevent recurrence. Improvement that isn't standardized decays.

Two halves:
- **Standardization:** create or revise the standard/procedure/manual; define the control method (what gets measured, how often, by whom, what triggers action).
- **Establishing control (SDCA):** instill the standard in the people who must follow it; train them; build a mechanism that keeps it alive.

**Check-points:**
- Did improvement stop the moment the manual was written?
- Is there a mechanism ensuring the standard is actually followed — or just a document?
- Is the standard reasonable to comply with? (An unreasonably demanding standard will be quietly ignored.)
- Is prevention built into the *hardware* where possible — jigs, fixtures, drawings, poka-yoke — rather than relying on human vigilance?

Prefer mechanisms that make the error impossible over mechanisms that ask people to be careful.

---

## Step 8 — Reflect: residual issues and future plans

- What remains unsolved on this theme? Feed it into the next cycle.
- What about the problems *not* selected in Step 1?
- If the target was not met, should the activity continue? (Manager's call.)
- **Horizontal deployment:** share the result with other departments. A fix applied in one place and nowhere else is a fraction of the available value.
- Failure teaches success. Record what didn't work and why.

---

## Worked example — pizza restaurant

| Step | Content |
|---|---|
| 1 | Many problems (labor cost, rent, competitor opening, ingredient cost, defect cost, turnover). Narrowed to **"Activity to reverse the decline in pizza sales"** — aligned with the goal of increasing sales, background analyzable, solvable in-house. |
| 2 | Sales: FY18 43.8 → FY19 39.8 (−10%). Target: **+20% → 47.8**, quantified and dated. |
| 3 | Master schedule over 3 months, owners assigned. |
| 4 | Why-tree: sales volume ↓ → taste deteriorated? / selling method changed? / advertising changed? / price changed? Verification killed most branches (same chef, same ingredients, same lineup, same prices, ads unchanged). Two survivors: customer comments that the pizza tasted worse, and an oven overhaul at end-2018 coinciding with the decline. **Priority verification: taste, via the oven.** |
| 5 | Countermeasures against the true cause of the taste degradation. |
| 6 | Result 55.9 (+40%) vs. target 47.8 (+20%) — same chart as Step 2. |
| 7 | Standardize the oven maintenance/temperature procedure; add it to control. |
| 8 | Deploy to other menu items and other branches. |

Note what the analysis did: it *eliminated* the plausible-sounding causes (the competitor! the prices!) with evidence, and converged on the one supported by both a customer signal and a timeline coincidence.

## Worked example — document search time

| Step | Content |
|---|---|
| 1 | Circle members scored their daily problems on urgency, importance, efficiency, investment, policy alignment, self-responsibility, time. Winner: **"Activity to reduce the time taken to respond to customer inquiries."** |
| 2 | Characteristic: **document search time (min).** Baseline when the PIC is absent: 110 / 150 / 90 min for three inquiry types. When present: ~15 min. Target: **≤15 min even when the PIC is absent** (≈−90%), grounded in the observed best case. |
| 4 | Ishikawa on 4M. Root factors: too many documents; documents not classified; nobody knows who holds what; no designated storage location; spines unreadable. |
| 5 | A) discard duplicates; B) stop personal storage — share in one location; C) uniform content-based index; D) uniform file system (spine color, index format, file type). Primary and secondary waves. |
| 6 | 110→15→8 min; 150→50→5 min; 90→5→2 min. All under the 15-min target. |
| 7 | Apply the labeled filing system to every new project from the start; standardize the indexing method. |
| 8 | Extend the same labeling rule to electronic files on the server. |

Note the target-setting: not invented, but taken from the condition that already existed when the right person was present. That is what makes it credible and achievable.
