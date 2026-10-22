# Chattree App Features

This guide maps the main user-facing app features to their technical references. The exact catalog contents and provider model availability may change with app releases.

## First launch and local models

On first launch, Chattree can inspect device information and recommend a local model. You can continue through the recommendation and download flow or skip to chat. In **Manage Models**, the catalog shows model details such as download size, quantization, approximate memory requirements, and compatibility metadata. You can download an available model with progress, cancel an active download, select an installed model for chat, unload the current model from memory, or delete an installed model.

Local generation runs on the device after a compatible model is installed and selected. Hardware and memory affect which models are practical. The app's displayed requirements are estimates; check the catalog in the version you use.

## Chat and conversation history

The chat drawer lets you start a conversation, switch between saved conversations, and manage conversation names and entries. Conversation records retain their messages, timestamps, selected model metadata, and reasoning-mode preference where supported. The chat options menu can change the active model, control reasoning mode for compatible models, adjust generation settings, and clear the current conversation. **Settings → Data** provides a separate action to delete all conversations.

The input supports slash-command discovery: type `/` or use the slash button to browse available commands. Built-in Notes, Reminders, Visual, and installed plugin tools are exposed through their current registrations. A command may ask the selected AI model to interpret a request; a slash command does not guarantee that every provider/model supports the same tool behavior.

## Model and generation settings

**Settings** includes appearance (dark, light, or system theme), app language (English, Spanish, or French), temperature, maximum response tokens, automatic keyboard opening, and local AI optimization. Chat-level options may expose a subset of these controls as well. Some inference settings are relevant only to compatible local or remote models.

The model catalog manages chat models. The embedding model is a separate download and does not replace the chat model.

## Notes, semantic search, and embeddings

Chattree Notes and Reminders are built-in chat features; see the [Notes and Reminders guide](./notes-reminders.md) for their commands and behavior. A separate ONNX embedding model supports semantic note search. After it is installed, Settings can enable or disable RAG, show indexing progress, rebuild the index, and clear the vector index. Notes and their local embedding index are stored on the device. RAG availability depends on the embedding model being installed and initialized.

## External AI providers

Chattree includes configured provider integrations for OpenAI, Google Gemini, Anthropic Claude, and OpenRouter. In **Settings → AI Providers**, a user can add or replace an API key, test connectivity, enable or disable a provider, and remove its key. Provider/model selection is exposed through chat model selection. Remote inference requires network access and sends the prompt context needed for that request to the selected provider; review that provider's data and retention policies. The local model path does not send prompts to those providers.

See the [External AI Providers architecture](./ai_providers/architecture.md) for the client, credential storage, and provider integration details.

## Plugins and visual design

Third-party WASM plugins can be imported or installed from the Marketplace, enabled or disabled, and managed from Settings. Per-plugin capability grants can be reviewed and revoked. The [Plugin SDK](./plugins/README.md) documents how to create and publish plugins, including generated-file results with Save and Share actions in chat.

The built-in `/visual` tool generates and refines SVG artwork and provides preview and export actions. See the [Visual Design guide](./visual-design.md) for the design, sanitization, persistence, and export pipeline.

## Current implementation boundary

The app parses plugin `settings` entries in `plugin.json`, but the current plugin detail screen does not provide a settings editor or a Host API for reading those values. Do not rely on manifest-declared plugin settings for user configuration until that support is implemented and documented.
