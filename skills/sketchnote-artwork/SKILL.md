---
name: sketchnote-artwork
description: |
  Create detailed infographic artwork prompts in hand-drawn sketchnote/whiteboard style.
  Use this skill when asked to: (1) Create an infographic prompt, (2) Generate artwork for a technical topic,
  (3) Design a whiteboard-style diagram, (4) Make a visual for LinkedIn/social media posts.
  Produces detailed prompts with exact dimensions (1280×1588px), color codes, layout structure,
  and content specifications ready for image generation tools.
  Style: Senior engineer's whiteboard notes meets educational diagram.
---

# Sketchnote Artwork Prompt Generator

Create detailed infographic prompts for technical topics in hand-drawn whiteboard style.

## Output Format

Every artwork prompt follows this structure:

```markdown
## Artwork Prompt (Whiteboard System Design Style)

**HARD CONSTRAINT:** Output image must be exactly 1280×1588 px (portrait). Do not change or approximate.

**Title:** "[Topic Title]"

**Style:** [Style description]

**Layout:** [Layout type and structure]

**Components to Include:**

[Detailed section-by-section breakdown with ASCII diagrams]

**Color Palette:**
[Exact hex codes]

**Key Visual Metaphors:**
[List of visual concepts]
```

## Hard Constraints

```
Dimensions: 1280×1588 px (portrait, LinkedIn-optimized)
Style: Technical hand-drawn sketchnote infographic
Aesthetic: Senior engineer's whiteboard notes meets educational diagram
Mood: Dense, precise, reference-worthy, professional
```

## Style Definition

```
Visual Style: Technical hand-drawn sketchnote infographic
Background: Clean white or off-white background (#FAFAF8)
Grid: Subtle dot grid or engineering grid pattern (light gray, 10% opacity)
Texture: Minimal paper texture, not distracting
```

## Color Palette (Use These Exact Codes)

### Primary Colors
```
Primary:      Navy blue (#1E3A5F) - main elements, boxes, headers
Accent 1:     Burnt orange/rust (#C54B2A) - highlights, important callouts
Accent 2:     Muted teal (#3D8B8B) - arrows, connectors, secondary elements
Neutral:      Warm gray (#6B6B6B) - annotations, secondary text
Background:   Off-white (#FAFAF8)
```

### Functional Colors
```
Highlight:    Yellow fill (#FFF9C4) - key boxes, important sections
Warnings:     Red (#D32F2F) - errors, anti-patterns, caution
Success:      Green (#388E3C) - correct approaches, checkmarks
Info:         Blue (#1976D2) - data flow, information callouts
```

## Typography Rules

```
Headers: Bold hand-lettered, slightly uneven baseline, ALL CAPS or Title Case
Subheaders: Medium weight hand-drawn, sentence case
Body/annotations: Light hand-written style, smaller size, informal
Code snippets: Monospace-inspired hand lettering, consistent character width
Hierarchy: Clear 3-level size difference (header > subheader > annotation)
```

## Layout Types

### 1. Mind-Map / Radial
Best for: Concept breakdowns, pattern relationships, DDD diagrams

```
                    [BRANCH 1]
                        │
    [BRANCH 6]──────────┼──────────[BRANCH 2]
                        │
                   ┌────┴────┐
                   │ CENTER  │
                   │ CONCEPT │
                   └────┬────┘
                        │
    [BRANCH 5]──────────┼──────────[BRANCH 3]
                        │
                    [BRANCH 4]
```

Center: Main concept in hexagon, rounded rectangle, or badge
Branches: 4-6 main branches radiating outward, evenly spaced
Sub-elements: Nested under each branch with smaller containers

### 2. Vertical Stack / Pipeline
Best for: Data flows, RAG pipelines, processing stages

```
┌─────────────────────────────────────┐
│             [HEADER]                 │
├─────────────────────────────────────┤
│         ┌─────────────┐             │
│         │   INPUT     │             │
│         └──────┬──────┘             │
│                ▼                     │
│         ┌─────────────┐             │
│         │  PROCESS 1  │             │
│         └──────┬──────┘             │
│                ▼                     │
│         ┌─────────────┐             │
│         │  PROCESS 2  │             │
│         └──────┬──────┘             │
│                ▼                     │
│         ┌─────────────┐             │
│         │   OUTPUT    │             │
│         └─────────────┘             │
├─────────────────────────────────────┤
│        [KEY INSIGHT BOX]            │
└─────────────────────────────────────┘
```

