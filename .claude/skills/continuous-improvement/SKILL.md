---
name: continuous-improvement
description: Structured problem-solving and continuous improvement combining the TQM/QC Story method (8 steps, PDCA/SDCA, Seven QC Tools, Ishikawa, Pareto, histogram, control chart, 5-Why, A3 report) with the Lean waste lens (TIMWOOD, value definition, VSM) and Six Sigma vocabulary (DMAIC, DPMO, Cp/Cpk, MSA). Use this skill whenever the user wants to diagnose a recurring problem, reduce defects/waste/delays/rework, analyze root causes, run a kaizen or process-improvement initiative, build an A3 or improvement report, decide which problem to tackle first, or asks anything about Lean, Six Sigma, DMAIC, kaizen, PDCA, quality control, root cause analysis, process capability, or "why does X keep happening". Also use it proactively when the user describes an operational problem (missed deadlines, quality complaints, rework, cost overruns, bottlenecks, slow processes, idle time) even if they never mention any methodology by name — the method applies to any gap between a target and reality.
---

# Continuous Improvement — TQM / QC Story + Lean

The engine of this skill is the Komatsu/JUSE **QC Story**: an eight-step, fact-based problem-solving cycle backed by the Seven QC Tools. Around it sits the **Lean waste lens** and **Six Sigma vocabulary**, which cover ground the QC Story alone does not.

The method exists because most people, handed a problem, jump straight from symptom to solution using intuition. Its whole value is forcing the detour through facts — stratify the data, find where the variation actually lives, and only then act.

## Two lenses — pick the right one

Improvement problems come in two shapes, and they need different tools:

| The complaint | Lens | Ask |
|---|---|---|
| Slow, costly, too many steps, people waiting, work piling up | **Lean / waste** | Are we doing unnecessary things? |
| Inconsistent, defective, unpredictable, sometimes fine and sometimes not | **QC Story / variation** | Are we doing the necessary things consistently? |

