# Power BI Premium Design Skill

A cross-compatible skill for Codex and Claude Code. It audits screenshots and reports, defines a design system, creates wireframes, and produces a Design Brief ready for PBIP/PBIR implementation. Supports both **Light Premium** and **Dark Premium** themes with Power BI native shadows, elevation, glow effects, and depth hierarchy.

## Installation in Codex

Copy the entire folder to one of these locations:

- Project: `.agents/skills/powerbi-premium-design/`
- User: `~/.agents/skills/powerbi-premium-design/`

Then invoke it with:

```text
$powerbi-premium-design Analyze this screenshot and redesign the page.
```

## Installation in Claude Code

Copy the entire folder to:

- Project: `.claude/skills/powerbi-premium-design/`
- User: `~/.claude/skills/powerbi-premium-design/`

Then invoke it with:

```text
/powerbi-premium-design Analyze this screenshot and redesign the page.
```

## Recommended integration with Microsoft's official skills

Also install the `powerbi-report-design` and `powerbi-report-authoring` skills from Microsoft's official `skills-for-fabric` repository. This custom skill acts as the visual-identity, premium-pattern, and quality-assurance layer, while the official authoring skill should handle PBIR/PBIP editing.

In GitHub Copilot CLI, the official bundle can be installed with:

```text
/plugin marketplace add microsoft/skills-for-fabric
/plugin install powerbi-authoring@fabric-collection
```

## Recommended workflow

1. Save the report as PBIP with PBIR enabled.
2. Create a Git commit or backup copy.
3. Provide the screenshot and PBIP folder to the agent.
4. Run `powerbi-premium-design` to generate the diagnosis and brief.
5. Run `powerbi-report-authoring` to implement the design.
6. Reload the report in Power BI Desktop, capture a screenshot, and repeat QA until the score is at least 85.

## Theme modes

The skill supports two theme modes. The agent will ask or infer which one to use:

| | Light Premium | Dark Premium |
|---|---|---|
| **Best for** | Bright offices, printed reports, financial statements | Dim boardrooms, NOC/SOC screens, executive wall displays |
| **Canvas** | `#F4F6F8` | `#1A1E2B` |
| **Shadow usage** | Subtle, 1 visual max | Active, 3-level elevation system |
| **Glow effects** | Rarely | KPI cards with accent border glow |
| **Assets** | `premium-light-theme.json` | `premium-dark-pareto.json` or `premium-dark-performance.json` |

## Suggested starter prompts

### Light theme redesign

```text
Use the powerbi-premium-design skill to analyze the current page and redesign it.
Audience: finance managers and department owners.
Objective: quickly identify the most important variances between Budget and Actual.
Preserve the corporate identity, but remove heavy shadows, scrollbars, and technical field names.
Deliver a diagnosis, wireframe, design tokens, changes by visual, and an implementation-ready YAML Design Brief.
When PBIP/PBIR files are available, hand the brief to powerbi-report-authoring and validate the result with a screenshot.
```

### Dark theme redesign

```text
Use the powerbi-premium-design skill to redesign this page as a dark premium dashboard.
Theme mode: Dark Premium (Performance Cyan Dark).
Audience: executive leadership viewing on a wall display in a dim boardroom.
Objective: monitor seller performance, revenue trends, and goal achievement at a glance.
Apply surface hierarchy with 3-4 depth levels, cyan accent, gradient area charts, and glow KPI cards.
Deliver a diagnosis, wireframe, dark design tokens, elevation plan, changes by visual, and an implementation-ready YAML Design Brief.
When PBIP/PBIR files are available, hand the brief to powerbi-report-authoring and validate the result with a screenshot.
```

## What's inside

```
powerbi-premium-design-skill/
├── SKILL.md                              # Main skill (theme-agnostic workflow)
├── README.md                             # This file
├── references/
│   ├── design-system.md                  # Design tokens (Light + Dark), elevation, glow
│   ├── chart-patterns.md                 # Chart patterns for both themes
│   └── review-rubric.md                  # 100-point scoring with theme-specific criteria
├── templates/
│   └── design-brief.yaml                 # Implementation contract (v2, theme-aware)
├── examples/
│   ├── variance-analysis-redesign.md     # Light Premium example
│   └── dark-performance-redesign.md      # Dark Premium example
└── assets/
    ├── premium-light-theme.json           # Light theme JSON
    ├── premium-dark-pareto.json           # Dark theme JSON (orange accent, analytical)
    └── premium-dark-performance.json      # Dark theme JSON (cyan accent, executive)
```

## Key principles

- **Zero Figma**: Every technique uses only Power BI native capabilities (Format → Shadow, Format → Glow, Border radius, Background transparency, Gradient fill).
- **Shadows with purpose**: The elevation system maps shadow levels to information hierarchy, not decoration.
- **Concrete formatting**: All values are exact (hex, px, opacity) — ready to type into the Power BI Format pane.
- **Theme-agnostic workflow**: The same 9-step process works for light and dark themes. Only the tokens and rules change.