### 3. Split Comparison
Best for: Technology comparisons, trade-off analysis

```
┌─────────────────┬─────────────────┐
│    OPTION A     │    OPTION B     │
├─────────────────┼─────────────────┤
│ • Feature 1     │ • Feature 1     │
│ • Feature 2     │ • Feature 2     │
│ • Feature 3     │ • Feature 3     │
├─────────────────┴─────────────────┤
│         DECISION CRITERIA          │
│    "If X → A. If Y → B."          │
└───────────────────────────────────┘
```

### 4. Pillar / Column Design
Best for: Principles, architectural layers, foundations

```
┌───────────────────────────────────────┐
│           [OUTCOME/ROOF]               │
├───────────┬───────────┬───────────────┤
│  PILLAR 1 │  PILLAR 2 │   PILLAR 3    │
│           │           │               │
│ • Point   │ • Point   │ • Point       │
│ • Point   │ • Point   │ • Point       │
├───────────┴───────────┴───────────────┤
│           [FOUNDATION]                 │
└───────────────────────────────────────┘
```

### 5. Decision Tree / Flowchart
Best for: Decision guides, troubleshooting, mode selection

```
         ┌─────────────┐
         │  DECISION   │
         │   POINT     │
         └──────┬──────┘
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
    [PATH A] [PATH B] [PATH C]
        │       │       │
        ▼       ▼       ▼
   [RESULT] [RESULT] [RESULT]
```

### 6. Layered Architecture
Best for: System architecture, stack diagrams

```
┌─────────────────────────────────────┐
│           PRESENTATION              │
├─────────────────────────────────────┤
│           APPLICATION               │
├─────────────────────────────────────┤
│             DOMAIN                  │
├─────────────────────────────────────┤
│          INFRASTRUCTURE             │
└─────────────────────────────────────┘
```

## Visual Elements

### Line Work
```
Lines: Hand-drawn with slight imperfection, 2-3px weight
Arrows: Hand-drawn directional, slightly curved, varied heads
Boxes: Rounded corners, slightly wobbly hand-drawn edges
Boundaries: Dotted/dashed for groupings, solid for containers
Connectors: Curved flowing lines, not rigid straight lines
```

### Icons (Simple Line Style)
```
Database:       Cylinder shape
API/Service:    Rounded rectangle
User:           Simple stick figure
Process:        Gear/cog
Event:          Lightning bolt
Error:          X mark or warning triangle
Success:        Checkmark
Decision:       Diamond shape
Memory:         Brain icon
Tool:           Wrench or hammer
Cloud:          Cloud shape
Lock:           Padlock
```

### Callout Types
```
Key Insight:    Large yellow box (#FFF9C4) with black border
Warning:        Red border (#D32F2F), warning icon
Tip/Success:    Green border (#388E3C), checkmark
Info:           Blue border (#1976D2), info icon
Code Block:     Rounded rectangle, monospace text
```

## Content Sections to Include

Every artwork prompt should specify:

1. **Header Section**
   - Title in bold hand-drawn style
   - Subtitle or tagline
   - Optional author/source attribution

2. **Main Content Sections**
   - 3-6 major sections based on topic
   - Each with ASCII diagram showing layout
   - Specific labels, annotations, code snippets

3. **Key Insight Box**
   - Bottom center or prominent position
   - Main takeaway in quotes
   - Yellow highlighted with black border

4. **Visual Callouts**
   - Warning icons for anti-patterns
   - Checkmarks for best practices
   - Annotations with leader lines

5. **Color Specifications**
   - Exact hex codes for all elements
   - Which colors for which components

## Quality Markers

