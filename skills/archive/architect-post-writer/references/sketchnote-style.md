# Sketchnote Style Guide for Architect Posts

A reusable style guide for creating technical hand-drawn infographics. Use this when generating artwork prompts.

## Core Style Definition

```
Style: Technical hand-drawn sketchnote infographic
Aesthetic: Senior engineer's whiteboard notes meets educational diagram
Mood: Dense, precise, reference-worthy, professional
Dimensions: 1280×1588 px (portrait, LinkedIn-optimized)
```

## Background Options

### Light Mode (Default)
```
Base: Clean white or off-white background (#F5F5F5 or #FAFAF8)
Grid: Subtle engineering grid or dot pattern (light gray, 10% opacity)
Texture: Minimal paper texture, not distracting
```

### Dark Mode (Alternative)
```
Base: Matte dark charcoal (#2D2D2D)
Text: Light colors for contrast
Accents: Same palette, adjusted for dark background
```

## Color Palette

### Primary Palette
```
Primary:     Navy blue (#1E3A5F) - main elements, boxes, text
Accent 1:    Burnt orange/rust (#C54B2A) - highlights, important callouts
Accent 2:    Muted teal (#3D8B8B) - arrows, connectors, secondary elements
Neutral:     Warm gray (#6B6B6B) - annotations, secondary text
Background:  Off-white (#FAFAF8) or dark charcoal (#2D2D2D)
```

### Functional Colors
```
Warnings:    Red (#D32F2F) - errors, anti-patterns, problems
Success:     Green (#388E3C) - correct approaches, checkmarks
Info:        Blue (#1976D2) - data flow, information callouts
Highlight:   Yellow fill (#FFF9C4) - key boxes, important sections
```

## Typography & Lettering

```
Headers: Bold hand-lettered, slightly uneven baseline, ALL CAPS or Title Case
Subheaders: Medium weight hand-drawn, sentence case
Body/annotations: Light hand-written style, smaller size, informal
Code snippets: Monospace-inspired hand lettering, consistent character width
Hierarchy: Clear 3-level size difference (header > subheader > annotation)
```

## Layout Structures

### Mind-Map / Radial (for concepts)
```
Center: Main concept in bold container (hexagon, rounded rectangle, or badge)
Branches: 4-6 main branches radiating outward, evenly spaced
Sub-elements: Nested under each branch with indentation or smaller containers
Flow: Clockwise or logical grouping by relationship
```

### Vertical Stack (for pipelines/flows)
```
Top: Input or starting point
Middle: Processing layers stacked vertically
Bottom: Output or results
Arrows: Flowing downward between layers
Side annotations: Metrics, callouts alongside main flow
```

### Split Comparison (for vs posts)
```
Left side: Option A with its characteristics
Right side: Option B with its characteristics
Middle: Shared elements or decision criteria
Bottom: Decision box with clear guidance
```

### Pillar Design (for principles)
```
Columns: 3-5 vertical pillars representing principles
Foundation: Base bar showing how they connect
Top: Shared "roof" showing the outcome
```

## Line Work & Containers

```
Lines: Hand-drawn with slight imperfection, consistent 2-3px weight
Arrows: Hand-drawn directional arrows, slightly curved, varied heads
Boxes: Rounded corners, hand-drawn edges (slightly wobbly, not perfect)
Boundaries: Dotted or dashed lines for groupings, solid for containers
Connectors: Curved flowing lines between related concepts, not rigid
```

## Icons & Visual Elements

```
Style: Simple line icons, minimal detail, recognizable at small size
Stroke: Consistent with main line weight
Fill: Outline only, or single accent color fill
Types: Geometric shapes, simple metaphors (gear, lightning, database cylinder, arrows)
Density: 1 icon per major concept, not overly decorated
```

### Common Icons
- Database: Cylinder
- API/Service: Rounded rectangle
- User: Simple figure
- Process: Gear/cog
- Event: Lightning bolt
- Error: X mark or warning triangle
- Success: Checkmark
- Flow: Curved arrow
- Decision: Diamond

## Technical Elements

### Code Blocks
```
Container: Rounded rectangle with monospace-style hand lettering
Syntax hints: Use indentation, brackets, colons to suggest code structure
Style: Pseudo-code that's readable, not syntax-perfect
Font feel: Consistent character width, slightly informal
```

