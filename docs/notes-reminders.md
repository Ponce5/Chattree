# Notes and Reminders Architecture & Integration Guide

Chattree features an integrated, privacy-focused subsystem for user notes and reminders with local Vector RAG (Retrieval-Augmented Generation). 

This guide details both the user-facing conversational capabilities and the programmatic interfaces exposed to WebAssembly plugins through the Chattree Host API.

---

## Architecture Overview

```
Conversational Layer:
  User input / Chat ────► AI Engine (local Llama / External Provider)
                               │
                               ├─► Direct commands: /note, /reminder
                               ├─► Intent classification (natural language CRUD)
                               └─► Vector RAG context retrieval
                                      │
                                      ▼
Data Layer:
  Notes Database (SQLite) ◄──► Local Vector Store (Embeddings & Cosine Search)
  Reminders Database (SQLite) ◄──► Android AlarmManager (Exact Alarms via flutter_local_notifications)
                                ▲
                                │
Host API Layer (ChattreeHostApi):
  WASM Plugin ──host_call()──► PermissionGateway ──► Chattree Notes / Reminders Handlers
```

---

## 1. Conversational Chat Commands

Chattree provides explicit slash commands and structured natural language interactions for notes and reminders.

### Notes

- **Explicit Slash Command:** Users type `/note` directly for deterministic operations:
  ```text
  /note buy coffee beans and milk
  /note project deadline: submit final report on Friday
  /note search student ID
  /note list
  ```
- **Conversational Safety:** In standard conversational chat without slash commands, Chattree prioritizes natural conversation. If a note-taking or reminder intent is detected, Chattree transparently guides the user to invoke `/note` or `/reminder`, ensuring side-effects are never performed without explicit user consent.
- **Confirmation:** Destructive actions (such as deletion) require explicit user confirmation. If a request is ambiguous or references multiple notes, the assistant asks for clarification rather than deleting the wrong entry.

### Reminders

Reminders handle time-sensitive tasks with scheduled notifications on Android:

- **Explicit Slash Command:** Typing `/reminder` without arguments immediately lists all pending reminders. With arguments, it routes to the assistant:
  ```text
  /reminder
  /reminder submit tax report next Monday at 9:00 AM
  ```
- **Date & Time Disambiguation:** Scheduled reminders require a clear date and time. Ambiguous references (e.g., "in the morning") prompt clarification rather than guessing.
- **Background Notifications on Android:** Reminders are scheduled directly in the Android system using `AlarmManager` (exact alarms). When the scheduled timestamp arrives, Android wakes up the notification service to ring the alert on time, even if the phone is locked or Chattree is closed, with zero battery drain.

---

## 2. Local Vector RAG (Retrieval-Augmented Generation)

When chatting, if a user query might benefit from saved notes, Chattree can automatically augment the AI prompt with relevant context:

1. **Automatic Embedding Generation:** Every time a note is created or updated, Chattree generates vector embeddings locally using the on-device embedding model.
2. **Local Vector Storage:** Embeddings are indexed in a local vector database on the Android device.
3. **Semantic Cosine Search:** When a prompt is submitted, semantic similarity against stored note vectors is computed in milliseconds.
4. **Context Injection:** Relevant note excerpts are injected into the prompt context window before inference.
5. **Zero Data Leakage:** Vectors, notes, and queries never leave the device. When a note is deleted, its vector embeddings are purged synchronously.
6. **Fallback:** If RAG is disabled in Settings or returns no high-confidence matches, standard conversation continues without interruption.

---

## 3. WebAssembly Plugin Integration

Third-party WASM plugins do not depend on the conversational AI interpretation. Instead, plugins interact directly with Notes and Reminders through programmatic, type-safe Host API operations.

### Required Capabilities

To access these services, a plugin must declare the appropriate capabilities in its `plugin.json`:

```json
"capabilities": [
  "chattree.notes.read",
  "chattree.notes.create",
  "chattree.notes.update",
  "chattree.notes.delete",
  "chattree.notes.search",
  "chattree.reminders.read",
  "chattree.reminders.create",
  "chattree.reminders.update",
  "chattree.reminders.delete"
]
```

Users review and grant these capabilities during plugin installation.

---

## 4. Host API Operations

All calls use the standard `chattree.host_call` interface:

### Notes Operations (`chattree.notes`)

| Operation | Mode | Input Payload | Output Data |
|---|---|---|---|
| `chattree.notes.search` | Async | `{ "query": string, "limit"?: number }` | `{ "notes": [...], "count": number }` |
| `chattree.notes.get` | Async | `{ "id": string }` | `{ "note": { "id", "title", "content", "createdAt", "updatedAt" } }` |
| `chattree.notes.create` | Async | `{ "title": string, "content"?: string }` | `{ "note": { "id", "title", "content", "createdAt", "updatedAt" } }` |
| `chattree.notes.update` | Async | `{ "id": string, "title"?: string, "content"?: string }` | `{ "note": { "id", "title", "content", "createdAt", "updatedAt" } }` |
| `chattree.notes.delete` | Async | `{ "id": string }` | `{ "deleted": true, "id": string }` |

#### Create Note Example (Request)
```json
{
  "api": "chattree.notes",
  "operation": "create",
  "payload": {
    "title": "Meeting Summary",
    "content": "Discussed Q4 roadmap and WebAssembly plugin engine milestones."
  }
}
```

#### Create Note Example (Response)
```json
{
  "success": true,
  "data": {
    "note": {
      "id": "not_9a8b7c6d5e",
      "title": "Meeting Summary",
      "content": "Discussed Q4 roadmap and WebAssembly plugin engine milestones.",
      "createdAt": "2026-10-14T18:00:00.000Z",
      "updatedAt": "2026-10-14T18:00:00.000Z"
    }
  }
}
```

---

### Reminders Operations (`chattree.reminders`)

| Operation | Mode | Input Payload | Output Data |
|---|---|---|---|
| `chattree.reminders.list` | Async | `{ "limit"?: number }` | `{ "reminders": [...], "count": number }` |
| `chattree.reminders.get` | Async | `{ "id": string }` | `{ "reminder": { "id", "title", "scheduledAt", "completed" } }` |
| `chattree.reminders.create` | Async | `{ "title": string, "scheduledAt"?: string }` | `{ "reminder": { "id", "title", "scheduledAt", "completed" } }` |
| `chattree.reminders.update` | Async | `{ "id": string, "title"?: string, "scheduledAt"?: string }` | `{ "reminder": { ... } }` |
| `chattree.reminders.complete`| Async | `{ "id": string }` | `{ "completed": true, "id": string }` |
| `chattree.reminders.delete` | Async | `{ "id": string }` | `{ "deleted": true, "id": string }` |

---

## 5. Security & Isolation Limits

1. **Title Length:** Maximum 300 characters for note and reminder titles.
2. **Content Length:** Maximum 50,000 characters for note bodies.
3. **Search Limits:** Search queries return at most 100 results per request.
4. **Scope Control:** Notes and Reminders APIs are completely decoupled from chat history. A plugin with `chattree.notes.*` cannot read conversation transcripts or AI system prompts.
