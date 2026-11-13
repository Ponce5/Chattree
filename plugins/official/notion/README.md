# Chattree Notion Workspace Integration

Official Chattree plugin integrating the Notion v1 API (`2022-06-28`) with natural-language AI tool calling. Connect your workspace so the AI can draft and publish structured Notion pages with native blocks, search your notes, and list recent updates directly from chat.

## Required Capabilities
- `network.http`: Authenticated HTTPS requests to `https://api.notion.com/v1/...`.
- `storage.private`: Private local storage for your Notion Internal Integration Secret and default parent page ID.

## Quick Setup

1. **Create a Notion integration:**
   - Open [Notion Developers / My Integrations](https://www.notion.so/profile/integrations).
   - Click **+ New integration**, name it (e.g., `"Chattree"`), and select your workspace.
   - Copy the **Internal Integration Secret** (`ntn_...` or `secret_...`).

2. **Share a parent page with your integration:**
   - Open the target page in Notion.
   - Click **...** (top right) -> **Connections** (*Add connections*) -> select your integration.

3. **Save your token in Chattree:**
   ```
   /notion set my token ntn_your_integration_secret
   ```
   *(You can also paste `ntn_...` or `secret_...` directly after `/notion`.)*

## Usage

- **Create pages with native Notion Markdown blocks:**
  - `/notion create a page with the top 5 mobile app ideas for 2027`
  - `/notion write a weekly Flutter study plan and save it to Notion`
- **Search pages and notes:**
  - `/notion search my notes about software architecture`
- **List recent pages:**
  - `/notion show my recent Notion pages`
- **Account & parent page management:**
  - `/notion check connection status`
  - `/notion set parent page <page_id_or_url>`
  - `/notion disconnect my Notion account`
