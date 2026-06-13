---
name: figma-implementation-contract
description: Create a separate Figma Implementation Contract markdown file from an existing implementation plan for UI/design work. Use when the user asks to generate, add, or update a Figma contract from an implementation plan, especially when they require Figma MCP discovery, component-map mapping, token mapping, measurements, visual-test decisions, conflicts/gaps, and no coding yet.
---

# Figma Implementation Contract

Create or update a standalone Figma Implementation Contract file from an existing implementation plan. Do not implement UI code while using this skill unless the user separately approves implementation.

## Prerequisite Check

- If Figma MCP/plugin tools are available, use them for every Figma link/node in scope.
- If Figma tools are unavailable, ask the user to connect/enable the Figma MCP/plugin or provide exported screenshots/metadata.
- If the user chooses to continue without Figma access, create the contract with explicit `Figma access unavailable` gaps. Do not invent measurements, tokens, variables, component names, variants, or visual states.
- If no Figma link/node exists in the plan/spec, record that as a gap and continue from written specs and code evidence only.

## Workflow

1. Locate the implementation plan.
   - If the user gives a path, use that file.
   - If not, find the relevant plan under `docs/dev-technical-docs/implementation-plans/`.
   - Keep the implementation plan in its own format. Do not merge the contract into it unless the user explicitly asks.

2. Discover and read available project docs before writing the contract.
   - Feature spec named by the plan.
   - All linked or named design-system specs.
   - Design guardrails, component map, styling rules, visual-testing workflow, global styles, and relevant existing components when present.
   - Common paths to check when present: `docs/design-specs/design-guardrails.md`, `docs/design-specs/design-system/component-map.md`, `rules/nextjs-styling-guidelines.md`, `rules/visual-testing-workflow.md`, `src/app/globals.css`, and `src/components`.
   - If a relevant expected doc/path is missing, record it in `Conflicts / Gaps` and continue with available evidence.

3. Run Figma MCP for every Figma link/node in the plan/spec.
   - `get_libraries`
   - `search_design_system`
   - `get_metadata` where structure/measurements are needed
   - `get_design_context`
   - `get_variable_defs`
   - `get_screenshot`
   - If a command is unavailable, record the missing command and affected evidence in `Conflicts / Gaps`.

4. Enforce shared-component reuse.
   - Do not propose feature-local UI when `component-map.md` or `src/components` has a matching shared component.
   - If a shared component is missing a variant, plan to extend the shared component.
   - If a shared component is visually wrong, plan to fix the shared component.
   - If no shared component exists, plan to create one and update `component-map.md`.

5. Create a separate contract file.
   - Place it next to the implementation plan unless the user specifies another location.
   - Recommended name: same date + component/feature + `figma-implementation-contract.md`.
   - Add a short cross-reference from the implementation plan only if useful; preserve both file formats.

6. Do not rely on visual judgment or approximations.
   - Use MCP metadata/context values, variable definitions, screenshots, specs, and existing tokens.
   - Mark unknowns as gaps. Do not invent dimensions, typography, tokens, or states.

## Required Contract Template

Use this exact section structure.

```markdown
## Figma Implementation Contract

### Figma Sources Checked

| Source Type | Name | Link / Node ID | Notes |
| --- | --- | --- | --- |
| Feature Frame |  |  |  |
| Component |  |  |  |
| Variant |  |  |  |
| Responsive Frame |  |  |  |

### MCP Commands Used

Confirm which Figma MCP commands were used:

- [ ] `get_libraries`
- [ ] `search_design_system`
- [ ] `get_metadata`
- [ ] `get_design_context`
- [ ] `get_variable_defs`
- [ ] `get_screenshot`

### Component Mapping

| Figma Element | Figma Node ID | Design-System Spec | Component Map Entry | Existing Code Component | Action |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  | Reuse / Extend / Create / Document Exception |

### Token Mapping

| Figma Value | Type | Existing Token/Class | New Token Needed | Notes |
| --- | --- | --- | --- | --- |
|  | Colour |  |  |  |
|  | Typography |  |  |  |
|  | Spacing |  |  |  |
|  | Radius |  |  |  |
|  | Shadow |  |  |  |
|  | Stroke |  |  |  |

### Layout Measurements

| Element | Width | Height | Padding | Gap | Alignment | Responsive Behaviour |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

### Typography

| Element | Font | Size | Weight | Line Height | Letter Spacing | Token/Class |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

### State Coverage

| Component | Default | Hover | Pressed | Selected | Disabled | Loading | Empty | Error | Focus |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |

### Visual Testing Decision

| UI Area | Figma Baseline Needed | Baseline Path | Visual Test Path | Notes |
| --- | --- | --- | --- | --- |
|  | Yes / No |  |  |  |

### Conflicts / Gaps

Document any conflict between:

- Figma
- feature spec
- design-system spec
- component map
- existing code
- globals.css tokens
- visual test coverage

| Conflict | Source A | Source B | Recommended Resolution |
| --- | --- | --- | --- |
|  |  |  |  |

### Local Override Exceptions

Local UI overrides are only allowed if documented here.

| Override | Reason | Approved Alternative Considered | Risk |
| --- | --- | --- | --- |
|  |  |  |  |
```

## Output Rules

- Create only the contract file unless the user asks to edit the implementation plan cross-reference.
- Keep wording precise and evidence-backed.
- Include exact Figma node IDs, dimensions, padding, gaps, alignment, typography, colours, borders, radius, shadows, icons/assets, variants, states, responsive differences, token mappings, visual-test decision, conflicts, and gaps when available.
- If a required Figma command/tool is unavailable, document the missing command in `Conflicts / Gaps`.
- Final response should link the contract file and mention no code was implemented.
