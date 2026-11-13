# Chattree GitHub Integration (`com.chattree.official.github`)

Official **GitHub Integration** plugin for **Chattree**, compiled to WebAssembly (`WASM`) and powered by natural-language AI tool calling (`intentContract`).

---

## Features

Connected to the **GitHub REST API (`2022-11-28`)**, you can:

1. **AI-Drafted Issues (`create`)**: Describe a bug, feature, or task in natural language. The AI drafts a structured Markdown specification and opens the Issue directly in your repository.
2. **Issue Tracking (`issues`)**: List open Issues on any accessible public or private repository (`owner/repo`).
3. **Repository Discovery (`search` & `repos`)**: Search GitHub repositories by topic or list your recently updated repositories.
4. **Default Repository (`set_repo`)**: Save a default `owner/repo` in private plugin storage so you do not have to repeat it.
5. **Token Management (`config`, `status`, `disconnect`)**: Store your GitHub Personal Access Token (`ghp_...` or `github_pat_...`) in isolated private storage (`storage.private`).

---

## Usage Examples

Invoke `/github` (or aliases `/gh`, `/git`):

- **Connect your GitHub Token:**
  ```text
  /github ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```
- **Set your default repository:**
  ```text
  /github set default repo Ponce5/Chattree
  ```
- **Draft and open a technical Issue:**
  ```text
  /github create an issue in Ponce5/Chattree to optimize WASM memory usage on Android
  ```
- **List open Issues:**
  ```text
  /github show open issues in Ponce5/Chattree
  ```
- **List your recent repositories:**
  ```text
  /github list my recent repositories
  ```
- **Search repositories on GitHub:**
  ```text
  /github search repositories for flutter wasm runtime
  ```
- **Check account & default repository status:**
  ```text
  /github check connection status
  ```

---

## Permissions & Security

- `network.http`: Communicates exclusively with `https://api.github.com` over HTTPS.
- `storage.private`: Stores `api_token` and `default_repo` in Chattree's isolated per-plugin key-value store.