```
✓ Looks hand-drawn but intentional (not sloppy)
✓ Information-dense but scannable
✓ Technical accuracy in terminology
✓ Clear visual hierarchy
✓ Professional enough for LinkedIn/conference slides
✓ Distinctive enough to be memorable
✓ Readable at 50% thumbnail size
✓ Every element has a purpose - no filler decorations
```

## Example: Complete Artwork Prompt

```markdown
## Artwork Prompt (Whiteboard System Design Style)

**HARD CONSTRAINT:** Output image must be exactly 1280×1588 px (portrait). Do not change or approximate.

**Title:** "RAG Pipeline Architecture"

**Style:** Technical hand-drawn sketchnote infographic. Senior engineer's whiteboard notes meets educational diagram. White/off-white background with subtle dot grid. Black line work, yellow fills for key components, blue for data flow arrows.

**Layout:** Vertical pipeline flow with side annotations.

**Components to Include:**

**Header Section:**
- Title: "RAG PIPELINE" in bold hand-lettered ALL CAPS
- Subtitle: "From Documents to Answers"

**Section 1 - Ingestion (Top):**
```
┌─────────────────────────────────────┐
│  [PDF icon] [API icon] [Wiki icon]  │
│         ↓        ↓        ↓         │
│      ┌─────────────────────┐        │
│      │    CHUNKING         │        │
│      │  "Overlapping       │        │
│      │   windows"          │        │
│      └──────────┬──────────┘        │
└─────────────────┼───────────────────┘
```
- Yellow box for chunking step
- Annotation: "Most underrated step"

**Section 2 - Embedding & Storage (Middle):**
```
         ┌─────────────┐
         │  EMBEDDING  │
         │   MODEL     │
         └──────┬──────┘
                │
    [0.12, -0.83, 0.44...]
                │
                ▼
         ┌─────────────┐
         │   VECTOR    │
         │    STORE    │
         └─────────────┘
```
- Show vector numbers flowing
- Icons for Pinecone, Weaviate, Qdrant

**Section 3 - Retrieval (Lower Middle):**
```
[User Query] → [Query Embedding] → [Similarity Search]
                                          │
                                   ┌──────┴──────┐
                                   │  RERANKING  │
                                   └──────┬──────┘
                                          │
                                   [Top-K Results]
```
- Annotation: "Reranking = quality boost"

**Section 4 - Generation (Bottom):**
```
┌─────────────────────────────────────┐
│  [Context] + [Query] → [LLM] → [Answer] │
└─────────────────────────────────────┘
```
- Claude/GPT icon
- Annotation: "Context is everything"

**Key Insight Box (Bottom Center):**
Large yellow highlighted box:
"If your RAG hallucinates, check retrieval before blaming the model."

**Side Annotations:**
- Left: "Phase 1: Prep", "Phase 2: Index", "Phase 3: Retrieve", "Phase 4: Generate"
- Right: Token counts, latency indicators

**Visual Callouts:**
- Red warning next to "No reranking": "Hallucination risk"
- Green checkmark next to "Hybrid search": "Best practice"
- Blue info icon: "HTTP/2 recommended"

**Color Palette:**
- Background: Off-white (#FAFAF8)
- Grid: Light gray dot pattern (10% opacity)
- Primary boxes: Navy blue outline (#1E3A5F)
- Highlight boxes: Yellow fill (#FFF9C4)
- Data flow arrows: Blue (#1976D2)
- Annotations: Warm gray (#6B6B6B)
- Warnings: Red (#D32F2F)
- Success: Green (#388E3C)
- Accents: Burnt orange (#C54B2A), Muted teal (#3D8B8B)

**Key Visual Metaphors:**
- Pipeline as vertical flow
- Vectors as floating numbers
- Reranking as a filter/funnel
- LLM as brain icon
```

## Process

When asked to create an artwork prompt:

1. **Identify the topic** - What concept needs visualization?
2. **Choose layout type** - Which structure best fits the content?
3. **Map content sections** - What are the 3-6 main components?
4. **Add technical details** - Code snippets, labels, annotations
5. **Include key insight** - What's the main takeaway?
6. **Specify visual callouts** - Warnings, tips, icons
7. **Apply color palette** - Use exact hex codes
8. **Verify completeness** - All sections have ASCII diagrams and details
