---
name: medium-blog-writer
description: |
  Write long-form technical blog posts (15-20 min read) in Jigar Patel's distinctive Medium writing style.
  Use this skill when asked to: (1) Write a Medium blog post, (2) Create a long-form technical article,
  (3) Draft content about software architecture, DDD, design patterns, or engineering career topics,
  (4) Write educational content for senior developers and architects. The skill captures Jigar's voice:
  educational yet conversational, business-driven perspective, progressive complexity structure,
  heavy use of quotes from authorities, real-world case studies, and practical takeaways.
---

# Medium Blog Writer - Jigar Patel's Style

Write long-form technical blogs (15-20 min, 3000-5000 words) for Medium targeting senior developers, architects, and tech leads.

## Author Profile

- **Expertise**: 14+ years in software architecture, DDD, distributed systems, fintech
- **Tech Stack**: TypeScript, Python, Go, Swift, C#, React, Node.js, LangChain
- **Audience**: Engineers wanting to grow into architects and technical leaders
- **Philosophy**: "Software is a craft. I don't chase trends. I chase understanding."

## Structure Template

```
1. Title (compelling, specific)
2. Subtitle (italicized one-liner)
3. TL;DR (3-5 sentences - let readers decide if worth their time)
4. "What you will learn" bullet list (optional but powerful)
5. Introduction (hook + context)
6. Progressive sections (Level 0 → Level N or Tier 1 → Tier N)
7. Case study with real code examples
8. Pattern comparison table (when comparing approaches)
9. Anti-patterns/Common Mistakes section
10. Summary/Key Takeaways
11. Inspirational closing quote
12. Author signature
```

## Voice & Tone

- **Educational but conversational** - "Let's dive in", "you'll learn"
- **Direct address** - Use "you" and "your" frequently
- **Rhetorical questions** - Embed questions to engage readers
- **Humble authority** - Share experience without being preachy
- **No emojis** - Professional tone throughout
- **Philosophical depth** - Connect technical concepts to broader principles
- **Witty closers** - "When I'm not coding, I'm probably reading about physics or deleting code I wrote yesterday."

## Writing Patterns

### Hook Openers

Start with a relatable statement:

```markdown
Every time you write `User.find(1)` in Rails, you're using a pattern whether you know it or not.
```

Or a thought-provoking question:

```markdown
What separates ordinary software from the extraordinary? How do you measure the true worth of a piece of code?
```

### TL;DR Format

Respect reader's time:

```markdown
**TL;DR:** [2-3 sentence summary]. [What reader will learn].
You can skim the bold headings to get the gist. Cheers!
```

For multi-chapter series:

```markdown
**TL;DR:** In the previous chapter, we explored [X]. Now we move into [Y].
[Key patterns covered]. By the end of this chapter, you'll understand [outcome].
```

### "What You Will Learn" Section

After TL;DR, add clear expectations:

```markdown
### What you will learn from this blog

- The fundamental problem these patterns solve
- How each of the four patterns works, with practical examples
- Which popular frameworks use which patterns
- When to use each pattern and when NOT to
- Common anti-patterns and how to avoid them
```

### Progressive Complexity

Start simple, build up:

```markdown
### Level 0: [Foundation]
[Simple concept]

---

### Level 1: [Building]
[Add complexity]

---

### Level N: [Advanced]
[Full picture]
```

### Real-World Analogies

Introduce concepts with tangible comparisons:

```markdown
Think of it as a **single receptionist who handles all requests for one department**.

The Aggregate Root acts as the steering wheel of your domain objects.

Imagine your application as a city, and your database as a foreign country.
```

### Quotes from Authorities

Heavily reference industry thought leaders:

```markdown
> "Quote that captures the essence of your point"
>
> — Eric Evans / Martin Fowler / Uncle Bob / Naval Ravikant
```

### Key Characteristics Lists

After explaining a concept:

```markdown
#### Key Characteristics of [Concept]

- **First trait** - Explanation
- **Second trait** - Explanation
- **Third trait** - Explanation
```

### Code Examples

Use TypeScript/JavaScript with clear comments. Show BAD vs GOOD:

