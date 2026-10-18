# External AI Providers Architecture

Chattree provides a flexible, modular architecture allowing users to connect external cloud AI providers (such as OpenAI, Google Gemini, and Anthropic Claude) alongside or as an alternative to on-device models—without compromising the security of their credentials.

---

## Core Security Principles

- **API Keys Belong Exclusively to the User:** Keys are entered directly by the user on their device.
- **Zero Intermediary Servers:** Chattree never transmits API keys or prompts through Chattree backend servers. Requests route directly from the client to the provider's HTTPS endpoint.
- **Hardware-Backed Secure Storage:** Keys are stored exclusively in operating system secure keystores (`EncryptedSharedPreferences` backed by AES-256 Android Keystore on Android, and Keychain on iOS).
- **Zero Logging Guarantee:** Diagnostic logs never print keys, tokens, or authorization headers.
- **Chat Layer Independence:** The conversational chat interface and UI controllers interact with an abstract interface and remain agnostic of provider-specific API nuances.

---

## Layered Architecture

```
ChatController
      │
      │ uses
      ▼
RemoteInferenceEngine          ← depends on: AiProvider (interface), AiProviderRegistry
      │
      │ delegates to
      ▼
AiProvider (interface)          ← OpenAiProvider / GeminiProvider / AnthropicProvider
      │
      │ secure credentials via
      ▼
SecureCredentialStore          ← EncryptedSharedPreferences (Android) / Keychain (iOS)
      │
      │ non-sensitive config via
      ▼
AiProviderConfigStore          ← Local Key-Value Store (selected model, endpoints)
```

---

## Source Structure

```
lib/services/ai_providers/
├── ai_providers.dart                  ← Barrel export (single external import)
├── config/
│   └── ai_provider_config.dart        ← AiProviderConfig + AiProviderConfigStore
├── credentials/
│   └── secure_credential_store.dart   ← SecureCredentialStore (AES-256 Keystore)
├── engine/
│   └── remote_inference_engine.dart   ← RemoteInferenceEngine
├── errors/
│   └── ai_provider_error.dart         ← AiProviderError + AiProviderErrorCode
├── model/
│   ├── external_ai_model.dart         ← ExternalAiModel specification
│   └── model_capabilities.dart        ← ModelCapabilities descriptor
├── provider/
│   └── ai_provider.dart               ← AiProvider abstract interface + AiChatMessage
└── registry/
    └── ai_provider_registry.dart      ← AiProviderRegistry + built-in provider registry

lib/features/settings/screens/
└── ai_providers_screen.dart           ← Settings → AI Providers configuration UI
```

---

## The `AiProvider` Interface

Every external provider implements the abstract `AiProvider` contract:

```dart
abstract class AiProvider {
  /// Unique identifier (e.g., 'openai', 'gemini', 'anthropic')
  String get id;

  /// Visible display name in UI
  String get displayName;

  /// Brand name or organization
  String get brandName;

  /// List of supported models for this provider
  List<ExternalAiModel> get availableModels;

  /// Validates provider-specific configuration
  AiProviderError? validateConfig(AiProviderConfig config);

  /// Validates the API key format and connectivity
  Future<AiProviderError?> validateApiKey({
    required String apiKey,
    String? customEndpoint,
  });

  /// Streams generated response tokens asynchronously
  Stream<String> generateStream({
    required List<AiChatMessage> messages,
    required ExternalAiModel model,
    required AiProviderConfig config,
    required String apiKey,
  });

  /// Cancels an in-flight generation request
  Future<void> cancelGeneration();
}
```

---

## Model Capabilities Descriptor

Models expose their supported features through `ModelCapabilities`:

```dart
ExternalAiModel(
  modelId: 'gpt-4o',
  providerId: 'openai',
  displayName: 'GPT-4o',
  contextWindow: 128000,
  capabilities: ModelCapabilities(
    streaming: true,
    vision: true,
    tools: true,
    systemPrompt: true,
    temperature: true,
    maxTokens: true,
  ),
  available: true,
)
```

Adding a model to an existing provider only requires appending a new `ExternalAiModel` entry to the provider's `availableModels` list. The UI automatically renders it in model selection menus.

