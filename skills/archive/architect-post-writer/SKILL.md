---
name: architect-post-writer
description: |
  Write tutorial-style technical architect posts combining educational content with hand-drawn infographic prompts.
  Use this skill when asked to: (1) Write an architect/system design post, (2) Create technical tutorial content with infographics,
  (3) Draft posts about AI systems, RAG, agents, backend architecture, or distributed systems,
  (4) Create whiteboard-style diagram prompts for social media. The skill produces both long-form (newsletter) and
  short-form (LinkedIn) versions, plus detailed artwork prompts in sketchnote/whiteboard style.
  Topics: Agentic AI, RAG, Vector DBs, LLM observability, backend architecture, system design.
---

# Architect Post Writer

Write technical tutorial posts (300-1500 words) with accompanying infographic prompts for LinkedIn and social media. Target audience: AI architects, senior engineers, system designers.

## Post Format

Every architect post has THREE components:

```
1. Long Version (Blog/Newsletter) - 500-1500 words
2. Short Version (LinkedIn Post) - 200-400 words
3. Artwork Prompt - Detailed whiteboard diagram instructions
```

## Post Structure

### Long Version Template

```markdown
# [Title]

## Long Version (Blog/Newsletter)

[Hook - contrarian statement or problem observation]

[Context - 1-2 paragraphs explaining the problem]

I sketched out this [diagram/visual/architecture] to [explain/show/break down] [topic].

Here's what most teams miss:

**1. [Key Point]**

[2-3 paragraphs of technical depth with examples]

**2. [Key Point]**

[2-3 paragraphs with code snippets or technical details]

**3. [Key Point]**

[2-3 paragraphs]

[Continue for 3-6 key points...]

**[Summary insight or pattern name]**

[Closing paragraph tying it together]

[Engagement question]

---

## Short Version (LinkedIn Post)

[Condensed 200-400 word version]

---

## Artwork Prompt

[Detailed infographic instructions]

---

## Sources

[Research links]
```

## Voice & Tone

- **Authoritative but educational** - "I've seen this pattern dozens of times"
- **Production-focused** - Not demos, real systems at scale
- **Technical depth** - Real architecture concepts, not surface level
- **Direct observations** - "Here's what most engineers miss"
- **System designer perspective** - Think in components, flows, trade-offs

### Hook Patterns

Start with problem observations or contrarian statements:

```
"Everyone is building 'AI Agents' right now. But connecting an LLM to a couple of tools in a notebook is a very different beast than shipping a reliable, secure agent to production."

"If you're only logging prompts and responses, you're flying blind."

"Every AI startup I advise makes the same mistake."

"Most people start building AI projects by writing .py files. But sustainable, production-ready generative AI isn't built on code alone."

"We often blame the LLM when a RAG system gives a bad answer. But 9 times out of 10, it's not a model failure. It's a context failure."
```

### "I Sketched" Transition

Always connect to the visual:

```
"I sketched out this observability stack to show what production actually needs."
"I put together this visual deep dive to explain why..."
"I created this visual guide to map out the journey from..."
"This diagram perfectly visualizes the gap between a POC and a production system."
```

### Numbered Breakdown Style

Use bold numbered points with technical depth:

```markdown
**1. Distributed Tracing Is Non-Negotiable.**

A single user request can trigger multiple LLM calls. A RAG pipeline hits an embedding model, then a reranker, then the generator. An agent loops through tool calls. Each step needs a span.

[Technical details, code examples, tool recommendations]

**2. Token Attribution Is Harder Than You Think.**

[Deep explanation with real-world implications]
```

### Phase/Stage Breakdowns

For pipeline or workflow explanations:

```markdown
**Phase 1: Ingestion & Prep**
Everything starts with data hygiene.
- Source ID & Ingestion: Handling PDFs, APIs, and Wikis.
- Chunking: The most underrated step.

**Phase 2: Indexing & Storage**
[Details...]

**Phase 3: Retrieval & Refinement**
[Details...]
```

## Content Patterns

