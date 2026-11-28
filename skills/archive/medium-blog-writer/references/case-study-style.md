# Case Study Style Guide

## Purpose

Ground abstract concepts in concrete, relatable business scenarios. Never explain patterns in isolation - always through a real-world lens.

## Two Types of Case Studies

### Type 1: Single Domain Deep Dive

Explore one domain throughout the article, revealing complexity progressively.

**Examples used:**
- **HR Payroll System** - For creational design patterns (KPIs, departments, incentives)
- **Stock Trading Platform** - For DDD concepts (orders, trades, aggregates, bounded contexts)

### Type 2: Pattern Comparison

Compare multiple approaches using the same simple example.

**Examples used:**
- **Product Catalog / User Management** - For data source patterns comparison
- **E-commerce Order** - For showing pattern evolution

## Choosing Case Studies

Pick domains that:
- Have complex business logic (payroll, trading, healthcare)
- Are relatable to most developers
- Allow progressive complexity reveal
- Have multiple stakeholders and rules

## Type 1: Single Domain Structure

### 1. Introduce the Domain

```markdown
### Our Case Study

Let's consider the HR Payroll system of an IT organization as a sample software
to explore these design patterns. They use this system for managing the payroll
of its employees.

For the purpose of this blog, we will concentrate on the module responsible
for calculating employee incentives.
```

### 2. Start Simple (Level 0)

```markdown
### Level 0

Our Incentive Module begins (and ends) with just one file, which we'll refer
to as `service.xy`. It's important to note that this service file handles
more than just calculating incentives.
```

### 3. Reveal Complexity Gradually

Each level should:
- Identify a problem with current approach
- Propose a solution
- Show the new structure
- Explain the benefit

```markdown
### Level N

At this stage, we can identify some issues with our system. [Problem statement].
It's time to introduce [solution concept].

[Explanation of why this helps]

The end result looks something like this:
[Code or diagram reference]
```

### 4. Summary with Business Alignment

```markdown
### Summary

We started on a journey from a simple architecture to a complex one.
Along the way, we made crucial design decisions aligned with our business goals.
These decisions can't be made in isolation - they should always align with
the nature of software or business needs.

#### Key Decisions We Made

[Bullet list of decisions and their rationale]
```

## Type 2: Pattern Comparison Structure

### 1. Introduce the Problem

```markdown
## The Core Problem: Two Worlds That Speak Different Languages

Before diving into patterns, we need to understand the problem they solve.
Consider this analogy:

> Imagine your application as a city, and your database as a foreign country...
```

### 2. Present Each Pattern with Same Example

```markdown
## Pattern 1: Table Data Gateway

### The Simplest Bridge Between Objects and Tables

Think of it as a **single receptionist who handles all requests for one department**.

[Code example using ProductGateway]

### When to Use Table Data Gateway

**Best suited for:**
- Simple CRUD applications
- Scripts and batch processing

**Real-world implementations:**
- **Knex.js** - Query builder in Node.js
- **Raw JDBC** - Java
```

### 3. Show Evolution Path

```markdown
## The Evolution Path: From Simple to Sophisticated

### Level 0: Raw SQL
You start with raw SQL queries scattered throughout your code.

### Level 1: Table Data Gateway
You centralize all SQL for each table into gateway classes.

### Level 2: Active Record
You want objects with behavior.

### Level 3: Data Mapper
Your domain becomes complex.
```

### 4. Comparison Table

```markdown
## Pattern Comparison: Side by Side

| Aspect | Table Data Gateway | Active Record | Data Mapper |
|--------|-------------------|---------------|-------------|
| **Complexity** | Low | Medium | High |
| **Domain Logic** | None (separate) | In the model | In domain objects |
| **Best For** | Scripts, reports | CRUD apps | Complex domains |
```

### 5. Framework Mapping

```markdown
## Framework Deep Dive: What Are You Actually Using?

### Node.js Ecosystem

| Library | Pattern | Notes |
|---------|---------|-------|
| **Knex.js** | Table Data Gateway | Query builder |
| **Sequelize** | Active Record | `model.save()` |
| **TypeORM** | Data Mapper | Repositories |
```

## Code in Case Studies

Use TypeScript/JavaScript with clear, runnable examples:

```typescript
// AGGREGATE ROOT: TradeOrder
class TradeOrder {
  constructor(orderId, traderId) {
    this._orderId = orderId;
    this._traderId = traderId;
    this._lines = [];
    this._status = 'draft';
  }

  // All modifications go through the Aggregate Root
  addPosition(stockSymbol, quantity, price) {
    this.assertDraft();
    // Business logic here
  }
}
```

Show BAD vs GOOD patterns:

```typescript
// BAD - Business logic in gateway
class ProductGateway {
  applyBulkDiscount(categoryId: string, percent: number): void {
    // Logic mixed with data access - WRONG
  }
}

// GOOD - Keep gateway pure
class DiscountService {
  constructor(private gateway: ProductGateway) {}
  // Business logic separated - CORRECT
}
```

## Diagrams

Reference diagrams even if not included:

```markdown
In the figure above, you can observe...
The structure might look something like this:
As you can see in the below figure...
```

Use ASCII diagrams for architecture:

```
┌─────────────────┐         ┌─────────────────┐
│  TRADING CONTEXT│◄───────►│  PRICING CONTEXT│
└────────┬────────┘         └─────────────────┘
         │ ACL
         ▼
┌─────────────────┐
│  LEGACY SYSTEM  │
└─────────────────┘
```

## Anti-Patterns to Call Out

Create dedicated sections for common mistakes:

```markdown
### Common Mistakes and Anti-Patterns

#### 1. Using Active Record for Complex Domains

**The Symptom:** Your model classes have 50+ methods...

**The Problem:** Active Record couples your domain to your database...

**The Fix:** Graduate to Data Mapper...
```

## Decision Guidance

Help readers choose with decision trees:

```markdown
### How to Decide: The Decision Tree

Ask yourself these questions:

1. **Is my domain simple and CRUD-focused?**
   - Yes → Active Record
   - No → Continue

2. **Does my domain model closely match my database schema?**
   - Yes → Active Record
   - No → Data Mapper
```

## Anti-Patterns to Avoid in Writing

- Don't use trivial examples (todo apps, counters)
- Don't skip the "why" for each evolution
- Don't introduce all complexity at once
- Don't use fictional company names - use generic "IT organization" or real frameworks
- Don't write pseudo-code when real code would work
