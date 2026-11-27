---
type: llm
focus: trace
weight: 1
---

audit.md flags that the admin cancel route and the nightly job write db.orders directly instead of going through order.service, and links this to customers not being notified
