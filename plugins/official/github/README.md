# GitHub Plugin for Chattree

Official GitHub integration plugin for Chattree. Seamlessly inspect repositories, view issues and pull requests, and monitor project activity directly from your AI conversations.

---

## Features

- **Personal Access Token Management**: Securely store your GitHub PAT locally in sandboxed private storage.
- **Account Verification**: Check your GitHub profile and connection status.
- **Repository Inspection**: View repository metadata including stars, forks, default branch, and links.
- **Issues Overview**: List open issues directly in the chat.
- **Pull Requests Tracking**: Monitor open PRs and authors.
- **Natural Language Intent**: Ask the AI assistant naturally (e.g. *"¿cuáles son los issues abiertos de Ponce5/Chattree?"*).

---

## Commands

| Command | Description |
|---|---|
| `/github` | Displays the help and command menu. |
| `/github config <token>` | Stores your GitHub Personal Access Token. |
| `/github status` | Checks your GitHub connection and username. |
| `/github repo <owner/repo>` | Displays repository information and statistics. |
| `/github issues <owner/repo>` | Lists the latest open issues. |
| `/github prs <owner/repo>` | Lists the latest open pull requests. |
| `/gh <command>` | Short alias for all `/github` commands. |

---

## Setup

1. Create a GitHub Personal Access Token (classic or fine-grained) at https://github.com/settings/tokens.
2. Grant `repo` (or read-only repository permissions) and `read:user`.
3. In Chattree, send:
   ```
   /github config ghp_tuTokenPersonalDeGithub
   ```
4. Verify by running `/github status`.

---

## Capabilities

- `network.http`: Communicates with `https://api.github.com` via HTTPS.
- `storage.private`: Safely isolates and stores your token on-device.
- `open.url`: Opens repository and issue links in your browser.