Most real problems have both. Diagnose with the waste lens (it's faster and often finds cuttable work immediately), then run the QC Story on whatever variation remains. Don't run an eight-step cycle to discover that a form is being triple-checked for no reason.

## Core philosophy

Four ideas drive everything.

1. **Customer-focused.** Quality is judged by whoever receives the output — often the *next process*, not an external buyer. **The value test:** an activity adds value only if (a) the customer would pay for it, (b) it transforms the product or service, and (c) it's done right the first time. Fail any of the three and it's waste — eliminate or minimize.
2. **Fact-finding (genchi genbutsu).** Judge from data and the actual site, never from experience or hunch. Facts always contain *variation*: the same event has different averages, maxima, minima. A solution built on one anecdote is built on noise.
3. **Process control.** Manage the process, not the output. Inspecting defects out is expensive and late; changing the process that produces them is cheap and permanent.
4. **A problem is a gap** between a target/ideal condition and the actual condition. No gap, no problem. If the user hasn't quantified the gap, that's the first thing to fix.

## Two cycles

- **PDCA** (Plan-Do-Check-Act) — for *improvement*. Raises the level. The 8-step QC Story implements it.
- **SDCA** (Standardize-Do-Check-Act) — for *maintenance*. Holds the gain. Without SDCA, every improvement silently decays back to baseline.

Improvement without standardization is temporary. Step 7 is not bureaucracy — it is what makes the work durable.

## The eight steps

| PDCA | Step | Purpose | Typical tools |
|---|---|---|---|
| **P** | 1. Select the theme | Choose *which* problem to attack | Pareto, charts, evaluation matrix |
| **P** | 2. Grasp the actual condition & set the target | Quantify the gap; find the characteristic | Pareto, histogram, scatter, stratification, check sheet |
| **P** | 3. Draft the activity plan | Who, what, by when | Gantt |
| **P** | 4. Analyze factors | Move from many factors to the true cause | Ishikawa (4M), 5-Why, scatter, stratification |
| **D** | 5. Devise & implement countermeasures | Act on the root cause, not the symptom | 5W1H, option comparison |
| **C** | 6. Verify the effects | Prove the gap closed, with the *same* metric | Same chart as Step 2, before/after Pareto |
| **A** | 7. Standardize & establish control | Prevent recurrence | Standards, control chart, SDCA |
| **A** | 8. Reflect: residual issues & next plan | Feed the next cycle; deploy horizontally | — |

**DMAIC maps onto this**, for users who speak Six Sigma: Define ≈ Steps 1–2 · Measure ≈ Step 2 · Analyze ≈ Step 4 · Improve ≈ Steps 5–6 · Control ≈ Steps 7–8. Same method, different vocabulary. Use whichever names the user uses.

Read `references/eight-steps.md` for the detailed procedure, check-points at each step, and two worked examples. Read it whenever running a full cycle or when the user is stuck on a step.

## The seven wastes (TIMWOOD)

The fast diagnostic. Walk the process and ask which of these are present:

| Waste | Definition | Example |
|---|---|---|
| **T**ransportation | Unnecessary movement of materials/information | Handing a file between three systems |
| **I**nventory | Excess stock or WIP beyond immediate need | Six months of raw material idle; a 40-ticket backlog |
| **M**otion | Unnecessary movement of people | Walking across the floor for a tool |
| **W**aiting | Idle time between steps | Orders sitting in an approval queue |
| **O**ver-production | Making more than is needed, or earlier than needed | Printing 1,000 reports when 100 are read |
| **O**ver-processing | More work than the customer requires | Triple-checking a non-critical form |
| **D**efects | Output requiring rework or scrap | Bugs, rejects, returns |

Often an **8th waste — unused talent**: people whose ideas aren't heard or skills aren't used.

For anything but a trivial process, map the flow before hunting waste — you can't see waiting and inventory without seeing the whole stream. See `references/lean-and-dmaic.md` for value stream mapping, the waste-to-countermeasure patterns, and Six Sigma metrics (DPMO, sigma level, Cp/Cpk, MSA).

Use `assets/waste-analysis-template.md` for a quick waste diagnosis, and `assets/a3-template.md` for a full QC Story cycle.

## Non-negotiable rules

These are where most attempts fail. Enforce them, and say so out loud when the user violates one.

- **Factors ≠ cause.** A factor is anything influencing the characteristic — there are many. A cause is what actually triggered *this* result — usually one. Step 4 is the funnel from many to one, and it must be closed with **data or verification**, not a vote.
- **The characteristic must be measurable.** "Pizza is bad" is a problem statement. "The crust is too hard" is a characteristic. You can only build an Ishikawa on the latter.
- **Verify the same metric in Step 6 that you baselined in Step 2.** Switching metrics mid-cycle is the most common way to fake a win.
- **No effect ⇒ go back to Step 2, not Step 5.** If the countermeasure didn't work, the fault is almost always upstream: wrong characteristic, wrong factor, unverified assumption. Don't just try another countermeasure.
- **Countermeasures must be permanent, not reactive.** Is this a fix or a bandage? Will it create a new problem elsewhere?
- **Stratify before concluding.** Aggregate data hides everything. The classic case: an ice-cream stand sees a weak temperature/customer correlation, until it stratifies weekday vs. weekend and finds two clean, separate relationships.
- **No data ⇒ no analysis.** Without a baseline you cannot compute an improvement, and you cannot verify a cause. If there's no data, help design a check sheet and collect it. Improvising an analysis on nothing is worse than admitting the gap.

## Working with the user

Establish the gap first. Before touching any tool, get:
- Current condition, with numbers if any exist.
- Target, with numbers and a deadline.
- What data exists, and how it could be stratified (time, person, machine, method, material, measurement, location).

Be a coach, not an oracle. The user's team holds the domain knowledge; the method's job is to organize it. Ask what the data says rather than guessing at causes. When you *do* propose factors — brainstorming a fishbone, say — mark them explicitly as hypotheses to be verified, never as findings.

**Handle jumps to solutions.** "We need a new machine" or "we should retrain the team" is a Step 5 answer to an unasked Step 1–4. Don't refuse, and don't lecture. Take the proposal seriously, then walk it backwards: what characteristic would this improve, and how would you know it worked? Usually the user finds the gap themselves.

**Match the depth to the ask.** Not every question deserves eight steps. "What's a Pareto chart?" wants an answer, not a kaizen project. "Why do we keep shipping late?" wants the cycle. The method is a toolkit, not a ritual.

## Seven QC Tools

| # | Tool | Use it to | Mostly in step |
|---|---|---|---|
| 1 | Graph (bar/line/pie/radar/band) | Make data visible | All |
| 2 | **Pareto chart** | Prioritize — 80% of effects from 20% of causes | 1, 2, 6 |
| 3 | **Check sheet** | Collect data without omission or error | 2 |
| 4 | **Histogram** | See the *distribution* and variation vs. spec limits | 2, 5 |
| 5 | **Scatter diagram** | Test a relationship between two variables | 2, 4 |
| 6 | **Control chart** | Distinguish normal variation from an abnormality over time | 7 |
| 7 | **Ishikawa (cause & effect)** | Organize and stratify factors behind a characteristic | 4 |

**Stratification** is the idea underneath all seven — split data into meaningful groups to expose what the aggregate hides. It is not an eighth tool; it is the reason the other seven work.

Read `references/seven-tools.md` for construction rules, reading rules (histogram shapes, the eight control-chart anomaly rules, correlation bands) and common mistakes. Read it whenever building or interpreting any of these.

## Producing artifacts

**Charts and analysis** — When the user has data, actually build the chart. Use the `xlsx` skill for spreadsheets, or Python (matplotlib/pandas) for one-off analysis. A described Pareto chart is worthless; a drawn one shows where to aim. For a fishbone or process/VSM diagram in chat, the visualizer is a good fit.

**A3 / activity report** — The canonical output of a completed cycle is a single-page A3 covering all eight steps (`assets/a3-template.md`). The discipline is real: if it doesn't fit on one page, the thinking isn't tight enough. Charts over prose, bullets over paragraphs, comprehensible without you there to explain it.

For a deliverable file, use `docx` (report), `pptx` (presentation), or `xlsx` (the analysis itself). Ask which they want rather than assuming.

## Common failure modes

- Selecting a theme too large to solve ("improve quality") — narrow it with a Pareto until it's a specific, ownable gap.
- Setting a target with no number or no deadline.
- Building a fishbone on a vague "problem" instead of a measurable characteristic.
- Treating the fishbone output as the answer. The diagram *generates* hypotheses; the data *selects* among them.
- Stopping at Step 6 because the numbers look good. Without Steps 7–8 the gain evaporates and nothing is learned.
- Blaming people. "Operator carelessness" is never a root cause — ask why the process permitted the error.
- **Trusting the measurement system.** If the gauge varies more than the process, every number downstream is fiction. Check the measurement before analyzing the data (see MSA in the Lean/DMAIC reference).
- **Cutting to the bone.** Zero inventory, zero slack, zero buffer is not efficiency — it's fragility. Some apparent waste is deliberate protection against variability. Ask what a buffer is absorbing before removing it.
- **Mandating from the top.** Improvement designed without the people who do the work fails on contact with reality — and they hold the domain knowledge you need anyway.
