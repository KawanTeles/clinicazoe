# Lean, DMAIC and Six Sigma metrics

The QC Story is the engine; this file covers what sits around it. Read it when the problem is about **flow** (slow, queued, over-processed) rather than **variation**, when the user speaks DMAIC/Six Sigma vocabulary, or when process capability comes up.

Contents:
1. [The value test](#the-value-test)
2. [The seven wastes in depth](#the-seven-wastes-in-depth)
3. [Value stream mapping](#value-stream-mapping)
4. [DMAIC ↔ the eight steps](#dmaic--the-eight-steps)
5. [Six Sigma metrics](#six-sigma-metrics)
6. [Process capability — Cp and Cpk](#process-capability--cp-and-cpk)
7. [MSA — is your measurement even real?](#msa--is-your-measurement-even-real)
8. [Kaizen](#kaizen)
9. [Where Lean can hurt you](#where-lean-can-hurt-you)

---

## The value test

Value is defined by the **customer**, not the producer. An activity adds value only if all three hold:

1. The customer would be willing to pay for it.
2. It transforms the product or service.
3. It's done right the first time.

Fail any one and it's waste. This is a sharper instrument than it looks — it kills a lot of activity people are proud of. Inspection fails test (2): it transforms nothing. Rework fails (3). An internal approval step that exists because nobody trusts the previous step fails (1).

Three categories in practice:
- **Value-adding (VA)** — passes all three. Usually a shockingly small fraction of total lead time; single-digit percentages are common.
- **Non-value-adding but necessary (NVA-N)** — regulatory compliance, safety checks, some accounting. Can't remove today; minimize.
- **Pure waste (NVA)** — remove.

Be careful about promoting things into NVA-N because removing them is hard. "Necessary" means *legally or physically required*, not *politically awkward to cut*.

---

## The seven wastes in depth

**TIMWOOD.** Walk the actual process and hunt for each. Most are invisible from a desk.

| Waste | What it looks like | Common root | Typical countermeasure |
|---|---|---|---|
| **Transportation** | Materials, files, or data moving between locations/systems without changing | Bad layout; systems that don't talk | Co-locate; integrate; eliminate the handoff |
| **Inventory** | Raw material, WIP, finished goods, backlogs, unread queues | Over-production upstream; batch thinking; buffering against unreliability | Pull instead of push; fix the unreliability the buffer hides |
| **Motion** | People walking, reaching, searching, clicking through screens | Poor workstation/UI design; things not where they're used | 5S; relocate; redesign the interface |
| **Waiting** | Work sitting idle: approval queues, machine downtime, waiting on another team | Unbalanced flow; batch handoffs; dependency on a single approver | Level the flow; delegate authority; reduce batch size |
| **Over-production** | Making more, or earlier, than the next step needs | Efficiency measured locally ("keep the machine busy") | Produce to actual demand; change the local metric |
| **Over-processing** | Tighter tolerances, more checks, more features than needed | Nobody asked what the customer requires; distrust of upstream | Define the requirement; fix the upstream quality so the check is unnecessary |
| **Defects** | Rework, scrap, returns, bugs | Process variation — **this is where the QC Story takes over** | Run the eight-step cycle |

**The 8th waste — unused talent.** People with ideas nobody asked for, skills nobody uses. Often the largest of all, and the only one that compounds: a team whose suggestions are ignored stops making them.

**Waste is symptomatic.** Inventory and waiting in particular are usually *consequences* of variability elsewhere. A queue in front of a step means that step is unreliable or under-capacity. Cutting the queue without fixing the cause just moves the pain. This is precisely where Lean hands off to the QC Story: find the variation, run the cycle.

---

## Value stream mapping

Draw the whole flow before optimizing any part of it. Local optimization of a non-bottleneck step improves nothing.

**How:**
1. Pick a product/service family and a customer. Map **one** stream, not the whole business.
2. Walk it backwards, from the customer to the start. Walking it forwards makes you rationalize what exists.
3. For each process step record: cycle time (CT), changeover time, uptime, batch size, number of people, and **inventory/queue between steps**.
4. Draw the information flow above the material flow — what triggers each step? Scheduling chaos hides here.
5. Build the timeline: **process time** (VA) vs. **lead time** (total elapsed).
6. Compute **process cycle efficiency = value-added time ÷ total lead time.** Below 10% is normal. Below 1% is common in office processes. That number is usually what convinces management.

Then map the future state: where does flow break, and what would make it continuous?

**Takt time** = available working time ÷ customer demand. The rhythm the process must hit. Steps faster than takt build inventory; steps slower than takt are the constraint.

---

## DMAIC ↔ the eight steps

Same method, different vocabulary. Translate freely; use whichever the user speaks.

| DMAIC | QC Story steps | What actually happens |
|---|---|---|
| **Define** | 1. Select theme<br>2. (target) | Problem statement, customer, CTQ, project charter, scope. Pareto to prioritize. |
| **Measure** | 2. Grasp actual condition | Baseline the metric. Check sheet, stratification, histogram. **Validate the measurement system first (MSA).** |
| **Analyze** | 4. Analyze factors | Ishikawa, 5-Why, scatter/regression, hypothesis tests. Funnel from factors to verified cause. |
| **Improve** | 5. Countermeasures<br>6. Verify effects | Generate options, pilot, verify against the *same* baseline metric. |
| **Control** | 7. Standardize & control<br>8. Reflect | Control plan, SOP, control chart, handover to the process owner. |

Step 3 (activity plan) has no DMAIC equivalent — DMAIC assumes a project charter does that job.

**Where the QC Story is stronger:** the factor/cause distinction, the discipline of stratification, and the explicit rule that a failed Improve sends you back to Measure rather than to another Improve attempt.

**Where DMAIC is stronger:** it carries a statistical toolkit (hypothesis testing, DOE, regression) and a governance structure (charter, gate reviews, belts) that the QC Story leaves implicit.

**DMADV / DFSS** — when the process doesn't exist yet or is beyond repair: Define, Measure, Analyze, **Design**, **Verify**. Don't improve what should be replaced.

---

## Six Sigma metrics

**DPMO** (defects per million opportunities):

```
DPMO = (defects / (units × opportunities per unit)) × 1,000,000
```

The "opportunities per unit" denominator is where people cheat. Inflate it and your sigma level rises without anything improving. Define it honestly and consistently, or the metric is theater.

**Sigma level** (with the conventional 1.5σ long-term shift):

| Sigma | DPMO | Yield |
|---|---|---|
| 2σ | 308,537 | 69.1% |
| 3σ | 66,807 | 93.3% |
| 4σ | 6,210 | 99.38% |
| 5σ | 233 | 99.977% |
| 6σ | 3.4 | 99.99966% |

Most business processes live at 3–4σ. The jump from 3σ to 4σ is worth far more than the jump from 5σ to 6σ, and costs far less — chase the first one.

**Rolled throughput yield (RTY)** = the product of each step's first-pass yield. Ten steps at 95% each gives 60% overall, not 95%. RTY is what exposes the true cost of a long process with "acceptable" individual steps — and it's the number that justifies removing steps entirely.

---

## Process capability — Cp and Cpk

The numeric version of what the histogram-against-spec-limits comparison shows visually (see `seven-tools.md`).

```
Cp  = (USL − LSL) / 6σ                          → potential capability: is the spread narrow enough?
Cpk = min[ (USL − x̄) / 3σ , (x̄ − LSL) / 3σ ]   → actual capability: is it narrow enough AND centered?
```

- **Cp** ignores centering. **Cpk** doesn't. A process can have Cp = 2.0 (beautifully tight) and Cpk = 0.4 (tight, but sitting on the upper spec limit and producing scrap).
- **Cp = Cpk** ⟺ the process is perfectly centered.
- Rule of thumb: **Cpk ≥ 1.33** is the usual minimum for an ongoing process; **≥ 1.67** for critical characteristics. Cpk < 1.0 means you are producing out-of-spec output right now.

**The diagnostic that matters:** compare Cp and Cpk. Low Cp is a **variation problem** — you must find and remove the source of the spread. Good Cp but low Cpk is a **centering problem** — usually far easier, often just a setting adjustment. Telling these apart before acting saves months.

Capability is only meaningful on a **stable** process. Computing Cpk on a process that's out of control on the control chart is arithmetic on noise.

---

## MSA — is your measurement even real?

The most expensive blind spot in improvement work. Before analyzing any data, ask whether the measurement system can actually see what you're trying to measure.

Total observed variation = process variation + **measurement system variation**. If the second term is large, you are analyzing your gauge, not your process — and every conclusion downstream is fiction.

**Gage R&R** decomposes measurement variation into:
- **Repeatability** — same person, same part, same gauge, different times. Variation here is the equipment.
- **Reproducibility** — different people, same part, same gauge. Variation here is the operators (or the ambiguity of the procedure).

Rule of thumb: **%GRR < 10%** acceptable; **10–30%** marginal, depending on cost and criticality; **> 30%** the measurement system is unusable — fix it before doing anything else.

This applies far beyond manufacturing. If two people classify support tickets differently, your ticket-category Pareto is measuring the classifiers, not the tickets. If "resolution time" starts when the agent picks it up rather than when the customer sent it, you're measuring the wrong thing precisely.

**The Komatsu version of this insight** is already in the histogram shapes: a comb/multimodal distribution usually means the *measurer* is rounding, not that the *process* is bimodal. Same lesson, different route.

---

## Kaizen

Continuous small improvement by the people doing the work. Not a synonym for "improvement project."

The core distinction:
- **Kaizen** — small, frequent, local, cheap, made by frontline workers. Its power is cumulative and cultural.
- **Kaikaku** — large, infrequent, structural, expensive, driven by management.

The QC Story serves both, at different scales.

**Kaizen event / blitz:** a focused 3–5 day cross-functional effort on one process. Works because it removes the usual excuse (no time) and puts everyone who touches the process in one room.

**What makes kaizen actually work** — and it usually doesn't:
- Suggestions must be **acted on visibly**. A suggestion box nobody empties kills the practice permanently; you get one chance.
- Improvements must be **implementable by the person who suggested them**, or the loop is too slow to feel real.
- Standardize the improvement (SDCA), or it reverts the moment attention moves on.
- Frontline buy-in is not a nice-to-have. Top-down improvement mandates fail, both because people resist them and — more importantly — because the people doing the work hold the knowledge you need.

---

## Where Lean can hurt you

Lean applied without judgment produces brittle systems. Take these seriously.

- **Buffers absorb variability.** Inventory, slack time, and spare capacity look like waste on a map, but they're often *protecting* the flow from variation upstream. Remove the buffer without removing the variation and you don't get efficiency — you get an outage. **Fix the variation first, then remove the buffer.** This is exactly why Lean and the QC Story belong together: Lean sees the buffer, the QC Story kills the reason it exists.
- **Efficiency vs. resilience.** A supply chain optimized to zero inventory is optimized to fail under any shock. Some redundancy is a deliberate purchase of robustness, not an oversight. Ask what a buffer is insuring against before cutting it.
- **Local optimization.** Improving a non-bottleneck step improves nothing at all — it just produces inventory faster. Find the constraint first.
- **Utilization is not the goal.** Keeping every machine and every person 100% busy guarantees queues (this is a mathematical property of variable systems, not a management failure). High utilization and short lead times are in direct tension.
- **TIMWOOD applies to internal processes only.** "The market is declining" is not a waste. Don't stretch the framework past where it works.
