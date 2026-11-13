;; Chattree Official Notion Integration Plugin v1.3.0
;; - Minimalist Chattree monochrome UI (English predetermined strings; AI writes in user's language)
;; - Native Notion Markdown blocks (heading_1/2/3, bulleted_list_item, numbered_list_item, quote, divider, paragraph)
;; - Whitespace-tolerant JSON extraction, \uXXXX -> UTF-8 decoding, proper double-JSON escaping
;; - Bounded search title extraction & auto-clearing of invalid parent_id
(module
  (import "chattree" "host_call"
    (func $host_call (param i32 i32 i32 i32) (result i32))
  )

  ;; 64 pages = 4 MB sandbox linear memory
  (memory (export "memory") 64)

  (global $phase        (mut i32) (i32.const 0))
  (global $token_len    (mut i32) (i32.const 0))
  (global $arg_len      (mut i32) (i32.const 0))  ;; sanitized title/query length at 1303000
  (global $op_len       (mut i32) (i32.const 0))  ;; lowercased action length at 1306000
  (global $parent_len   (mut i32) (i32.const 0))  ;; parent_id length at 1307000
  (global $raw_body_len (mut i32) (i32.const 0))  ;; raw JSON-extracted content at 1400000
  (global $preview_len  (mut i32) (i32.const 0))  ;; decoded UTF-8 preview at 1600000

  ;; ── Static NUL-Terminated Data Segments (140000+) ────────────────────────
  (data (i32.const 140000) "**Notion Workspace**\0a\0aConnect your Notion workspace to create structured pages, search notes, and view recent updates.\0a\0a---\0a\0a**Examples**\0a- `/notion create a page with 5 mobile app ideas for 2027`\0a- `/notion search my notes about software architecture`\0a- `/notion show my recent Notion pages`\0a- `/notion set my token ntn_your_secret`\0a- `/notion check connection status`\0a- `/notion disconnect my account`\0a\0a**Setup**\0a1. Create an integration at https://www.notion.so/profile/integrations and copy your Internal Integration Secret (`ntn_...` or `secret_...`).\0a2. Open a page in Notion -> `...` -> **Connections** -> select your integration.\0a3. Run `/notion set my token <your_token>`.\00")

  (data (i32.const 141200) "**Notion Connected**\0a\0aYour integration token is saved and verified.\0a\0aTry:\0a- `/notion create a page with project milestones`\0a- `/notion search my notes`\0a- `/notion show my recent pages`\00")

  (data (i32.const 141600) "**Token Saved — Verification Failed**\0a\0aNotion returned an authentication error. Verify that your token is an active Internal Integration Secret (`ntn_...` or `secret_...`) from https://www.notion.so/profile/integrations.\00")

  (data (i32.const 142000) "**Notion Not Configured**\0a\0aSave your Integration Secret using:\0a`/notion set my token <your_integration_secret>`\0a\0aGet your key at https://www.notion.so/profile/integrations.\00")

  (data (i32.const 142400) "**Notion Disconnected**\0a\0aYour integration token has been removed from this device.\00")

  (data (i32.const 142600) "**Notion Connection Active**\0a\0a- **API:** Notion API v1 (`2022-06-28`)\0a- **Status:** Authenticated\0a- **Capabilities:** Create pages with native blocks, search, and list recent pages\00")

  (data (i32.const 143000) "**Notion Connection Failed**\0a\0aYour saved token is invalid or expired. Update it with:\0a`/notion set my token <your_token>`\00")

  (data (i32.const 143300) "**Notion Results**\0a\0a\00")

  (data (i32.const 143400) "**No Results Found**\0a\0aMake sure the target pages or databases are shared with your integration in Notion (`...` -> **Connections** -> select your integration).\00")

  (data (i32.const 143700) "**Notion Request Failed**\0a\0aCheck your internet connection and verify your token with `/notion check connection status`.\00")

  (data (i32.const 144000) "**Parent Page Updated**\0a\0aNew Notion pages will be created inside the configured parent page.\00")

  (data (i32.const 144200) "**No Shared Parent Page Found**\0a\0aNotion requires new pages to be created inside an existing shared page. Open a page in Notion -> `...` -> **Connections** -> add your integration, then try again.\00")

  (data (i32.const 144550) "**Page Created in Notion**\0a\0a[**\00")
  (data (i32.const 144600) "**](\00")
  (data (i32.const 144620) ")\0a\0a---\0a\0a\00")
  (data (i32.const 144650) "\0a\0a---\0a*Saved to your Notion workspace.*\00")
  (data (i32.const 144750) "**Notion Error:** \00")
  (data (i32.const 144800) "\0a\0aVerify that your integration has edit permissions on a shared Notion page.\00")
  (data (i32.const 144950) "Notion Note\00")
  (data (i32.const 144980) "Notion Page\00")
  (data (i32.const 145010) "- [\00")
  (data (i32.const 145020) "](\00")
  (data (i32.const 145030) ")\0a\00")

  ;; Storage & HTTP templates
  (data (i32.const 145100) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22api_token\22}}\00")
  (data (i32.const 145200) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22api_token\22,\22value\22:\22\00")
  (data (i32.const 145300) "\22}}\00")
  (data (i32.const 145320) "{\22api\22:\22storage\22,\22operation\22:\22delete\22,\22payload\22:{\22key\22:\22api_token\22}}\00")
  (data (i32.const 145420) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22parent_id\22}}\00")
  (data (i32.const 145520) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22parent_id\22,\22value\22:\22\00")
  (data (i32.const 145620) "{\22api\22:\22storage\22,\22operation\22:\22delete\22,\22payload\22:{\22key\22:\22parent_id\22}}\00")

  (data (i32.const 145720) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.notion.com/v1/users/me\22,\22method\22:\22GET\22,\22headers\22:{\22Authorization\22:\22Bearer \00")
  (data (i32.const 145920) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22timeoutMs\22:20000}}\00")

  (data (i32.const 146050) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.notion.com/v1/search\22,\22method\22:\22POST\22,\22headers\22:{\22Authorization\22:\22Bearer \00")
  (data (i32.const 146250) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22body\22:\22{\5c\22query\5c\22:\5c\22\00")
  (data (i32.const 146380) "\5c\22,\5c\22page_size\5c\22:5,\5c\22sort\5c\22:{\5c\22direction\5c\22:\5c\22descending\5c\22,\5c\22timestamp\5c\22:\5c\22last_edited_time\5c\22}}\22,\22timeoutMs\22:25000}}\00")
  (data (i32.const 146550) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22body\22:\22{\5c\22page_size\5c\22:5,\5c\22sort\5c\22:{\5c\22direction\5c\22:\5c\22descending\5c\22,\5c\22timestamp\5c\22:\5c\22last_edited_time\5c\22}}\22,\22timeoutMs\22:25000}}\00")
  (data (i32.const 146780) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22body\22:\22{\5c\22filter\5c\22:{\5c\22value\5c\22:\5c\22page\5c\22,\5c\22property\5c\22:\5c\22object\5c\22},\5c\22page_size\5c\22:3,\5c\22sort\5c\22:{\5c\22direction\5c\22:\5c\22descending\5c\22,\5c\22timestamp\5c\22:\5c\22last_edited_time\5c\22}}\22,\22timeoutMs\22:20000}}\00")

  ;; Create Page templates
  (data (i32.const 147100) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.notion.com/v1/pages\22,\22method\22:\22POST\22,\22headers\22:{\22Authorization\22:\22Bearer \00")
  (data (i32.const 147300) "\22,\22Notion-Version\22:\222022-06-28\22,\22Content-Type\22:\22application/json\22},\22body\22:\22{\5c\22parent\5c\22:{\5c\22page_id\5c\22:\5c\22\00")
  (data (i32.const 147440) "\5c\22},\5c\22properties\5c\22:{\5c\22title\5c\22:{\5c\22title\5c\22:[{\5c\22text\5c\22:{\5c\22content\5c\22:\5c\22\00")
  (data (i32.const 147550) "\5c\22}}]}}\22,\22timeoutMs\22:25000}}\00")
  (data (i32.const 147600) "\5c\22}}]}},\5c\22children\5c\22:[\00")
  (data (i32.const 147650) "]}\22,\22timeoutMs\22:25000}}\00")

  ;; Block templates for native Notion Markdown blocks
  (data (i32.const 147700) "{\5c\22object\5c\22:\5c\22block\5c\22,\5c\22type\5c\22:\5c\22divider\5c\22,\5c\22divider\5c\22:{}}\00")
  (data (i32.const 147800) "{\5c\22object\5c\22:\5c\22block\5c\22,\5c\22type\5c\22:\5c\22paragraph\5c\22,\5c\22paragraph\5c\22:{\5c\22rich_text\5c\22:[{\5c\22type\5c\22:\5c\22text\5c\22,\5c\22text\5c\22:{\5c\22content\5c\22:\5c\22\00")
  (data (i32.const 147960) "{\5c\22object\5c\22:\5c\22block\5c\22,\5c\22type\5c\22:\5c\22heading_1\5c\22,\5c\22heading_1\5c\22:{\5c\22rich_text\5c\22:[{\5c\22type\5c\22:\5c\22text\5c\22,\5c\22text\5c\22:{\5c\22content\5c\22:\5c\22\00")
  (data (i32.const 148120) "{\5c\22object\5c\22:\5c\22block\5c\22,\5c\22type\5c\22:\5c\22heading_2\5c\22,\5c\22heading_2\5c\22:{\5c\22rich_text\5c\22:[{\5c\22type\5c\22:\5c\22text\5c\22,\5c\22text\5c\22:{\5c\22content\5c\22:\5c\22\00")
  (data (i32.const 148280) "{\5c\22object\5c\22:\5c\22block\5c\22,\5c\22type\5c\22:\5c\22heading_3\5c\22,\5c\22heading_3\5c\22:{\5c\22rich_text\5c\22:[{\5c\22type\5c\22:\5c\22text\5c\22,\5c\22text\5c\22:{\5c\22content\5c\22:\5c\22\00")
  (data (i32.const 148440) "{\5c\22object\5c\22:\5c\22block\5c\22,\5c\22type\5c\22:\5c\22bulleted_list_item\5c\22,\5c\22bulleted_list_item\5c\22:{\5c\22rich_text\5c\22:[{\5c\22type\5c\22:\5c\22text\5c\22,\5c\22text\5c\22:{\5c\22content\5c\22:\5c\22\00")
  (data (i32.const 148620) "{\5c\22object\5c\22:\5c\22block\5c\22,\5c\22type\5c\22:\5c\22numbered_list_item\5c\22,\5c\22numbered_list_item\5c\22:{\5c\22rich_text\5c\22:[{\5c\22type\5c\22:\5c\22text\5c\22,\5c\22text\5c\22:{\5c\22content\5c\22:\5c\22\00")
  (data (i32.const 148800) "{\5c\22object\5c\22:\5c\22block\5c\22,\5c\22type\5c\22:\5c\22quote\5c\22,\5c\22quote\5c\22:{\5c\22rich_text\5c\22:[{\5c\22type\5c\22:\5c\22text\5c\22,\5c\22text\5c\22:{\5c\22content\5c\22:\5c\22\00")
  (data (i32.const 148960) "\5c\22}}]}}\00")

  ;; JSON keys & needles (NUL-terminated)
  (data (i32.const 149000) "\22value\22:\22\00")
  (data (i32.const 149020) "\22operation\22\00")
  (data (i32.const 149040) "\22action\22\00")
  (data (i32.const 149060) "\22query\22\00")
  (data (i32.const 149080) "\22title\22\00")
  (data (i32.const 149100) "\22content\22\00")
  (data (i32.const 149120) "\22extra\22\00")
  (data (i32.const 149140) "\22token\22\00")
  (data (i32.const 149160) "\22parent_id\22\00")

  (data (i32.const 149200) "create\00")
  (data (i32.const 149220) "search\00")
  (data (i32.const 149240) "list\00")
  (data (i32.const 149260) "status\00")
  (data (i32.const 149280) "config\00")
  (data (i32.const 149300) "parent\00")
  (data (i32.const 149320) "disconnect\00")
  (data (i32.const 149340) "help\00")
  (data (i32.const 149360) "secret_\00")
  (data (i32.const 149380) "ntn_\00")

  (data (i32.const 149400) "\22statusCode\22:200\00")
  (data (i32.const 149430) "\22results\22:[]\00")
  (data (i32.const 149460) "\22id\22:\22\00")
  (data (i32.const 149480) "\22url\22:\22https://\00")
  (data (i32.const 149510) "\22plain_text\22:\22\00")
  (data (i32.const 149540) "\22message\22:\22\00")
  (data (i32.const 149560) "\22object\22:\22\00")

  ;; ── Utility Functions ────────────────────────────────────────────────────

  (func $zlen (param $ptr i32) (result i32)
    (local $i i32)
    (local.set $i (i32.const 0))
    (loop $zl
      (if (i32.ne (i32.load8_u (i32.add (local.get $ptr) (local.get $i))) (i32.const 0))
        (then
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $zl)
        )
      )
    )
    (local.get $i)
  )

  (func $copy_mem (param $src i32) (param $dst i32) (param $len i32) (result i32)
    (if (i32.gt_s (local.get $len) (i32.const 0))
      (then
        (memory.copy (local.get $dst) (local.get $src) (local.get $len))
        (return (i32.add (local.get $dst) (local.get $len)))
      )
    )
    (local.get $dst)
  )

  (func $copy_zstr (param $src i32) (param $dst i32) (result i32)
    (local $len i32)
    (local.set $len (call $zlen (local.get $src)))
    (call $copy_mem (local.get $src) (local.get $dst) (local.get $len))
  )

  (func $to_lower (param $src i32) (param $dst i32) (param $len i32)
    (local $i i32)
    (local $ch i32)
    (local.set $i (i32.const 0))
    (loop $l_loop
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 90)))
            (then (local.set $ch (i32.add (local.get $ch) (i32.const 32))))
          )
          (i32.store8 (i32.add (local.get $dst) (local.get $i)) (local.get $ch))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l_loop)
        )
      )
    )
  )

  (func $is_ws (param $ch i32) (result i32)
    (i32.or
      (i32.or (i32.eq (local.get $ch) (i32.const 32)) (i32.eq (local.get $ch) (i32.const 9)))
      (i32.or (i32.eq (local.get $ch) (i32.const 10)) (i32.eq (local.get $ch) (i32.const 13)))
    )
  )

  (func $hex_val (param $ch i32) (result i32)
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 48)) (i32.le_u (local.get $ch) (i32.const 57)))
      (then (return (i32.sub (local.get $ch) (i32.const 48))))
    )
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 70)))
      (then (return (i32.sub (local.get $ch) (i32.const 55))))
    )
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 97)) (i32.le_u (local.get $ch) (i32.const 102)))
      (then (return (i32.sub (local.get $ch) (i32.const 87))))
    )
    (i32.const -1)
  )

  (func $emit_utf8 (param $dst i32) (param $cp i32) (result i32)
    (if (i32.lt_u (local.get $cp) (i32.const 128))
      (then
        (i32.store8 (local.get $dst) (local.get $cp))
        (return (i32.add (local.get $dst) (i32.const 1)))
      )
    )
    (if (i32.lt_u (local.get $cp) (i32.const 2048))
      (then
        (i32.store8 (local.get $dst) (i32.or (i32.const 192) (i32.shr_u (local.get $cp) (i32.const 6))))
        (i32.store8 (i32.add (local.get $dst) (i32.const 1)) (i32.or (i32.const 128) (i32.and (local.get $cp) (i32.const 63))))
        (return (i32.add (local.get $dst) (i32.const 2)))
      )
    )
    (i32.store8 (local.get $dst) (i32.or (i32.const 224) (i32.shr_u (local.get $cp) (i32.const 12))))
    (i32.store8 (i32.add (local.get $dst) (i32.const 1)) (i32.or (i32.const 128) (i32.and (i32.shr_u (local.get $cp) (i32.const 6)) (i32.const 63))))
    (i32.store8 (i32.add (local.get $dst) (i32.const 2)) (i32.or (i32.const 128) (i32.and (local.get $cp) (i32.const 63))))
    (i32.add (local.get $dst) (i32.const 3))
  )

  ;; Decodes 4 hex chars at $ptr into a codepoint, or returns -1 if invalid
  (func $parse_hex4 (param $ptr i32) (result i32)
    (local $h0 i32) (local $h1 i32) (local $h2 i32) (local $h3 i32)
    (local.set $h0 (call $hex_val (i32.load8_u (local.get $ptr))))
    (local.set $h1 (call $hex_val (i32.load8_u (i32.add (local.get $ptr) (i32.const 1)))))
    (local.set $h2 (call $hex_val (i32.load8_u (i32.add (local.get $ptr) (i32.const 2)))))
    (local.set $h3 (call $hex_val (i32.load8_u (i32.add (local.get $ptr) (i32.const 3)))))
    (if (i32.or
          (i32.or (i32.lt_s (local.get $h0) (i32.const 0)) (i32.lt_s (local.get $h1) (i32.const 0)))
          (i32.or (i32.lt_s (local.get $h2) (i32.const 0)) (i32.lt_s (local.get $h3) (i32.const 0))))
      (then (return (i32.const -1)))
    )
    (i32.or
      (i32.or (i32.shl (local.get $h0) (i32.const 12)) (i32.shl (local.get $h1) (i32.const 8)))
      (i32.or (i32.shl (local.get $h2) (i32.const 4)) (local.get $h3))
    )
  )

  (func $find_substring (param $haystack i32) (param $h_len i32) (param $needle i32) (param $n_len i32) (result i32)
    (local $i i32)
    (local $j i32)
    (local $match i32)
    (if (i32.lt_s (local.get $h_len) (local.get $n_len))
      (then (return (i32.const -1)))
    )
    (local.set $i (i32.const 0))
    (loop $outer
      (if (i32.gt_u (i32.add (local.get $i) (local.get $n_len)) (local.get $h_len))
        (then (return (i32.const -1)))
      )
      (local.set $j (i32.const 0))
      (local.set $match (i32.const 1))
      (loop $inner
        (if (i32.lt_u (local.get $j) (local.get $n_len))
          (then
            (if (i32.ne
                  (i32.load8_u (i32.add (local.get $haystack) (i32.add (local.get $i) (local.get $j))))
                  (i32.load8_u (i32.add (local.get $needle) (local.get $j))))
              (then (local.set $match (i32.const 0)))
              (else
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br $inner)
              )
            )
          )
        )
      )
      (if (local.get $match)
        (then (return (local.get $i)))
      )
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $outer)
    )
    (i32.const -1)
  )

  ;; Finds `"key"` followed by optional whitespace, `:`, optional whitespace, `"`, returning offset of value start (or -1)
  (func $find_json_key_val (param $src i32) (param $src_len i32) (param $key_ptr i32) (result i32)
    (local $key_len i32)
    (local $pos i32)
    (local $rel i32)
    (local $k i32)
    (local.set $key_len (call $zlen (local.get $key_ptr)))
    (local.set $pos (i32.const 0))
    (loop $search
      (if (i32.ge_u (local.get $pos) (local.get $src_len))
        (then (return (i32.const -1)))
      )
      (local.set $rel (call $find_substring
        (i32.add (local.get $src) (local.get $pos))
        (i32.sub (local.get $src_len) (local.get $pos))
        (local.get $key_ptr)
        (local.get $key_len)
      ))
      (if (i32.lt_s (local.get $rel) (i32.const 0))
        (then (return (i32.const -1)))
      )
      (local.set $k (i32.add (i32.add (local.get $pos) (local.get $rel)) (local.get $key_len)))
      (loop $ws1
        (if (i32.and (i32.lt_u (local.get $k) (local.get $src_len))
                     (call $is_ws (i32.load8_u (i32.add (local.get $src) (local.get $k)))))
          (then
            (local.set $k (i32.add (local.get $k) (i32.const 1)))
            (br $ws1)
          )
        )
      )
      (if (i32.and (i32.lt_u (local.get $k) (local.get $src_len))
                   (i32.eq (i32.load8_u (i32.add (local.get $src) (local.get $k))) (i32.const 58))) ;; ':'
        (then
          (local.set $k (i32.add (local.get $k) (i32.const 1)))
          (loop $ws2
            (if (i32.and (i32.lt_u (local.get $k) (local.get $src_len))
                         (call $is_ws (i32.load8_u (i32.add (local.get $src) (local.get $k)))))
              (then
                (local.set $k (i32.add (local.get $k) (i32.const 1)))
                (br $ws2)
              )
            )
          )
          (if (i32.and (i32.lt_u (local.get $k) (local.get $src_len))
                       (i32.eq (i32.load8_u (i32.add (local.get $src) (local.get $k))) (i32.const 34))) ;; '"'
            (then (return (i32.add (local.get $k) (i32.const 1))))
          )
        )
      )
      (local.set $pos (i32.add (i32.add (local.get $pos) (local.get $rel)) (i32.const 1)))
      (br $search)
    )
    (i32.const -1)
  )

  ;; Extracts raw JSON string value for NUL-terminated $key_ptr into $dst_ptr up to $max_len
  (func $extract_json_raw_ws (param $src i32) (param $src_len i32) (param $key_ptr i32) (param $dst_ptr i32) (param $max_len i32) (result i32)
    (local $v_off i32)
    (local $val_start i32)
    (local $i i32)
    (local $out i32)
    (local $ch i32)
    (local $esc i32)

    (local.set $v_off (call $find_json_key_val (local.get $src) (local.get $src_len) (local.get $key_ptr)))
    (if (i32.lt_s (local.get $v_off) (i32.const 0))
      (then (return (i32.const -1)))
    )

    (local.set $val_start (i32.add (local.get $src) (local.get $v_off)))
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 0))
    (local.set $esc (i32.const 0))

    (block $done
      (loop $scan
        (if (i32.ge_u (i32.add (local.get $val_start) (local.get $i)) (i32.add (local.get $src) (local.get $src_len)))
          (then (br $done))
        )
        (if (i32.ge_u (local.get $out) (local.get $max_len))
          (then (br $done))
        )
        (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
        (if (local.get $esc)
          (then
            (local.set $esc (i32.const 0))
            (i32.store8 (i32.add (local.get $dst_ptr) (local.get $out)) (local.get $ch))
            (local.set $out (i32.add (local.get $out) (i32.const 1)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)
          )
          (else
            (if (i32.eq (local.get $ch) (i32.const 92))
              (then
                (local.set $esc (i32.const 1))
                (i32.store8 (i32.add (local.get $dst_ptr) (local.get $out)) (local.get $ch))
                (local.set $out (i32.add (local.get $out) (i32.const 1)))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (br $scan)
              )
            )
            (if (i32.eq (local.get $ch) (i32.const 34))
              (then (br $done))
            )
            (i32.store8 (i32.add (local.get $dst_ptr) (local.get $out)) (local.get $ch))
            (local.set $out (i32.add (local.get $out) (i32.const 1)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)
          )
        )
      )
    )
    (local.get $out)
  )

  ;; Unescapes Host API HTTP response JSON string in linear memory
  (func $unescape_response (param $src i32) (param $len i32) (param $dst i32) (result i32)
    (local $i i32)
    (local $out i32)
    (local $ch i32)
    (local $next i32)
    (local.set $i (i32.const 0))
    (local.set $out (local.get $dst))
    (loop $u_loop
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.and (i32.eq (local.get $ch) (i32.const 92)) (i32.lt_u (i32.add (local.get $i) (i32.const 1)) (local.get $len)))
            (then
              (local.set $next (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1)))))
              (if (i32.eq (local.get $next) (i32.const 34))
                (then
                  (i32.store8 (local.get $out) (i32.const 34))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $i (i32.add (local.get $i) (i32.const 2)))
                  (br $u_loop)
                )
              )
              (if (i32.eq (local.get $next) (i32.const 92))
                (then
                  (i32.store8 (local.get $out) (i32.const 92))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $i (i32.add (local.get $i) (i32.const 2)))
                  (br $u_loop)
                )
              )
              (if (i32.eq (local.get $next) (i32.const 110))
                (then
                  (i32.store8 (local.get $out) (i32.const 10))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $i (i32.add (local.get $i) (i32.const 2)))
                  (br $u_loop)
                )
              )
            )
          )
          (i32.store8 (local.get $out) (local.get $ch))
          (local.set $out (i32.add (local.get $out) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $u_loop)
        )
      )
    )
    (i32.sub (local.get $out) (local.get $dst))
  )

  ;; Loads stored API Token into 1302000
  (func $load_api_token (result i32)
    (local $res_len i32)
    (local $val_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)
    (local $req_len i32)

    (local.set $req_len (call $zlen (i32.const 145100)))
    (local.set $res_len (call $host_call (i32.const 145100) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 1300000) (local.get $res_len) (i32.const 149000) (i32.const 9)))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 1300000) (i32.add (local.get $val_idx) (i32.const 9))))
    (local.set $i (i32.const 0))
    (loop $copy_key
      (if (i32.lt_u (local.get $i) (i32.const 200))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
          (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 0)))
            (then
              (i32.store8 (i32.add (i32.const 1302000) (local.get $i)) (local.get $ch))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $copy_key)
            )
          )
        )
      )
    )
    (global.set $token_len (local.get $i))
    (local.get $i)
  )

  ;; Loads stored Parent Page ID into 1307000
  (func $load_parent_id (result i32)
    (local $res_len i32)
    (local $val_idx i32)
    (local $val_start i32)
    (local $i i32)
    (local $ch i32)
    (local $req_len i32)

    (local.set $req_len (call $zlen (i32.const 145420)))
    (local.set $res_len (call $host_call (i32.const 145420) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_idx (call $find_substring (i32.const 1300000) (local.get $res_len) (i32.const 149000) (i32.const 9)))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0))
      (then (return (i32.const 0)))
    )

    (local.set $val_start (i32.add (i32.const 1300000) (i32.add (local.get $val_idx) (i32.const 9))))
    (local.set $i (i32.const 0))
    (loop $copy_p_id
      (if (i32.lt_u (local.get $i) (i32.const 60))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
          (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 0)))
            (then
              (i32.store8 (i32.add (i32.const 1307000) (local.get $i)) (local.get $ch))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $copy_p_id)
            )
          )
        )
      )
    )
    (global.set $parent_len (local.get $i))
    (local.get $i)
  )

  ;; Decodes raw JSON single-line title/query (with \uXXXX) into 1303000 (UTF-8 safe <= 500 bytes)
  (func $sanitize_single_line (param $src i32) (param $len i32) (result i32)
    (local $i i32)
    (local $out i32)
    (local $ch i32)
    (local $next i32)
    (local $cp i32)
    (local $next_out i32)
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 0))
    (loop $s_loop
      (if (i32.and (i32.lt_u (local.get $i) (local.get $len)) (i32.lt_u (local.get $out) (i32.const 490)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 92)) ;; '\'
            (then
              (if (i32.lt_u (i32.add (local.get $i) (i32.const 1)) (local.get $len))
                (then
                  (local.set $next (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1)))))
                  (if (i32.and (i32.eq (local.get $next) (i32.const 117)) ;; \uXXXX
                               (i32.le_u (i32.add (local.get $i) (i32.const 6)) (local.get $len)))
                    (then
                      (local.set $cp (call $parse_hex4 (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 2)))))
                      (if (i32.ge_s (local.get $cp) (i32.const 0))
                        (then
                          (local.set $next_out (call $emit_utf8 (i32.add (i32.const 1303000) (local.get $out)) (local.get $cp)))
                          (local.set $out (i32.sub (local.get $next_out) (i32.const 1303000)))
                          (local.set $i (i32.add (local.get $i) (i32.const 6)))
                          (br $s_loop)
                        )
                      )
                    )
                  )
                  (if (i32.or (i32.eq (local.get $next) (i32.const 34)) (i32.eq (local.get $next) (i32.const 92)))
                    (then
                      (i32.store8 (i32.add (i32.const 1303000) (local.get $out)) (local.get $next))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                    )
                    (else
                      (i32.store8 (i32.add (i32.const 1303000) (local.get $out)) (i32.const 32))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                    )
                  )
                  (local.set $i (i32.add (local.get $i) (i32.const 2)))
                  (br $s_loop)
                )
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $s_loop)
            )
          )
          (if (i32.lt_u (local.get $ch) (i32.const 32))
            (then (local.set $ch (i32.const 32)))
          )
          (i32.store8 (i32.add (i32.const 1303000) (local.get $out)) (local.get $ch))
          (local.set $out (i32.add (local.get $out) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $s_loop)
        )
      )
    )
    (global.set $arg_len (local.get $out))
    (local.get $out)
  )

  ;; Decodes raw JSON content at 1400000 into readable UTF-8 at 1600000 (handles \uXXXX, \n, \t, \", \\, \/)
  (func $decode_body_to_preview (param $src i32) (param $len i32) (result i32)
    (local $i i32)
    (local $out i32)
    (local $ch i32)
    (local $next i32)
    (local $cp i32)
    (local $next_out i32)
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 0))
    (loop $d_loop
      (if (i32.and (i32.lt_u (local.get $i) (local.get $len)) (i32.lt_u (local.get $out) (i32.const 32000)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 92)) ;; '\'
            (then
              (if (i32.lt_u (i32.add (local.get $i) (i32.const 1)) (local.get $len))
                (then
                  (local.set $next (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1)))))
                  (if (i32.and (i32.eq (local.get $next) (i32.const 117))
                               (i32.le_u (i32.add (local.get $i) (i32.const 6)) (local.get $len)))
                    (then
                      (local.set $cp (call $parse_hex4 (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 2)))))
                      (if (i32.ge_s (local.get $cp) (i32.const 0))
                        (then
                          (local.set $next_out (call $emit_utf8 (i32.add (i32.const 1600000) (local.get $out)) (local.get $cp)))
                          (local.set $out (i32.sub (local.get $next_out) (i32.const 1600000)))
                          (local.set $i (i32.add (local.get $i) (i32.const 6)))
                          (br $d_loop)
                        )
                      )
                    )
                  )
                  (if (i32.eq (local.get $next) (i32.const 110)) ;; \n
                    (then
                      (i32.store8 (i32.add (i32.const 1600000) (local.get $out)) (i32.const 10))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $d_loop)
                    )
                  )
                  (if (i32.eq (local.get $next) (i32.const 114)) ;; \r -> skip
                    (then
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $d_loop)
                    )
                  )
                  (if (i32.eq (local.get $next) (i32.const 116)) ;; \t -> space
                    (then
                      (i32.store8 (i32.add (i32.const 1600000) (local.get $out)) (i32.const 32))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $d_loop)
                    )
                  )
                  ;; \", \\, \/, or other -> emit $next literally
                  (i32.store8 (i32.add (i32.const 1600000) (local.get $out)) (local.get $next))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                  (local.set $i (i32.add (local.get $i) (i32.const 2)))
                  (br $d_loop)
                )
              )
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $d_loop)
            )
          )
          (if (i32.eq (local.get $ch) (i32.const 13))
            (then
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $d_loop)
            )
          )
          (i32.store8 (i32.add (i32.const 1600000) (local.get $out)) (local.get $ch))
          (local.set $out (i32.add (local.get $out) (i32.const 1)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $d_loop)
        )
      )
    )
    (global.set $preview_len (local.get $out))
    (local.get $out)
  )

  ;; Appends UTF-8 slice from $base [$start..$end) into outer http_request `body` string at $dst,
  ;; properly double-escaping " -> \\\" and \ -> \\\\ and \n -> \\n
  (func $append_json_escaped (param $dst i32) (param $base i32) (param $start i32) (param $end i32) (result i32)
    (local $i i32)
    (local $ch i32)
    (local $p i32)
    (local.set $i (local.get $start))
    (local.set $p (local.get $dst))
    (loop $c_loop
      (if (i32.lt_u (local.get $i) (local.get $end))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $base) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 10)) ;; \n -> \\n
            (then
              (i32.store8 (local.get $p) (i32.const 92))
              (i32.store8 (i32.add (local.get $p) (i32.const 1)) (i32.const 92))
              (i32.store8 (i32.add (local.get $p) (i32.const 2)) (i32.const 110))
              (local.set $p (i32.add (local.get $p) (i32.const 3)))
            )
            (else
              (if (i32.eq (local.get $ch) (i32.const 34)) ;; " -> \\\"
                (then
                  (i32.store8 (local.get $p) (i32.const 92))
                  (i32.store8 (i32.add (local.get $p) (i32.const 1)) (i32.const 92))
                  (i32.store8 (i32.add (local.get $p) (i32.const 2)) (i32.const 92))
                  (i32.store8 (i32.add (local.get $p) (i32.const 3)) (i32.const 34))
                  (local.set $p (i32.add (local.get $p) (i32.const 4)))
                )
                (else
                  (if (i32.eq (local.get $ch) (i32.const 92)) ;; \ -> \\\\
                    (then
                      (i32.store8 (local.get $p) (i32.const 92))
                      (i32.store8 (i32.add (local.get $p) (i32.const 1)) (i32.const 92))
                      (i32.store8 (i32.add (local.get $p) (i32.const 2)) (i32.const 92))
                      (i32.store8 (i32.add (local.get $p) (i32.const 3)) (i32.const 92))
                      (local.set $p (i32.add (local.get $p) (i32.const 4)))
                    )
                    (else
                      (if (i32.lt_u (local.get $ch) (i32.const 32))
                        (then (local.set $ch (i32.const 32)))
                      )
                      (i32.store8 (local.get $p) (local.get $ch))
                      (local.set $p (i32.add (local.get $p) (i32.const 1)))
                    )
                  )
                )
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $c_loop)
        )
      )
    )
    (local.get $p)
  )

  ;; Extracts a 32-char Notion UUID from a raw ID or Notion URL into $dst (returns length 32 or 0)
  (func $extract_notion_uuid (param $src i32) (param $len i32) (param $dst i32) (result i32)
    (local $i i32)
    (local $count i32)
    (local $ch i32)
    (local $j i32)
    (local.set $i (local.get $len))
    (local.set $count (i32.const 0))
    ;; Scan backwards for 32 hex chars (ignoring hyphens)
    (block $done
      (loop $back
        (if (i32.le_s (local.get $i) (i32.const 0))
          (then (br $done))
        )
        (local.set $i (i32.sub (local.get $i) (i32.const 1)))
        (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
        (if (i32.ge_s (call $hex_val (local.get $ch)) (i32.const 0))
          (then
            (local.set $count (i32.add (local.get $count) (i32.const 1)))
            (i32.store8 (i32.add (local.get $dst) (i32.sub (i32.const 32) (local.get $count))) (local.get $ch))
            (if (i32.eq (local.get $count) (i32.const 32))
              (then (return (i32.const 32)))
            )
          )
          (else
            (if (i32.ne (local.get $ch) (i32.const 45)) ;; not '-'
              (then (local.set $count (i32.const 0)))
            )
          )
        )
        (br $back)
      )
    )
    (i32.const 0)
  )

  ;; Checks if line [start..end) in 1600000 is a divider (--- or ***, >=3 chars, only -/* and spaces)
  (func $is_divider_line (param $start i32) (param $end i32) (result i32)
    (local $i i32) (local $ch i32) (local $marks i32)
    (local.set $i (local.get $start))
    (local.set $marks (i32.const 0))
    (loop $dl
      (if (i32.lt_u (local.get $i) (local.get $end))
        (then
          (local.set $ch (i32.load8_u (i32.add (i32.const 1600000) (local.get $i))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 45)) (i32.eq (local.get $ch) (i32.const 42)))
            (then (local.set $marks (i32.add (local.get $marks) (i32.const 1))))
            (else
              (if (i32.ne (local.get $ch) (i32.const 32))
                (then (return (i32.const 0)))
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $dl)
        )
      )
    )
    (i32.ge_u (local.get $marks) (i32.const 3))
  )

  ;; Emits a single Notion text block (or split chunks <=1600 bytes) into $p
  (func $emit_text_block (param $p i32) (param $tmpl i32) (param $start i32) (param $end i32) (param $blocks i32) (result i64)
    (local $cur i32) (local $chunk_end i32) (local $b i32) (local $first i32)
    (local.set $cur (local.get $start))
    (local.set $b (local.get $blocks))
    (local.set $first (i32.const 1))
    (loop $bl
      (if (i32.and (i32.lt_u (local.get $cur) (local.get $end)) (i32.lt_u (local.get $b) (i32.const 95)))
        (then
          (if (i32.gt_u (local.get $b) (i32.const 0))
            (then
              (i32.store8 (local.get $p) (i32.const 44)) ;; ','
              (local.set $p (i32.add (local.get $p) (i32.const 1)))
            )
          )
          (local.set $chunk_end (i32.add (local.get $cur) (i32.const 1600)))
          (if (i32.ge_u (local.get $chunk_end) (local.get $end))
            (then (local.set $chunk_end (local.get $end)))
            (else
              (loop $utf8_back
                (if (i32.and
                      (i32.gt_u (local.get $chunk_end) (local.get $cur))
                      (i32.eq (i32.and (i32.load8_u (i32.add (i32.const 1600000) (local.get $chunk_end))) (i32.const 192)) (i32.const 128)))
                  (then
                    (local.set $chunk_end (i32.sub (local.get $chunk_end) (i32.const 1)))
                    (br $utf8_back)
                  )
                )
              )
            )
          )
          (local.set $p (call $copy_zstr (if (result i32) (local.get $first) (then (local.get $tmpl)) (else (i32.const 147800))) (local.get $p)))
          (local.set $p (call $append_json_escaped (local.get $p) (i32.const 1600000) (local.get $cur) (local.get $chunk_end)))
          (local.set $p (call $copy_zstr (i32.const 148960) (local.get $p)))
          (local.set $first (i32.const 0))
          (local.set $b (i32.add (local.get $b) (i32.const 1)))
          (local.set $cur (local.get $chunk_end))
          (br $bl)
        )
      )
    )
    (i64.or
      (i64.shl (i64.extend_i32_u (local.get $p)) (i64.const 32))
      (i64.extend_i32_u (local.get $b))
    )
  )

  ;; Builds and dispatches POST /v1/pages with native Notion Markdown blocks
  (func $send_create_page (result i32)
    (local $p i32)
    (local $req_len i32)
    (local $cur i32)
    (local $total i32)
    (local $line_end i32)
    (local $ls i32)
    (local $le i32)
    (local $ch i32)
    (local $tmpl i32)
    (local $text_start i32)
    (local $blocks i32)
    (local $k i32)
    (local $packed i64)

    (local.set $p (call $copy_zstr (i32.const 147100) (i32.const 200000)))
    (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
    (local.set $p (call $copy_zstr (i32.const 147300) (local.get $p)))
    (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $parent_len)))
    (local.set $p (call $copy_zstr (i32.const 147440) (local.get $p)))
    (local.set $p (call $append_json_escaped (local.get $p) (i32.const 1303000) (i32.const 0) (global.get $arg_len)))

    (local.set $total (global.get $preview_len))
    (if (i32.gt_u (local.get $total) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const 147600) (local.get $p)))
        (local.set $cur (i32.const 0))
        (local.set $blocks (i32.const 0))

        (loop $line_loop
          (if (i32.and (i32.lt_u (local.get $cur) (local.get $total)) (i32.lt_u (local.get $blocks) (i32.const 95)))
            (then
              (local.set $line_end (local.get $cur))
              (loop $find_eol
                (if (i32.and (i32.lt_u (local.get $line_end) (local.get $total))
                             (i32.ne (i32.load8_u (i32.add (i32.const 1600000) (local.get $line_end))) (i32.const 10)))
                  (then
                    (local.set $line_end (i32.add (local.get $line_end) (i32.const 1)))
                    (br $find_eol)
                  )
                )
              )
              ;; Trim leading spaces
              (local.set $ls (local.get $cur))
              (loop $trim_l
                (if (i32.and (i32.lt_u (local.get $ls) (local.get $line_end))
                             (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (local.get $ls))) (i32.const 32)))
                  (then
                    (local.set $ls (i32.add (local.get $ls) (i32.const 1)))
                    (br $trim_l)
                  )
                )
              )
              (local.set $le (local.get $line_end))
              (if (i32.lt_u (local.get $ls) (local.get $le))
                (then
                  (if (call $is_divider_line (local.get $ls) (local.get $le))
                    (then
                      (if (i32.gt_u (local.get $blocks) (i32.const 0))
                        (then
                          (i32.store8 (local.get $p) (i32.const 44))
                          (local.set $p (i32.add (local.get $p) (i32.const 1)))
                        )
                      )
                      (local.set $p (call $copy_zstr (i32.const 147700) (local.get $p)))
                      (local.set $blocks (i32.add (local.get $blocks) (i32.const 1)))
                    )
                    (else
                      (local.set $tmpl (i32.const 147800)) ;; default paragraph
                      (local.set $text_start (local.get $ls))
                      (local.set $ch (i32.load8_u (i32.add (i32.const 1600000) (local.get $ls))))

                      ;; Check ### / ## / #
                      (if (i32.eq (local.get $ch) (i32.const 35)) ;; '#'
                        (then
                          (if (i32.and (i32.le_u (i32.add (local.get $ls) (i32.const 4)) (local.get $le))
                                       (i32.and (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (i32.add (local.get $ls) (i32.const 1)))) (i32.const 35))
                                                (i32.and (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (i32.add (local.get $ls) (i32.const 2)))) (i32.const 35))
                                                         (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (i32.add (local.get $ls) (i32.const 3)))) (i32.const 32)))))
                            (then
                              (local.set $tmpl (i32.const 148280))
                              (local.set $text_start (i32.add (local.get $ls) (i32.const 4)))
                            )
                            (else
                              (if (i32.and (i32.le_u (i32.add (local.get $ls) (i32.const 3)) (local.get $le))
                                           (i32.and (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (i32.add (local.get $ls) (i32.const 1)))) (i32.const 35))
                                                    (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (i32.add (local.get $ls) (i32.const 2)))) (i32.const 32))))
                                (then
                                  (local.set $tmpl (i32.const 148120))
                                  (local.set $text_start (i32.add (local.get $ls) (i32.const 3)))
                                )
                                (else
                                  (if (i32.and (i32.le_u (i32.add (local.get $ls) (i32.const 2)) (local.get $le))
                                               (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (i32.add (local.get $ls) (i32.const 1)))) (i32.const 32)))
                                    (then
                                      (local.set $tmpl (i32.const 147960))
                                      (local.set $text_start (i32.add (local.get $ls) (i32.const 2)))
                                    )
                                  )
                                )
                              )
                            )
                          )
                        )
                        (else
                          ;; Check '> ' quote
                          (if (i32.and (i32.eq (local.get $ch) (i32.const 62))
                                       (i32.and (i32.le_u (i32.add (local.get $ls) (i32.const 2)) (local.get $le))
                                                (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (i32.add (local.get $ls) (i32.const 1)))) (i32.const 32))))
                            (then
                              (local.set $tmpl (i32.const 148800))
                              (local.set $text_start (i32.add (local.get $ls) (i32.const 2)))
                            )
                            (else
                              ;; Check '- ' or '* ' bullet
                              (if (i32.and (i32.or (i32.eq (local.get $ch) (i32.const 45)) (i32.eq (local.get $ch) (i32.const 42)))
                                           (i32.and (i32.le_u (i32.add (local.get $ls) (i32.const 2)) (local.get $le))
                                                    (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (i32.add (local.get $ls) (i32.const 1)))) (i32.const 32))))
                                (then
                                  (local.set $tmpl (i32.const 148440))
                                  (local.set $text_start (i32.add (local.get $ls) (i32.const 2)))
                                )
                                (else
                                  ;; Check UTF-8 bullet '• ' (0xE2 0x80 0xA2 0x20)
                                  (if (i32.and (i32.le_u (i32.add (local.get $ls) (i32.const 4)) (local.get $le))
                                               (i32.and (i32.eq (local.get $ch) (i32.const 226))
                                                        (i32.and (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (i32.add (local.get $ls) (i32.const 1)))) (i32.const 128))
                                                                 (i32.and (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (i32.add (local.get $ls) (i32.const 2)))) (i32.const 162))
                                                                          (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (i32.add (local.get $ls) (i32.const 3)))) (i32.const 32))))))
                                    (then
                                      (local.set $tmpl (i32.const 148440))
                                      (local.set $text_start (i32.add (local.get $ls) (i32.const 4)))
                                    )
                                    (else
                                      ;; Check numbered list '<digits>. '
                                      (local.set $k (local.get $ls))
                                      (loop $num_scan
                                        (if (i32.and (i32.lt_u (local.get $k) (local.get $le))
                                                     (i32.and (i32.ge_u (i32.load8_u (i32.add (i32.const 1600000) (local.get $k))) (i32.const 48))
                                                              (i32.le_u (i32.load8_u (i32.add (i32.const 1600000) (local.get $k))) (i32.const 57))))
                                          (then
                                            (local.set $k (i32.add (local.get $k) (i32.const 1)))
                                            (br $num_scan)
                                          )
                                        )
                                      )
                                      (if (i32.and (i32.gt_u (local.get $k) (local.get $ls))
                                                   (i32.and (i32.le_u (i32.add (local.get $k) (i32.const 2)) (local.get $le))
                                                            (i32.and (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (local.get $k))) (i32.const 46))
                                                                     (i32.eq (i32.load8_u (i32.add (i32.const 1600000) (i32.add (local.get $k) (i32.const 1)))) (i32.const 32)))))
                                        (then
                                          (local.set $tmpl (i32.const 148620))
                                          (local.set $text_start (i32.add (local.get $k) (i32.const 2)))
                                        )
                                      )
                                    )
                                  )
                                )
                              )
                            )
                          )
                        )
                      )

                      (if (i32.lt_u (local.get $text_start) (local.get $le))
                        (then
                          (local.set $packed (call $emit_text_block (local.get $p) (local.get $tmpl) (local.get $text_start) (local.get $le) (local.get $blocks)))
                          (local.set $p (i32.wrap_i64 (i64.shr_u (local.get $packed) (i64.const 32))))
                          (local.set $blocks (i32.wrap_i64 (local.get $packed)))
                        )
                      )
                    )
                  )
                )
              )
              (local.set $cur (i32.add (local.get $line_end) (i32.const 1)))
              (br $line_loop)
            )
          )
        )

        (local.set $p (call $copy_zstr (i32.const 147650) (local.get $p)))
      )
      (else
        (local.set $p (call $copy_zstr (i32.const 147550) (local.get $p)))
      )
    )

    (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
    (global.set $phase (i32.const 5))
    (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
    (i32.const 0)
  )

  ;; Helper: write NUL-terminated static string at $src into output buffer 65536 and return its length
  (func $return_static (param $src i32) (result i32)
    (local $end i32)
    (local.set $end (call $copy_zstr (local.get $src) (i32.const 65536)))
    (i32.sub (local.get $end) (i32.const 65536))
  )

  ;; ── Main Entrypoint ──────────────────────────────────────────────────────
  (func (export "notion_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $pos i32)
    (local $token_start i32)
    (local $raw_len i32)
    (local $p i32)
    (local $req_len i32)
    (local $i i32)
    (local $ch i32)
    (local $has_saved_parent i32)
    (local $title_len i32)
    (local $query_len i32)
    (local $content_len i32)
    (local $tok_json_len i32)
    (local $par_json_len i32)
    (local $uuid_len i32)

    ;; Reset globals
    (global.set $arg_len (i32.const 0))
    (global.set $op_len (i32.const 0))
    (global.set $raw_body_len (i32.const 0))
    (global.set $preview_len (i32.const 0))

    ;; 1. Empty input -> Help
    (if (i32.eqz (local.get $in_len))
      (then (return (call $return_static (i32.const 140000))))
    )

    ;; 2. Extract AI Intent Contract JSON fields (whitespace-tolerant)
    (local.set $raw_len (call $extract_json_raw_ws (local.get $in_ptr) (local.get $in_len) (i32.const 149020) (i32.const 1306000) (i32.const 64)))
    (if (i32.lt_s (local.get $raw_len) (i32.const 0))
      (then
        (local.set $raw_len (call $extract_json_raw_ws (local.get $in_ptr) (local.get $in_len) (i32.const 149040) (i32.const 1306000) (i32.const 64)))
      )
    )
    (if (i32.gt_s (local.get $raw_len) (i32.const 0))
      (then
        (call $to_lower (i32.const 1306000) (i32.const 1306000) (local.get $raw_len))
        (global.set $op_len (local.get $raw_len))
      )
    )

    (local.set $title_len (call $extract_json_raw_ws (local.get $in_ptr) (local.get $in_len) (i32.const 149080) (i32.const 1310000) (i32.const 1000)))
    (local.set $query_len (call $extract_json_raw_ws (local.get $in_ptr) (local.get $in_len) (i32.const 149060) (i32.const 1312000) (i32.const 1000)))

    (local.set $content_len (call $extract_json_raw_ws (local.get $in_ptr) (local.get $in_len) (i32.const 149100) (i32.const 1400000) (i32.const 45000)))
    (if (i32.le_s (local.get $content_len) (i32.const 0))
      (then
        (local.set $content_len (call $extract_json_raw_ws (local.get $in_ptr) (local.get $in_len) (i32.const 149120) (i32.const 1400000) (i32.const 45000)))
      )
    )
    (if (i32.gt_s (local.get $content_len) (i32.const 0))
      (then
        (global.set $raw_body_len (local.get $content_len))
        (drop (call $decode_body_to_preview (i32.const 1400000) (local.get $content_len)))
      )
    )

    ;; 3. Direct token paste ONLY when input is NOT an AI JSON intent payload
    (if (i32.and (i32.eqz (global.get $op_len))
                 (i32.and (i32.le_s (local.get $title_len) (i32.const 0)) (i32.le_s (local.get $content_len) (i32.const 0))))
      (then
        (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 149360) (i32.const 7)))
        (if (i32.lt_s (local.get $pos) (i32.const 0))
          (then
            (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 149380) (i32.const 4)))
          )
        )
        (if (i32.ge_s (local.get $pos) (i32.const 0))
          (then
            (local.set $token_start (i32.add (local.get $in_ptr) (local.get $pos)))
            (local.set $i (i32.const 0))
            (loop $scan_direct_tok
              (if (i32.lt_u (i32.add (local.get $token_start) (local.get $i)) (i32.add (local.get $in_ptr) (local.get $in_len)))
                (then
                  (if (i32.lt_u (local.get $i) (i32.const 120))
                    (then
                      (local.set $ch (i32.load8_u (i32.add (local.get $token_start) (local.get $i))))
                      (if (i32.and
                            (i32.and (i32.gt_u (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 34)))
                            (i32.and (i32.ne (local.get $ch) (i32.const 39)) (i32.ne (local.get $ch) (i32.const 125))))
                        (then
                          (i32.store8 (i32.add (i32.const 1302000) (local.get $i)) (local.get $ch))
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $scan_direct_tok)
                        )
                      )
                    )
                  )
                )
              )
            )
            (global.set $token_len (local.get $i))
            (if (i32.gt_u (global.get $token_len) (i32.const 10))
              (then
                (local.set $p (call $copy_zstr (i32.const 145200) (i32.const 200000)))
                (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
                (local.set $p (call $copy_zstr (i32.const 145300) (local.get $p)))
                (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
                (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

                (local.set $p (call $copy_zstr (i32.const 145720) (i32.const 200000)))
                (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
                (local.set $p (call $copy_zstr (i32.const 145920) (local.get $p)))
                (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
                (global.set $phase (i32.const 1))
                (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
                (return (i32.const 0))
              )
            )
          )
        )
      )
    )

    ;; ── Dispatch by AI Operation ──

    ;; A. "help"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149340) (i32.const 4)) (i32.const 0))
      (then (return (call $return_static (i32.const 140000))))
    )

    ;; B. "disconnect"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149320) (i32.const 10)) (i32.const 0))
      (then
        (local.set $req_len (call $zlen (i32.const 145320)))
        (drop (call $host_call (i32.const 145320) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))
        (return (call $return_static (i32.const 142400)))
      )
    )

    ;; C. "status"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149260) (i32.const 6)) (i32.const 0))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then (return (call $return_static (i32.const 142000))))
        )
        (local.set $p (call $copy_zstr (i32.const 145720) (i32.const 200000)))
        (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_zstr (i32.const 145920) (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (global.set $phase (i32.const 2))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; D. "config"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149280) (i32.const 6)) (i32.const 0))
      (then
        (local.set $tok_json_len (call $extract_json_raw_ws (local.get $in_ptr) (local.get $in_len) (i32.const 149140) (i32.const 1302000) (i32.const 150)))
        (if (i32.le_s (local.get $tok_json_len) (i32.const 0))
          (then
            (if (i32.gt_s (local.get $query_len) (i32.const 0))
              (then
                (drop (call $copy_mem (i32.const 1312000) (i32.const 1302000) (local.get $query_len)))
                (local.set $tok_json_len (local.get $query_len))
              )
            )
          )
        )
        (if (i32.gt_s (local.get $tok_json_len) (i32.const 8))
          (then
            (global.set $token_len (local.get $tok_json_len))
            (local.set $p (call $copy_zstr (i32.const 145200) (i32.const 200000)))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_zstr (i32.const 145300) (local.get $p)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

            (local.set $p (call $copy_zstr (i32.const 145720) (i32.const 200000)))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_zstr (i32.const 145920) (local.get $p)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (global.set $phase (i32.const 1))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
            (return (i32.const 0))
          )
        )
        (return (call $return_static (i32.const 142000)))
      )
    )

    ;; E. "parent" (supports raw UUID or full Notion page URL)
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149300) (i32.const 6)) (i32.const 0))
      (then
        (local.set $par_json_len (call $extract_json_raw_ws (local.get $in_ptr) (local.get $in_len) (i32.const 149160) (i32.const 1314000) (i32.const 240)))
        (if (i32.le_s (local.get $par_json_len) (i32.const 0))
          (then
            (if (i32.gt_s (local.get $query_len) (i32.const 0))
              (then
                (drop (call $copy_mem (i32.const 1312000) (i32.const 1314000) (local.get $query_len)))
                (local.set $par_json_len (local.get $query_len))
              )
            )
          )
        )
        (if (i32.gt_s (local.get $par_json_len) (i32.const 10))
          (then
            (local.set $uuid_len (call $extract_notion_uuid (i32.const 1314000) (local.get $par_json_len) (i32.const 1307000)))
            (if (i32.gt_u (local.get $uuid_len) (i32.const 0))
              (then (global.set $parent_len (local.get $uuid_len)))
              (else
                (if (i32.gt_u (local.get $par_json_len) (i32.const 60))
                  (then (local.set $par_json_len (i32.const 60)))
                )
                (drop (call $copy_mem (i32.const 1314000) (i32.const 1307000) (local.get $par_json_len)))
                (global.set $parent_len (local.get $par_json_len))
              )
            )
            (local.set $p (call $copy_zstr (i32.const 145520) (i32.const 200000)))
            (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $parent_len)))
            (local.set $p (call $copy_zstr (i32.const 145300) (local.get $p)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))
            (return (call $return_static (i32.const 144000)))
          )
        )
      )
    )

    ;; F. "create" (or if "content" or "title" was provided)
    (if (i32.or
          (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149200) (i32.const 6)) (i32.const 0))
          (i32.or (i32.gt_s (local.get $content_len) (i32.const 0)) (i32.gt_s (local.get $title_len) (i32.const 0))))
      (then
        (if (i32.gt_s (local.get $title_len) (i32.const 0))
          (then (drop (call $sanitize_single_line (i32.const 1310000) (local.get $title_len))))
          (else
            (if (i32.gt_s (local.get $query_len) (i32.const 0))
              (then (drop (call $sanitize_single_line (i32.const 1312000) (local.get $query_len))))
              (else
                (local.set $p (call $copy_zstr (i32.const 144950) (i32.const 1303000)))
                (global.set $arg_len (i32.sub (local.get $p) (i32.const 1303000)))
              )
            )
          )
        )

        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then (return (call $return_static (i32.const 142000))))
        )

        (local.set $has_saved_parent (call $load_parent_id))
        (if (i32.gt_u (local.get $has_saved_parent) (i32.const 0))
          (then (return (call $send_create_page)))
        )

        ;; Auto-discover parent page in Notion workspace
        (local.set $p (call $copy_zstr (i32.const 146050) (i32.const 200000)))
        (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_zstr (i32.const 146780) (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (global.set $phase (i32.const 4))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; G. "search" / "list"
    (local.set $raw_len (call $load_api_token))
    (if (i32.eqz (local.get $raw_len))
      (then (return (call $return_static (i32.const 142000))))
    )

    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149240) (i32.const 4)) (i32.const 0))
      (then (global.set $arg_len (i32.const 0)))
      (else
        (if (i32.gt_s (local.get $query_len) (i32.const 0))
          (then (drop (call $sanitize_single_line (i32.const 1312000) (local.get $query_len))))
          (else (global.set $arg_len (i32.const 0)))
        )
      )
    )

    (local.set $p (call $copy_zstr (i32.const 146050) (i32.const 200000)))
    (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
    (if (i32.gt_u (global.get $arg_len) (i32.const 0))
      (then
        (local.set $p (call $copy_zstr (i32.const 146250) (local.get $p)))
        (local.set $p (call $append_json_escaped (local.get $p) (i32.const 1303000) (i32.const 0) (global.get $arg_len)))
        (local.set $p (call $copy_zstr (i32.const 146380) (local.get $p)))
      )
      (else
        (local.set $p (call $copy_zstr (i32.const 146550) (local.get $p)))
      )
    )
    (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
    (global.set $phase (i32.const 3))
    (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
    (i32.const 0)
  )

  ;; ── Resume Handler (Async HTTP Response) ─────────────────────────────────
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $is_200 i32)
    (local $idx i32)
    (local $p i32)
    (local $req_len i32)
    (local $scan_ptr i32)
    (local $scan_end i32)
    (local $item_count i32)
    (local $url_start i32)
    (local $url_len i32)
    (local $url_end i32)
    (local $next_url_idx i32)
    (local $next_bound i32)
    (local $title_start i32)
    (local $title_len i32)
    (local $i i32)
    (local $ch i32)
    (local $u_len i32)
    (local $msg_start i32)
    (local $msg_len i32)
    (local $prev_copy_len i32)

    (local.set $u_len (call $unescape_response (local.get $res_ptr) (local.get $res_len) (i32.const 900000)))
    (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 149400) (i32.const 16)))
    (local.set $is_200 (i32.ge_s (local.get $idx) (i32.const 0)))

    ;; ─── Phase 1: Config Verification ───
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (if (local.get $is_200)
          (then (return (call $return_static (i32.const 141200))))
          (else (return (call $return_static (i32.const 141600))))
        )
      )
    )

    ;; ─── Phase 2: Status Check ───
    (if (i32.eq (global.get $phase) (i32.const 2))
      (then
        (if (local.get $is_200)
          (then (return (call $return_static (i32.const 142600))))
          (else (return (call $return_static (i32.const 143000))))
        )
      )
    )

    ;; ─── Phase 3: Search / List (bounded per-item title extraction) ───
    (if (i32.eq (global.get $phase) (i32.const 3))
      (then
        (if (i32.eqz (local.get $is_200))
          (then (return (call $return_static (i32.const 143700))))
        )

        (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 149430) (i32.const 12)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then (return (call $return_static (i32.const 143400))))
        )

        (local.set $p (call $copy_zstr (i32.const 143300) (i32.const 65536)))
        (local.set $scan_ptr (i32.const 900000))
        (local.set $scan_end (i32.add (i32.const 900000) (local.get $u_len)))
        (local.set $item_count (i32.const 0))

        (loop $parse_items
          (if (i32.and (i32.lt_u (local.get $item_count) (i32.const 5)) (i32.lt_u (local.get $scan_ptr) (local.get $scan_end)))
            (then
              (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const 149480) (i32.const 15)))
              (if (i32.ge_s (local.get $idx) (i32.const 0))
                (then
                  (local.set $url_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const 7)))
                  (local.set $i (i32.const 0))
                  (loop $find_url_end
                    (if (i32.lt_u (i32.add (local.get $url_start) (local.get $i)) (local.get $scan_end))
                      (then
                        (if (i32.ne (i32.load8_u (i32.add (local.get $url_start) (local.get $i))) (i32.const 34))
                          (then
                            (local.set $i (i32.add (local.get $i) (i32.const 1)))
                            (br $find_url_end)
                          )
                        )
                      )
                    )
                  )
                  (local.set $url_len (local.get $i))
                  (local.set $url_end (i32.add (local.get $url_start) (local.get $url_len)))

                  ;; Bound title search to [$scan_ptr .. $url_start] first, then [$url_end .. next_url]
                  (local.set $title_start (i32.const 144980))
                  (local.set $title_len (call $zlen (i32.const 144980)))
                  (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $url_start) (local.get $scan_ptr)) (i32.const 149510) (i32.const 14)))
                  (if (i32.ge_s (local.get $idx) (i32.const 0))
                    (then
                      (local.set $title_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const 14)))
                    )
                    (else
                      (local.set $next_url_idx (call $find_substring (local.get $url_end) (i32.sub (local.get $scan_end) (local.get $url_end)) (i32.const 149480) (i32.const 15)))
                      (local.set $next_bound (if (result i32) (i32.ge_s (local.get $next_url_idx) (i32.const 0))
                        (then (i32.add (local.get $url_end) (local.get $next_url_idx)))
                        (else (local.get $scan_end))))
                      (local.set $next_url_idx (call $find_substring (local.get $url_end) (i32.sub (local.get $next_bound) (local.get $url_end)) (i32.const 149560) (i32.const 10)))
                      (if (i32.ge_s (local.get $next_url_idx) (i32.const 0))
                        (then (local.set $next_bound (i32.add (local.get $url_end) (local.get $next_url_idx))))
                      )
                      (local.set $idx (call $find_substring (local.get $url_end) (i32.sub (local.get $next_bound) (local.get $url_end)) (i32.const 149510) (i32.const 14)))
                      (if (i32.ge_s (local.get $idx) (i32.const 0))
                        (then (local.set $title_start (i32.add (i32.add (local.get $url_end) (local.get $idx)) (i32.const 14))))
                      )
                    )
                  )
                  (if (i32.ge_s (local.get $idx) (i32.const 0))
                    (then
                      (local.set $i (i32.const 0))
                      (loop $find_title_end
                        (if (i32.and (i32.lt_u (local.get $i) (i32.const 80)) (i32.lt_u (i32.add (local.get $title_start) (local.get $i)) (local.get $scan_end)))
                          (then
                            (if (i32.ne (i32.load8_u (i32.add (local.get $title_start) (local.get $i))) (i32.const 34))
                              (then
                                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                (br $find_title_end)
                              )
                            )
                          )
                        )
                      )
                      (if (i32.gt_u (local.get $i) (i32.const 0))
                        (then (local.set $title_len (local.get $i)))
                      )
                    )
                  )

                  (local.set $p (call $copy_zstr (i32.const 145010) (local.get $p)))
                  (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))
                  (local.set $p (call $copy_zstr (i32.const 145020) (local.get $p)))
                  (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
                  (local.set $p (call $copy_zstr (i32.const 145030) (local.get $p)))

                  (local.set $item_count (i32.add (local.get $item_count) (i32.const 1)))
                  (local.set $scan_ptr (local.get $url_end))
                  (br $parse_items)
                )
              )
            )
          )
        )

        (if (i32.eqz (local.get $item_count))
          (then (return (call $return_static (i32.const 143400))))
        )

        (return (i32.sub (local.get $p) (i32.const 65536)))
      )
    )

    ;; ─── Phase 4: Create Step 1 — Parent Search Response ───
    (if (i32.eq (global.get $phase) (i32.const 4))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 149540) (i32.const 11)))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 11)))
                (local.set $i (i32.const 0))
                (loop $find_msg_end
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 160)) (i32.lt_u (i32.add (local.get $msg_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len))))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $msg_start) (local.get $i))) (i32.const 34))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $find_msg_end)
                        )
                      )
                    )
                  )
                )
                (local.set $msg_len (local.get $i))
                (local.set $p (call $copy_zstr (i32.const 144750) (i32.const 65536)))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $msg_len)))
                (local.set $p (call $copy_zstr (i32.const 144800) (local.get $p)))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (return (call $return_static (i32.const 144200)))
          )
        )

        (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 149460) (i32.const 6)))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then (return (call $return_static (i32.const 144200))))
        )

        (local.set $url_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 6)))
        (local.set $i (i32.const 0))
        (loop $copy_parent_id
          (if (i32.lt_u (local.get $i) (i32.const 36))
            (then
              (local.set $ch (i32.load8_u (i32.add (local.get $url_start) (local.get $i))))
              (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 0)))
                (then
                  (i32.store8 (i32.add (i32.const 1307000) (local.get $i)) (local.get $ch))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $copy_parent_id)
                )
              )
            )
          )
        )
        (global.set $parent_len (local.get $i))

        ;; Persist parent ID
        (local.set $p (call $copy_zstr (i32.const 145520) (i32.const 200000)))
        (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $parent_len)))
        (local.set $p (call $copy_zstr (i32.const 145300) (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

        (return (call $send_create_page))
      )
    )

    ;; ─── Phase 5: Create Step 2 — Page Created Response ───
    (if (i32.eq (global.get $phase) (i32.const 5))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            ;; Clear stored parent_id so next call re-discovers a valid parent
            (local.set $req_len (call $zlen (i32.const 145620)))
            (drop (call $host_call (i32.const 145620) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 149540) (i32.const 11)))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 11)))
                (local.set $i (i32.const 0))
                (loop $find_c_msg_end
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 180)) (i32.lt_u (i32.add (local.get $msg_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len))))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $msg_start) (local.get $i))) (i32.const 34))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $find_c_msg_end)
                        )
                      )
                    )
                  )
                )
                (local.set $msg_len (local.get $i))
                (local.set $p (call $copy_zstr (i32.const 144750) (i32.const 65536)))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $msg_len)))
                (local.set $p (call $copy_zstr (i32.const 144800) (local.get $p)))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (local.set $p (call $copy_zstr (i32.const 144750) (i32.const 65536)))
            (local.set $p (call $copy_zstr (i32.const 144800) (local.get $p)))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
        )

        (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 149480) (i32.const 15)))
        (local.set $url_start (i32.const 900000))
        (local.set $url_len (i32.const 0))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $url_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 7)))
            (local.set $i (i32.const 0))
            (loop $find_c_url_end
              (if (i32.lt_u (i32.add (local.get $url_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len)))
                (then
                  (if (i32.ne (i32.load8_u (i32.add (local.get $url_start) (local.get $i))) (i32.const 34))
                    (then
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $find_c_url_end)
                    )
                  )
                )
              )
            )
            (local.set $url_len (local.get $i))
          )
        )

        ;; Minimalist Chattree Markdown response: link + preview
        (local.set $p (call $copy_zstr (i32.const 144550) (i32.const 65536)))
        (local.set $p (call $copy_mem (i32.const 1303000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_zstr (i32.const 144600) (local.get $p)))
        (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
        (local.set $p (call $copy_zstr (i32.const 144620) (local.get $p)))

        (if (i32.gt_u (global.get $preview_len) (i32.const 0))
          (then
            (local.set $prev_copy_len (global.get $preview_len))
            (if (i32.gt_u (local.get $prev_copy_len) (i32.const 12000))
              (then (local.set $prev_copy_len (i32.const 12000)))
            )
            (local.set $p (call $copy_mem (i32.const 1600000) (local.get $p) (local.get $prev_copy_len)))
          )
        )

        (local.set $p (call $copy_zstr (i32.const 144650) (local.get $p)))
        (return (i32.sub (local.get $p) (i32.const 65536)))
      )
    )

    (call $return_static (i32.const 140000))
  )
)