### Technical Depth Examples

Show real code, real tools, real numbers:

```markdown
OpenTelemetry now has GenAI semantic conventions. Use them:
- `gen_ai.operation.name`: "chat", "embeddings", "invoke_agent"
- `gen_ai.usage.input_tokens` and `gen_ai.usage.output_tokens`
- `gen_ai.request.model`: which model handled this span
```

```markdown
At 1 million connections with 4 KB each, you're at 4 GB RAM just for connection overhead—before any application state.
```

### Warning Callouts

Highlight common mistakes:

```markdown
**The biggest takeaway?** Simple RAG is just a baseline. It works for demos, but production demands more.
```

```markdown
If you skip the middle steps (Metadata, Reranking, Optimization), you will likely struggle with hallucinations.
```

### Real Company References

Ground concepts in reality:

- "This is why OpenAI, Anthropic, and every major LLM provider chose SSE"
- "The patterns that separate amateur implementations from production-grade systems used by Netflix and Amazon"
- "Tools like Langfuse, LangSmith, and Traceloop/OpenLLMetry give you this out of the box"

## Short Version Guidelines

Condense to 200-400 words:
- Keep the hook
- Keep numbered points but shorter explanations
- Keep the key insight
- Keep the engagement question
- Reference the artwork: "Artwork Path: [image](/path/to/image.jpeg)"

## Engagement Questions

End with system-design focused questions:

```
"What's your observability stack look like? Are you past Stage 0?"
"Which step do you find teams most often overlook?"
"What's been the hardest part of maintaining your current system?"
"What's your experience been? Have you hit WebSocket scaling walls?"
"What is the hardest part of this diagram to implement in your experience?"
```

## Topics & Domains

Primary:
- Agentic AI / Multi-Agent Systems
- RAG & Vector Databases
- LLM Observability & Monitoring
- AI System Design
- Backend Architecture Patterns
- Real-time Communication (WebSockets, SSE)
- Cost Attribution & Token Economics

Secondary:
- Event-Driven Architecture
- API Design (gRPC vs REST)
- Memory Architecture for Agents
- Guardrails & Safety Systems
- Networking for AI Systems

## Sources Section

Always include research sources:

```markdown
## Sources

Research compiled from:
- [Source Title](URL)
- [Source Title](URL)
...
```

## Artwork Prompt

See [references/sketchnote-style.md](references/sketchnote-style.md) for the complete visual style guide.

### Artwork Prompt Template

```markdown
## Artwork Prompt (Whiteboard System Design Style)

**HARD CONSTRAINT:** Output image must be exactly 1280×1588 px (portrait). Do not change or approximate.

**Title:** "[Post Topic]"

**Style:** Hand-drawn whiteboard diagram with yellow highlighted boxes, clean flowchart arrows, professional but approachable. White/off-white background with subtle whiteboard texture. Black line work, yellow fills for key components, blue for data flow arrows.

**Layout:** [Describe overall structure - vertical stack, split comparison, radial, etc.]

**Components to Include:**

**Header Section:**
- Title: "[Title]" in bold hand-drawn style
- Subtitle: "[Subtitle]"

**[Section 1 Name]:**
[ASCII diagram showing layout]
- [Annotations and details]

**[Section 2 Name]:**
[ASCII diagram or description]

**Key Insight Box (Bottom Center):**
Large yellow highlighted box:
"[Main takeaway quote]"

**Visual Callouts:**
- [Icon/annotation descriptions]

**Color Palette:**
- Background: Off-white (#F5F5F5)
- Boxes: Yellow fill (#FFF9C4) with black outline
- Arrows: Blue (#1976D2)
- Text: Black (#212121)
- Warnings: Red (#D32F2F)
- Success: Green (#388E3C)
```

## What NOT to Do

- No surface-level explanations (go deep)
- No generic examples (use real tools, real numbers)
- No demo-focused advice (production mindset)
- No missing the "why" behind decisions
- No artwork prompts without specific dimensions and color codes
- No posts without both long and short versions
