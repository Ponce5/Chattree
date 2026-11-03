# 🐙 GitHub Integration Plugin (`com.chattree.official.github`)

Official **GitHub Integration** plugin for **Chattree**, compiled to native WebAssembly (`WASM`) and engineered to work **100% with Natural Language (`intentContract`)**.

---

## 🎯 Purpose & Utility

The **GitHub Integration** plugin turns Chattree into a conversational engineering assistant connected directly to the **GitHub REST API (`2022-11-28`)**. It enables developers and teams to:

1. **AI-Powered Issue Creation (`create`)**: Ask Chattree in plain Spanish or English to report a bug, propose an architecture improvement, or plan a feature. The AI generates a structured technical specification in Markdown (Context, Technical Proposal / Reproduction Steps, and Acceptance Criteria), publishes the Issue directly to your GitHub repository, and returns a clickable link alongside a full preview.
2. **Issue Tracking (`issues`)**: Inspect open issues on any public or private repository (`owner/repo`) directly inside your chat conversation.
3. **Repository Discovery (`search` & `repos`)**: Search global GitHub repositories by topic/technology or list your own most recently updated repositories.
4. **Stateful Repository Memory (`set_repo`)**: Save a default repository (`owner/repo`) in encrypted plugin private storage so you can create or list issues without repeating the repository name on every message.
5. **Secure Personal Access Token Storage (`config`, `status`, `disconnect`)**: Store your GitHub Personal Access Token (`ghp_...` or `github_pat_...`) in isolated private storage (`storage.private`) and verify your `@username` identity at any time.

---

## 💬 Natural Language Examples

Once installed, invoke `/github` (or aliases `/gh`, `/git`) using natural conversation:

- **Connect your GitHub Token:**
  ```text
  /github ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```
- **Set your default repository:**
  ```text
  /github usa el repositorio Ponce5/Chattree por defecto
  ```
- **Draft and open a rich technical Issue with AI:**
  ```text
  /github crea un issue en Ponce5/Chattree para optimizar el motor WASM y reducir el consumo de memoria en Android con criterios de aceptación
  ```
- **List open Issues in a repository:**
  ```text
  /github muéstrame los issues abiertos de Ponce5/Chattree
  ```
- **List your recent repositories:**
  ```text
  /github lista mis repositorios recientes
  ```
- **Search repositories on GitHub:**
  ```text
  /github busca repositorios de flutter wasm runtime
  ```
- **Check connection & active repository status:**
  ```text
  /github estado de mi cuenta
  ```

---

## 🔐 Permissions & Security

- `network.http`: Communicates exclusively with `https://api.github.com` over HTTPS TLS 1.3.
- `storage.private`: Stores `api_token` and `default_repo` in Chattree's isolated per-plugin key-value store.
- **Zero Rigid Keyword Slicing**: Powered by Chattree's `intentContract` (`action`, `repo`, `title`, `content`, `query`) with `maxResponseTokens: 3000`.