### Annotations
```
Style: Small handwritten notes with leader lines pointing to elements
Placement: Around main elements, not overlapping
Purpose: Add context, explain "why", highlight gotchas
```

### Callout Boxes
```
Key insights: Large yellow box with black border
Warnings: Red border, warning icon
Tips: Green border, checkmark icon
Info: Blue border, info icon
```

## Composition Rules

1. Center anchors the entire composition
2. Most important concepts larger and closer to center
3. Related items visually grouped with subtle boundaries
4. Arrows show relationships and data/control flow
5. Color used sparingly for emphasis, not decoration
6. Every element has a purpose - no filler decorations
7. Readable at both full size and 50% thumbnail

## Quality Markers

```
✓ Looks hand-drawn but intentional (not sloppy)
✓ Information-dense but scannable
✓ Technical accuracy in terminology
✓ Clear visual hierarchy
✓ Professional enough for LinkedIn/conference slides
✓ Distinctive enough to be memorable
✓ Works at thumbnail size
```

## ASCII Diagram Templates

Use these templates in artwork prompts to show layout:

### Vertical Flow
```
┌─────────────────────────────────────┐
│             [HEADER]                 │
│           "Subtitle text"            │
├─────────────────────────────────────┤
│                                      │
│         ┌─────────────┐             │
│         │   INPUT     │             │
│         └──────┬──────┘             │
│                │                     │
│                ▼                     │
│         ┌─────────────┐             │
│         │  PROCESS    │             │
│         └──────┬──────┘             │
│                │                     │
│                ▼                     │
│         ┌─────────────┐             │
│         │   OUTPUT    │             │
│         └─────────────┘             │
│                                      │
├─────────────────────────────────────┤
│     [KEY INSIGHT BOX]               │
└─────────────────────────────────────┘
```

### Split Comparison
```
┌─────────────────┬─────────────────┐
│    OPTION A     │    OPTION B     │
├─────────────────┼─────────────────┤
│ • Feature 1     │ • Feature 1     │
│ • Feature 2     │ • Feature 2     │
│ • Feature 3     │ • Feature 3     │
├─────────────────┴─────────────────┤
│         DECISION CRITERIA          │
│    "If X, use A. If Y, use B."    │
└───────────────────────────────────┘
```

### Pillar Layout
```
┌───────────────────────────────────────┐
│           [OUTCOME/ROOF]               │
├───────────┬───────────┬───────────────┤
│  PILLAR 1 │  PILLAR 2 │   PILLAR 3    │
│           │           │               │
│ • Point   │ • Point   │ • Point       │
│ • Point   │ • Point   │ • Point       │
│ • Point   │ • Point   │ • Point       │
├───────────┴───────────┴───────────────┤
│           [FOUNDATION]                 │
└───────────────────────────────────────┘
```

### Radial/Mind-Map
```
                    [BRANCH 1]
                        │
                        │
    [BRANCH 6]──────────┼──────────[BRANCH 2]
                        │
                   ┌────┴────┐
                   │ CENTER  │
                   └────┬────┘
                        │
    [BRANCH 5]──────────┼──────────[BRANCH 3]
                        │
                        │
                    [BRANCH 4]
```

## Example Prompt Structure

```
Create a technical hand-drawn sketchnote infographic about [TOPIC].

=== CONTENT ===

CENTER:
[Main concept with description]

BRANCH/SECTION 1:
[Details, code snippets, annotations]

BRANCH/SECTION 2:
[Details, code snippets, annotations]

[Continue for all sections...]

KEY INSIGHT BOX:
"[Main takeaway quote]"

=== STYLE ===

Visual Style: Technical hand-drawn sketchnote infographic
Background: Clean white background with subtle dot grid
Colors: Navy blue primary (#1E3A5F), burnt orange accents (#C54B2A), muted teal connectors (#3D8B8B)
Typography: Hand-lettered headers (ALL CAPS), monospace code snippets
Layout: [Radial / Vertical / Split / Pillar]
Elements: Hand-drawn boxes, curved arrows, simple line icons
Quality: Dense but scannable, professional, LinkedIn-ready

Dimensions: 1280×1588 px (portrait)
```