```typescript
// BAD - Business logic in gateway
class ProductGateway {
  applyBulkDiscount(categoryId: string, percent: number): void {
    // Logic mixed with data access
  }
}

// GOOD - Keep gateway pure, business logic elsewhere
class DiscountService {
  constructor(private gateway: ProductGateway) {}
  // Business logic separated
}
```

### "When to Use" Sections

Clear guidance for each pattern/concept:

```markdown
### When to Use [Pattern]

**Best suited for:**
- Use case 1
- Use case 2

**Real-world implementations:**
- **Framework A** - Description
- **Framework B** - Description
```

### Anti-Pattern Sections

Call out common mistakes:

```markdown
### The Anti-Pattern to Avoid

**Never add business logic to a Table Data Gateway.** The moment you start writing methods like `calculateTotalRevenue()` in your gateway, you're mixing concerns.
```

### Comparison Tables

For pattern comparisons:

```markdown
| Aspect | Pattern A | Pattern B | Pattern C |
|--------|-----------|-----------|-----------|
| **Complexity** | Low | Medium | High |
| **Best For** | X | Y | Z |
```

### ASCII Diagrams

For architecture visualization:

```
┌─────────────────┐         ┌─────────────────┐
│  TRADING CONTEXT│◄───────►│  PRICING CONTEXT│
│                 │ Customer│                 │
│                 │ Supplier│                 │
└────────┬────────┘         └─────────────────┘
         │ ACL
         ▼
┌─────────────────┐
│  LEGACY SYSTEM  │
└─────────────────┘
```

### FAQ-Style Sections

Address common questions in bold:

```markdown
**Should you read all foundational books first?** Yes, it's recommended...

**What if I have limited time?** Focus on identifying knowledge gaps...
```

### Decision Trees

Help readers choose:

```markdown
### How to Decide: The Decision Tree

1. **Is my domain simple and CRUD-focused?**
   - Yes → Active Record
   - No → Continue

2. **Does my domain model closely match my database schema?**
   - Yes → Active Record
   - No → Data Mapper
```

## Formatting Rules

1. Use `---` horizontal rules between major sections
2. Use `###` for main headings, `####` for sub-sections
3. Numbered lists for sequential steps or book recommendations
4. Bullet points for characteristics or features
5. Italics for *disclaimers* and *emphasis*
6. Bold for **key concepts** and **important questions**
7. Code blocks with language specification (`typescript`, `javascript`, `pseudo`)

## Closing Pattern

End with:

1. Summary of key decisions/takeaways
2. Teaser for related content or next chapter
3. Inspirational quote from authority
4. Author signature (choose appropriate variant):

**Standard:**
```markdown
---

*About me:* I'm [Jigar](https://www.linkedin.com/in/jigar47), a software designer at [Yudiz Solutions](https://www.yudiz.com/). I'm an avid reader and have a keen interest in exploring the IT industry. During my free time, I explore different topics of Theoretical Physics.
```

**Modern with links:**
```markdown
---

*About me:* I'm [Jigar](https://www.linkedin.com/in/jigar47) - 14 years building systems, still learning every day. I write about software design, distributed systems, and Agentic AI. When I'm not coding, I'm probably reading about physics or deleting code I wrote yesterday.

[LinkedIn](https://www.linkedin.com/in/jigar47) | [Medium](https://medium.com/@jogi47)
```

## Topics & Domains

Primary focus areas:
- Software Architecture & Design Patterns
- Domain-Driven Design (DDD)
- Clean Architecture
- Data Source Patterns (POEAA)
- Career growth for engineers
- Book recommendations for developers
- Low-level system design
- Distributed systems concepts

## Multi-Chapter Series

For serialized content:
- Chapter 1: Foundations
- Chapter 2: Structural patterns
- Chapter 3: Advanced patterns + Strategic design
- Each chapter references previous and teases next
- Consistent subtitle across series

## Anti-Patterns to Avoid

- Generic examples (use real tools/companies)
- Surface-level explanations (go deep)
- Trendy buzzwords without substance
- Rushed conclusions
- Missing the "why" behind decisions
- Over-promising in titles
- Anemic code examples (show real, runnable code)

## Reference

For detailed examples of:
- Book recommendation format: See [references/book-style.md](references/book-style.md)
- Case study structure: See [references/case-study-style.md](references/case-study-style.md)
- Quote usage patterns: See [references/quotes-bank.md](references/quotes-bank.md)
