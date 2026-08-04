# Waste Analysis — TIMWOOD

The fast diagnostic. Use for a flow problem (slow, queued, over-processed). For a variation problem (inconsistent, defective), use `a3-template.md` and run the full eight-step cycle.

**Process:** {name, from what trigger to what outcome}
**Customer of this process:** {who receives the output}
**Key metric:** {lead time / cost / error rate}
**Current performance:** {baseline, with n and period}

---

## 1. Flow

Map the steps before hunting waste — waiting and inventory are invisible without the whole stream.

| # | Step | Process time (VA) | Wait/queue before | Owner |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |

- **Total lead time:** {elapsed}
- **Value-added time:** {sum of VA}
- **Process cycle efficiency:** VA ÷ lead time = **{X%}** ← usually the number that convinces anyone
- **Takt time:** available time ÷ demand = {}

## 2. Waste identification

| Waste | Present? | Description | Impact (H/M/L) | Evidence |
|---|---|---|---|---|
| **T**ransportation | Y/N | | | |
| **I**nventory | Y/N | | | |
| **M**otion | Y/N | | | |
| **W**aiting | Y/N | | | |
| **O**ver-production | Y/N | | | |
| **O**ver-processing | Y/N | | | |
| **D**efects | Y/N | | | |
| *Unused talent* | Y/N | | | |

The **evidence** column is not optional. "Waiting: H" with nothing behind it is a guess. Cite the observation, the timestamp, the queue length.

## 3. Value test on each candidate

For every activity you propose to cut:

| Activity | Customer would pay? | Transforms? | Right first time? | Verdict |
|---|---|---|---|---|
| | Y/N | Y/N | Y/N | VA / NVA-necessary / **waste** |

"Necessary" means legally or physically required — not politically awkward to remove.

## 4. Before you cut

Two questions per item, and they're the ones that separate this from vandalism:

- **What is this buffer absorbing?** Inventory and slack usually protect the flow from variation upstream. Remove the buffer without removing the variation and you get an outage, not efficiency.
- **Is this step the constraint?** Optimizing a non-bottleneck improves nothing — it just produces inventory faster.

## 5. Countermeasures

| Waste | Countermeasure | Owner | By when | Expected effect (in numbers) |
|---|---|---|---|---|

## 6. Handoff to the QC Story

Waste that turns out to be *caused by variation* — defects, and any queue that exists because a step is unreliable — is not a Lean problem. It's a QC Story problem.

**Carry forward to the eight-step cycle:**
- Characteristic to analyze: {measurable, e.g. "order error rate (%)"}
- Baseline: {} → Target: {} by {}

## 7. Expected impact

- {metric}: {current} → {target} ({X%})
- Process cycle efficiency: {current} → {target}