---

## Secure Credential Storage

### `SecureCredentialStore` API

```dart
// Save credential (never logged)
await SecureCredentialStore.instance.save(
  providerId: 'openai',
  apiKey: userKey,
);

// Retrieve key for direct transmission
final key = await SecureCredentialStore.instance.retrieve('openai');

// Check existence without exposing secrets
final exists = await SecureCredentialStore.instance.exists('openai');

// Delete credentials securely
await SecureCredentialStore.instance.delete('openai');
```

### Storage Backing Matrix

| Platform | Mechanism | Encryption |
|---|---|---|
| Android | `EncryptedSharedPreferences` | AES-256 via Android Keystore |
| iOS | Keychain Services | `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` |

### Security Boundaries

| Resource | Permitted in SecureCredentialStore | Permitted in Public Config / Logs |
|---|---|---|
| API Keys | ✅ Yes | ❌ Never |
| Auth Headers / Bearer Tokens | ✅ Yes | ❌ Never |
| Selected Model ID | ❌ No (stored in config store) | ✅ Yes |
| Custom Base URL | ❌ No (stored in config store) | ✅ Yes |
| Temperature / Max Tokens | ❌ No (stored in config store) | ✅ Yes |

---

## Local vs. Remote Inference Execution

### Local Model (Default)

```
ChatController.sendMessage()
  └── ModelManager.instance.engine.generateStream()  ← LlamaFlutterEngine
```
- 100% on-device processing.
- No network access required.
- Zero API keys or subscriptions required.

### Remote Provider

```
ChatController.sendMessage()
  └── RemoteInferenceEngine.generateStream()
        ├── Connectivity verification
        ├── SecureCredentialStore.retrieve(providerId)
        └── AiProvider.generateStream()  ← Direct HTTPS stream to provider
```
- Requires internet access.
- Requires user-configured API key.
- End-to-end HTTPS direct connection to the model provider.

### Switching Modes

The UI allows switching between local models and remote providers dynamically:

```dart
// Switch to remote provider
RemoteInferenceEngine.instance.selectProviderAndModel(
  providerId: 'openai',
  modelId: 'gpt-4o',
);

// Revert to on-device local model
RemoteInferenceEngine.instance.clearSelection();
```

---

## Streaming Architecture

1. **Async Generator:** Providers implement `generateStream()` using Dart `async*` yielding token chunks as they arrive from Server-Sent Events (SSE) or HTTP chunked transfer.
2. **Stream Forwarding:** `RemoteInferenceEngine.generateStream()` intercepts chunks, tracks token telemetry, and yields them to `ChatController`.
3. **UI Throttling:** `ChatController` buffers tokens using a 33ms throttle (~30 FPS) matching the animation cadence of on-device inference.
4. **Non-Streaming Fallback:** If a custom endpoint does not support streaming, the provider yields the entire response body in a single chunk once complete.

---

## Normalized Error System

All provider HTTP status codes, network errors, and authentication failures are mapped to normalized `AiProviderError` objects:

| Error Code | Meaning | User Feedback |
|---|---|---|
| `apiKeyMissing` | No key found in secure store | "API key missing. Configure your key in Settings → AI Providers." |
| `apiKeyInvalid` | Provider returned HTTP 401 Unauthorized | "Invalid API key. Please check your credentials in Settings." |
| `quotaExceeded` | Provider quota or credit exhausted | "Usage quota exceeded for this provider account." |
| `rateLimitExceeded` | HTTP 429 Too Many Requests | "Rate limit reached. Please wait a moment before trying again." |
| `modelNotAvailable` | Model identifier deprecated or restricted | "The selected model is currently unavailable." |
| `contextTooLarge` | Prompt exceeds model context window | "Conversation is too long for this model's context window." |
| `timeout` | Connection or inference timed out | "Request timed out. Check your internet connection." |
| `noInternet` | Device offline | "No internet connection detected." |
| `httpError` | Non-200 HTTP response | "Communication error with provider (HTTP status)." |
| `cancelled` | Generation halted by user | "Generation cancelled." |

Raw provider error JSON is never displayed to the user. All messages are cleaned and validated for safety.
