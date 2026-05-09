# One-cell-at-a-time mutation operations

All mutation tools (write, edit, insert, delete, move, merge, clear_outputs) operate on exactly one cell per call. The LLM can schedule parallel calls when it needs to touch multiple cells, so bulk operations would add interface complexity with no meaningful throughput gain. The simpler tool surface is easier to describe, test, and reason about.
