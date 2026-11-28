# Quotes Bank & Usage Guide

## When to Use Quotes

- Opening a major section with authority
- Introducing a complex concept
- Summarizing a key insight
- Closing an article with inspiration
- Defining patterns (especially from source books)

## Quote Format

Always use blockquote with attribution:

```markdown
> "The quote text goes here. Keep it relevant and impactful."
>
> — Author Name
```

For longer quotes, keep the full context:

```markdown
> "A car engine is an intricate piece of machinery, with dozens of parts collaborating to perform the engine's responsibility: to turn a shaft. One could imagine trying to design an engine block that could grab on to a set of pistons and insert them into its cylinders, spark plugs that would find their sockets and screw themselves in. But it seems unlikely that such a complicated machine would be as reliable or as efficient as our typical engines are. Instead, we accept that something else will assemble the pieces."
>
> — Eric Evans
```

## Preferred Authors by Topic

### Domain-Driven Design

**Eric Evans** (Domain-Driven Design - The Blue Book)
- "A good domain model can be incredibly valuable but it's not something that's easy to make. Few people can do it well and it's very hard to teach."
- "An AGGREGATE is a cluster of associated objects that we treat as a unit for the purpose of data changes. Each AGGREGATE has a root and a boundary."
- "A BOUNDED CONTEXT delimits the applicability of a particular model so that team members have a clear and shared understanding of what has to be consistent and how it relates to other CONTEXTS."
- "MODULES give people two views of the model: They can look at detail within a MODULE without being overwhelmed by the whole, or they can look at relationships between MODULES in views that exclude interior detail."
- "The critical complexity of most software projects is in understanding the domain itself."
- On Entities: "In our typical conception, a person has an identity that stretches from birth to death and even beyond..."
- On Value Objects: "VALUE OBJECTS can even reference ENTITIES..."
- On Factories (car analogy): "A car engine is an intricate piece of machinery..."
- On Supple Design: "A lot of overengineering has been justified in the name of flexibility. But more often than not, excessive layers of abstraction and indirection get in the way."
- On Standalone Classes: "Low coupling is fundamental to object design. When you can, go all the way. Eliminate all other concepts from the picture."
- On Specifications: "Business rules often do not fit the responsibility of any of the obvious ENTITIES or VALUE OBJECTS..."

### Enterprise Patterns

**Martin Fowler** (Patterns of Enterprise Application Architecture)
- "A Table Data Gateway holds all the SQL for accessing a single table or view: selects, inserts, updates, and deletes. Other code calls its methods for all interaction with the database."
- "An object that wraps a row in a database table or view, encapsulates the database access, and adds domain logic on that data." (Active Record)
- "A layer of Mappers that moves data between objects and a database while keeping them independent of each other and the mapper itself." (Data Mapper)
- "A REPOSITORY represents all objects of a certain type as a conceptual set (usually emulated). It acts like a collection, except with more elaborate querying capability."
- "The best architects understand that form follows function. The pattern you choose should serve your application's needs, not the other way around."

### Software Design & Architecture

**Robert C. Martin (Uncle Bob)** (Clean Code/Architecture)
- On architecture principles
- On SOLID principles
- On professional responsibility
- On component coupling

### Life & Career Philosophy

**Naval Ravikant**
- "My only real friends were books. Books make for great friends, because the best thinkers of the last few thousand years tell you their nuggets of wisdom."
- "Reading a book isn't a race — the better the book, the more slowly it should be absorbed."

### Agile & Requirements

**Mike Cohn** (User Stories Applied)
- "The best way to get the right requirements is to involve users early and often. A good user story captures what is needed, but great software comes from conversations and collaboration."

### Architecture Origins

**Christopher Alexander** (A Pattern Language)
- Inspired the Gang of Four
- Use for meta-commentary on patterns
- Good for closing articles about design patterns

## Quote Placement Patterns

### Pattern Definition

When introducing a pattern, quote the original source:

```markdown
### Table Data Gateway

> "A Table Data Gateway holds all the SQL for accessing a single table or view: selects, inserts, updates, and deletes."
>
> — Martin Fowler, POEAA

The key characteristic is that it returns raw data, not domain objects.
```

### Section Opener

```markdown
### What is Modeling?

> "A map can never be 100% accurate to the real world..."
>
> — [Author]

Let's understand this with an example...
```

### Concept Anchor

After explaining a concept, reinforce with authority:

```markdown
This is why separating creation from use matters. Eric Evans explains it beautifully:

> "A car engine is an intricate piece of machinery..."
>
> — Eric Evans
```

### Article Closer

End with inspiration:

```markdown
---

Let's end this article with a quote from Christopher Alexander,
who inspired Eric Gamma to create the design patterns book.

> "[Inspirational quote]"
>
> — Christopher Alexander
```

Or a summary quote:

```markdown
> "The critical complexity of most software projects is in understanding the domain itself."
>
> — Eric Evans
```

## Quote Selection Criteria

1. **Relevance** - Directly supports your point
2. **Authority** - From recognized industry experts
3. **Depth** - Adds insight beyond surface explanation
4. **Length** - Can be short (1 sentence) or long (full paragraph) depending on context

## Creating Quote Context

Always introduce why you're sharing the quote:

- "The below quote from Eric Evans' book explains it well..."
- "A great quote from the book on this topic is..."
- "It is a profound analogy that beautifully illustrates..."
- "No other explanation can justify it better..."
- "Martin Fowler defines this pattern as..."
- "Eric Evans provides clear guidelines that should govern your design..."

## Book Abbreviations

When referencing books multiple times:
- **DDD** - Domain-Driven Design (Eric Evans)
- **POEAA** - Patterns of Enterprise Application Architecture (Martin Fowler)
- **GoF** - Design Patterns: Gang of Four
- **Clean Code** - Clean Code (Robert C. Martin)
- **Clean Architecture** - Clean Architecture (Robert C. Martin)
