;; Chattree Official GitHub Integration Plugin v1.1.0
;; - Minimalist Chattree monochrome UI (English predetermined strings; AI writes in user's language)
;; - Whitespace-tolerant JSON parsing, \uXXXX -> UTF-8 decoding, proper double-JSON escaping
;; - Bounded repo/issue parsing (filters /issues/ URLs, prevents cross-item description/title leaks)
;; - Percent-encoded search queries and owner/repo URL normalization
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
  (global $repo_len     (mut i32) (i32.const 0))  ;; normalized owner/repo length at 1307000
  (global $url_q_len    (mut i32) (i32.const 0))  ;; URL-encoded query at 1308000
  (global $raw_body_len (mut i32) (i32.const 0))  ;; raw JSON-extracted content at 1400000
  (global $preview_len  (mut i32) (i32.const 0))  ;; decoded UTF-8 preview at 1600000

  ;; ── Static NUL-Terminated Data Segments (140000+) ────────────────────────
  (data (i32.const 140000) "**GitHub Workspace**\0a\0aManage repositories, draft technical issues, and search GitHub in natural language.\0a\0a---\0a\0a**Examples**\0a- `/github create an issue in Ponce5/Chattree to optimize background memory usage`\0a- `/github list my recent repositories`\0a- `/github show open issues in Ponce5/Chattree`\0a- `/github search repositories for flutter wasm`\0a- `/github set default repo Ponce5/Chattree`\0a- `/github set my token ghp_your_token`\0a- `/github check connection status`\0a\0a**Setup**\0a1. Open **GitHub Settings** -> **Developer settings** -> **Personal access tokens** (https://github.com/settings/tokens).\0a2. Generate a token (`ghp_...` or `github_pat_...`) with `repo` (or `public_repo` and `issues:write`) scope.\0a3. Run `/github set my token <your_token>`.\00")

  (data (i32.const 141200) "**GitHub Connected**\0a\0a**Account:** `@\00")
  (data (i32.const 141260) "`\0a\0aTry:\0a- `/github list my recent repositories`\0a- `/github create an issue in owner/repo about...`\0a- `/github search repositories for...`\00")
  (data (i32.const 141450) "**Token Saved — Verification Failed**\0a\0aGitHub returned an authentication error (401). Verify that your Personal Access Token (`ghp_...` or `github_pat_...`) is valid and active at https://github.com/settings/tokens.\00")
  (data (i32.const 141750) "**GitHub Not Configured**\0a\0aTo create issues or access private repositories, save your Personal Access Token:\0a`/github set my token ghp_your_token`\0a\0aGenerate a token at https://github.com/settings/tokens (public search and public issues also work without a token).\00")
  (data (i32.const 142100) "**GitHub Disconnected**\0a\0aYour Personal Access Token has been removed from this device.\00")

  (data (i32.const 142220) "**GitHub Connection Active**\0a\0a- **User:** `@\00")
  (data (i32.const 142280) "`\0a- **Default Repo:** `\00")
  (data (i32.const 142320) "`\0a- **API:** GitHub REST API `2022-11-28`\00")
  (data (i32.const 142380) "Not set (use /github set default repo owner/repo)\00")
  (data (i32.const 142460) "**GitHub Authentication Failed**\0a\0aYour saved token is invalid or expired. Update it with:\0a`/github set my token <your_token>`\00")

  (data (i32.const 142620) "**Default Repository Saved:** `\00")
  (data (i32.const 142670) "`\0a\0aYou can now create or list issues without repeating the repository name.\00")
  (data (i32.const 142780) "**Repository Required (`owner/repo`)**\0a\0aSpecify a repository in your request (for example: `in Ponce5/Chattree`) or save a default repository:\0a`/github set default repo owner/repo`\00")

  (data (i32.const 143020) "**Your Recent Repositories**\0a\0a\00")
  (data (i32.const 143070) "**GitHub Search Results**\0a\0a\00")
  (data (i32.const 143120) "**Open Issues in `\00")
  (data (i32.const 143160) "`**\0a\0a\00")
  (data (i32.const 143180) "**No Results Found**\0a\0aNo matching GitHub items were returned for this query.\00")
  (data (i32.const 143280) "**GitHub API Error:** \00")
  (data (i32.const 143320) "\0a\0aVerify that the repository exists and your token has sufficient permissions (`repo` / `issues:write`).\00")

  (data (i32.const 143460) "**Issue Created in GitHub**\0a\0a[**\00")
  (data (i32.const 143510) "**](\00")
  (data (i32.const 143530) ")\0a\0a---\0a\0a\00")
  (data (i32.const 143560) "\0a\0a---\0a*Published to your GitHub repository.*\00")
  (data (i32.const 143640) "New Issue\00")
  (data (i32.const 143660) "View on GitHub\00")
  (data (i32.const 143690) "- [**\00")
  (data (i32.const 143710) "**](https://github.com/\00")
  (data (i32.const 143750) ") \e2\80\94 \00")
  (data (i32.const 143770) ")\0a\00")
  (data (i32.const 143780) "\0a\00")

  ;; Storage & HTTP templates
  (data (i32.const 144000) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22api_token\22}}\00")
  (data (i32.const 144100) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22api_token\22,\22value\22:\22\00")
  (data (i32.const 144200) "\22}}\00")
  (data (i32.const 144220) "{\22api\22:\22storage\22,\22operation\22:\22delete\22,\22payload\22:{\22key\22:\22api_token\22}}\00")
  (data (i32.const 144320) "{\22api\22:\22storage\22,\22operation\22:\22get\22,\22payload\22:{\22key\22:\22default_repo\22}}\00")
  (data (i32.const 144420) "{\22api\22:\22storage\22,\22operation\22:\22set\22,\22payload\22:{\22key\22:\22default_repo\22,\22value\22:\22\00")

  (data (i32.const 144520) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/user\22,\22method\22:\22GET\22,\22headers\22:{\22Authorization\22:\22Bearer \00")
  (data (i32.const 144700) "\22,\22Accept\22:\22application/vnd.github+json\22,\22X-GitHub-Api-Version\22:\222022-11-28\22},\22timeoutMs\22:20000}}\00")

  (data (i32.const 144840) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/user/repos?sort=updated&per_page=6\22,\22method\22:\22GET\22,\22headers\22:{\22Authorization\22:\22Bearer \00")

  (data (i32.const 145050) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/search/repositories?per_page=5&sort=stars&q=\00")
  (data (i32.const 145220) "\22,\22method\22:\22GET\22,\22headers\22:{\22Authorization\22:\22Bearer \00")
  (data (i32.const 145300) "\22,\22method\22:\22GET\22,\22headers\22:{\22Accept\22:\22application/vnd.github+json\22,\22X-GitHub-Api-Version\22:\222022-11-28\22},\22timeoutMs\22:20000}}\00")

  (data (i32.const 145460) "{\22api\22:\22network\22,\22operation\22:\22http_request\22,\22payload\22:{\22url\22:\22https://api.github.com/repos/\00")
  (data (i32.const 145580) "/issues?state=open&per_page=6\22,\22method\22:\22GET\22,\22headers\22:{\22Authorization\22:\22Bearer \00")
  (data (i32.const 145700) "/issues?state=open&per_page=6\22,\22method\22:\22GET\22,\22headers\22:{\22Accept\22:\22application/vnd.github+json\22,\22X-GitHub-Api-Version\22:\222022-11-28\22},\22timeoutMs\22:20000}}\00")

  (data (i32.const 145900) "/issues\22,\22method\22:\22POST\22,\22headers\22:{\22Authorization\22:\22Bearer \00")
  (data (i32.const 146000) "\22,\22Accept\22:\22application/vnd.github+json\22,\22X-GitHub-Api-Version\22:\222022-11-28\22,\22Content-Type\22:\22application/json\22},\22body\22:\22{\5c\22title\5c\22:\5c\22\00")
  (data (i32.const 146180) "\5c\22,\5c\22body\5c\22:\5c\22\00")
  (data (i32.const 146220) "\5c\22}\22,\22timeoutMs\22:25000}}\00")

  ;; JSON keys & needles (NUL-terminated)
  (data (i32.const 149000) "\22value\22:\22\00")
  (data (i32.const 149020) "\22operation\22\00")
  (data (i32.const 149040) "\22action\22\00")
  (data (i32.const 149060) "\22repo\22\00")
  (data (i32.const 149080) "\22title\22\00")
  (data (i32.const 149100) "\22content\22\00")
  (data (i32.const 149120) "\22extra\22\00")
  (data (i32.const 149140) "\22query\22\00")
  (data (i32.const 149160) "\22token\22\00")

  (data (i32.const 149200) "create\00")
  (data (i32.const 149220) "issues\00")
  (data (i32.const 149240) "repos\00")
  (data (i32.const 149260) "list\00")
  (data (i32.const 149280) "search\00")
  (data (i32.const 149300) "set_repo\00")
  (data (i32.const 149320) "status\00")
  (data (i32.const 149340) "config\00")
  (data (i32.const 149360) "disconnect\00")
  (data (i32.const 149380) "help\00")
  (data (i32.const 149400) "ghp_\00")
  (data (i32.const 149415) "gho_\00")
  (data (i32.const 149430) "github_pat_\00")

  (data (i32.const 149460) "\22statusCode\22:200\00")
  (data (i32.const 149490) "\22statusCode\22:201\00")
  (data (i32.const 149520) "\22login\22:\22\00")
  (data (i32.const 149540) "\22full_name\22:\22\00")
  (data (i32.const 149560) "\22html_url\22:\22https://github.com/\00")
  (data (i32.const 149600) "/issues/\00")
  (data (i32.const 149620) "\22title\22:\22\00")
  (data (i32.const 149640) "\22description\22:\22\00")
  (data (i32.const 149670) "\22message\22:\22\00")
  (data (i32.const 149690) "github.com/\00")
  (data (i32.const 149710) "0123456789ABCDEF\00")

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
    (call $copy_mem (local.get $src) (local.get $dst) (call $zlen (local.get $src)))
  )

  (func $return_static (param $src i32) (result i32)
    (local $end i32)
    (local.set $end (call $copy_zstr (local.get $src) (i32.const 65536)))
    (i32.sub (local.get $end) (i32.const 65536))
  )

  (func $to_lower (param $src i32) (param $dst i32) (param $len i32)
    (local $i i32) (local $ch i32)
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
    (local $i i32) (local $j i32) (local $match i32)
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

  ;; Whitespace-tolerant JSON key lookup: finds `"key"` \s* : \s* ", returns offset of value start or -1
  (func $find_json_key_val (param $src i32) (param $src_len i32) (param $key_ptr i32) (result i32)
    (local $key_len i32) (local $pos i32) (local $rel i32) (local $k i32)
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
                   (i32.eq (i32.load8_u (i32.add (local.get $src) (local.get $k))) (i32.const 58)))
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
                       (i32.eq (i32.load8_u (i32.add (local.get $src) (local.get $k))) (i32.const 34)))
            (then (return (i32.add (local.get $k) (i32.const 1))))
          )
        )
      )
      (local.set $pos (i32.add (i32.add (local.get $pos) (local.get $rel)) (i32.const 1)))
      (br $search)
    )
    (i32.const -1)
  )

  (func $extract_json_raw_ws (param $src i32) (param $src_len i32) (param $key_ptr i32) (param $dst_ptr i32) (param $max_len i32) (result i32)
    (local $v_off i32) (local $val_start i32) (local $i i32) (local $out i32) (local $ch i32) (local $esc i32)
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
    (local $i i32) (local $out i32) (local $ch i32) (local $next i32)
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
    (local $res_len i32) (local $val_idx i32) (local $val_start i32) (local $i i32) (local $ch i32) (local $req_len i32)
    (local.set $req_len (call $zlen (i32.const 144000)))
    (local.set $res_len (call $host_call (i32.const 144000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $val_idx (call $find_substring (i32.const 1300000) (local.get $res_len) (i32.const 149000) (i32.const 9)))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0)) (then (return (i32.const 0))))
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

  ;; Loads stored Default Repo (owner/repo) into 1307000
  (func $load_default_repo (result i32)
    (local $res_len i32) (local $val_idx i32) (local $val_start i32) (local $i i32) (local $ch i32) (local $req_len i32)
    (local.set $req_len (call $zlen (i32.const 144320)))
    (local.set $res_len (call $host_call (i32.const 144320) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))
    (if (i32.le_s (local.get $res_len) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $val_idx (call $find_substring (i32.const 1300000) (local.get $res_len) (i32.const 149000) (i32.const 9)))
    (if (i32.lt_s (local.get $val_idx) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $val_start (i32.add (i32.const 1300000) (i32.add (local.get $val_idx) (i32.const 9))))
    (local.set $i (i32.const 0))
    (loop $copy_rep
      (if (i32.lt_u (local.get $i) (i32.const 120))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $val_start) (local.get $i))))
          (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 0)))
            (then
              (i32.store8 (i32.add (i32.const 1307000) (local.get $i)) (local.get $ch))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $copy_rep)
            )
          )
        )
      )
    )
    (global.set $repo_len (local.get $i))
    (local.get $i)
  )

  ;; Normalizes `owner/repo` or `https://github.com/owner/repo/...` into 1307000, returns length (0 if invalid)
  (func $normalize_repo (param $src i32) (param $len i32) (result i32)
    (local $pos i32) (local $start i32) (local $i i32) (local $out i32) (local $ch i32) (local $slashes i32)
    (local.set $start (i32.const 0))
    (local.set $pos (call $find_substring (local.get $src) (local.get $len) (i32.const 149690) (i32.const 11))) ;; "github.com/"
    (if (i32.ge_s (local.get $pos) (i32.const 0))
      (then (local.set $start (i32.add (local.get $pos) (i32.const 11))))
    )
    (local.set $i (local.get $start))
    (local.set $out (i32.const 0))
    (local.set $slashes (i32.const 0))
    (block $done
      (loop $r_loop
        (if (i32.or (i32.ge_u (local.get $i) (local.get $len)) (i32.ge_u (local.get $out) (i32.const 110)))
          (then (br $done))
        )
        (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
        ;; Stop at whitespace, ?, #, quotes
        (if (i32.or
              (i32.or (i32.le_u (local.get $ch) (i32.const 32)) (i32.eq (local.get $ch) (i32.const 63)))
              (i32.or (i32.eq (local.get $ch) (i32.const 35)) (i32.eq (local.get $ch) (i32.const 34))))
          (then (br $done))
        )
        (if (i32.eq (local.get $ch) (i32.const 47)) ;; '/'
          (then
            (if (i32.eq (local.get $slashes) (i32.const 1))
              (then (br $done)) ;; stop before 2nd slash (e.g. /issues, /tree/main)
            )
            (local.set $slashes (i32.const 1))
          )
        )
        (i32.store8 (i32.add (i32.const 1307000) (local.get $out)) (local.get $ch))
        (local.set $out (i32.add (local.get $out) (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $r_loop)
      )
    )
    ;; Strip trailing ".git" if present
    (if (i32.ge_u (local.get $out) (i32.const 5))
      (then
        (if (i32.and
              (i32.and (i32.eq (i32.load8_u (i32.add (i32.const 1307000) (i32.sub (local.get $out) (i32.const 4)))) (i32.const 46))
                       (i32.eq (i32.load8_u (i32.add (i32.const 1307000) (i32.sub (local.get $out) (i32.const 3)))) (i32.const 103)))
              (i32.and (i32.eq (i32.load8_u (i32.add (i32.const 1307000) (i32.sub (local.get $out) (i32.const 2)))) (i32.const 105))
                       (i32.eq (i32.load8_u (i32.add (i32.const 1307000) (i32.sub (local.get $out) (i32.const 1)))) (i32.const 116))))
          (then (local.set $out (i32.sub (local.get $out) (i32.const 4))))
        )
      )
    )
    (if (i32.eqz (local.get $slashes)) (then (local.set $out (i32.const 0))))
    (global.set $repo_len (local.get $out))
    (local.get $out)
  )

  ;; Decodes raw JSON single-line title/query (with \uXXXX) into 1303000
  (func $sanitize_single_line (param $src i32) (param $len i32) (result i32)
    (local $i i32) (local $out i32) (local $ch i32) (local $next i32) (local $cp i32) (local $next_out i32)
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 0))
    (loop $s_loop
      (if (i32.and (i32.lt_u (local.get $i) (local.get $len)) (i32.lt_u (local.get $out) (i32.const 490)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 92))
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

  ;; Full RFC-3986 percent-encoding of query at 1303000 ($arg_len) into 1308000 (spaces -> '+')
  (func $encode_url_query (result i32)
    (local $i i32) (local $out i32) (local $ch i32)
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 0))
    (loop $q_loop
      (if (i32.and (i32.lt_u (local.get $i) (global.get $arg_len)) (i32.lt_u (local.get $out) (i32.const 900)))
        (then
          (local.set $ch (i32.load8_u (i32.add (i32.const 1303000) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 32))
            (then
              (i32.store8 (i32.add (i32.const 1308000) (local.get $out)) (i32.const 43)) ;; '+'
              (local.set $out (i32.add (local.get $out) (i32.const 1)))
            )
            (else
              (if (i32.or
                    (i32.or
                      (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 90)))
                      (i32.and (i32.ge_u (local.get $ch) (i32.const 97)) (i32.le_u (local.get $ch) (i32.const 122))))
                    (i32.or
                      (i32.and (i32.ge_u (local.get $ch) (i32.const 48)) (i32.le_u (local.get $ch) (i32.const 57)))
                      (i32.or (i32.eq (local.get $ch) (i32.const 45))
                              (i32.or (i32.eq (local.get $ch) (i32.const 95))
                                      (i32.or (i32.eq (local.get $ch) (i32.const 46)) (i32.eq (local.get $ch) (i32.const 126)))))))
                (then
                  (i32.store8 (i32.add (i32.const 1308000) (local.get $out)) (local.get $ch))
                  (local.set $out (i32.add (local.get $out) (i32.const 1)))
                )
                (else
                  (i32.store8 (i32.add (i32.const 1308000) (local.get $out)) (i32.const 37)) ;; '%'
                  (i32.store8 (i32.add (i32.const 1308000) (i32.add (local.get $out) (i32.const 1)))
                              (i32.load8_u (i32.add (i32.const 149710) (i32.shr_u (local.get $ch) (i32.const 4)))))
                  (i32.store8 (i32.add (i32.const 1308000) (i32.add (local.get $out) (i32.const 2)))
                              (i32.load8_u (i32.add (i32.const 149710) (i32.and (local.get $ch) (i32.const 15)))))
                  (local.set $out (i32.add (local.get $out) (i32.const 3)))
                )
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $q_loop)
        )
      )
    )
    (global.set $url_q_len (local.get $out))
    (local.get $out)
  )

  ;; Decodes raw JSON content at 1400000 into readable UTF-8 at 1600000 (handles \uXXXX, \n, \t, \", \\, \/)
  (func $decode_body_to_preview (param $src i32) (param $len i32) (result i32)
    (local $i i32) (local $out i32) (local $ch i32) (local $next i32) (local $cp i32) (local $next_out i32)
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 0))
    (loop $d_loop
      (if (i32.and (i32.lt_u (local.get $i) (local.get $len)) (i32.lt_u (local.get $out) (i32.const 32000)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 92))
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
                  (if (i32.eq (local.get $next) (i32.const 110))
                    (then
                      (i32.store8 (i32.add (i32.const 1600000) (local.get $out)) (i32.const 10))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $d_loop)
                    )
                  )
                  (if (i32.eq (local.get $next) (i32.const 114))
                    (then
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $d_loop)
                    )
                  )
                  (if (i32.eq (local.get $next) (i32.const 116))
                    (then
                      (i32.store8 (i32.add (i32.const 1600000) (local.get $out)) (i32.const 32))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $d_loop)
                    )
                  )
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

  ;; Appends UTF-8 slice from $base [0..$len) into outer http_request `body` string at $dst,
  ;; properly double-escaping " -> \\\" and \ -> \\\\ and \n -> \\n
  (func $append_json_escaped (param $dst i32) (param $base i32) (param $len i32) (result i32)
    (local $i i32) (local $ch i32) (local $p i32)
    (local.set $i (i32.const 0))
    (local.set $p (local.get $dst))
    (loop $c_loop
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $base) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 10))
            (then
              (i32.store8 (local.get $p) (i32.const 92))
              (i32.store8 (i32.add (local.get $p) (i32.const 1)) (i32.const 92))
              (i32.store8 (i32.add (local.get $p) (i32.const 2)) (i32.const 110))
              (local.set $p (i32.add (local.get $p) (i32.const 3)))
            )
            (else
              (if (i32.eq (local.get $ch) (i32.const 34))
                (then
                  (i32.store8 (local.get $p) (i32.const 92))
                  (i32.store8 (i32.add (local.get $p) (i32.const 1)) (i32.const 92))
                  (i32.store8 (i32.add (local.get $p) (i32.const 2)) (i32.const 92))
                  (i32.store8 (i32.add (local.get $p) (i32.const 3)) (i32.const 34))
                  (local.set $p (i32.add (local.get $p) (i32.const 4)))
                )
                (else
                  (if (i32.eq (local.get $ch) (i32.const 92))
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

  ;; ── Main Entrypoint ──────────────────────────────────────────────────────
  (func (export "github_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $pos i32)
    (local $token_start i32)
    (local $raw_len i32)
    (local $p i32)
    (local $req_len i32)
    (local $i i32)
    (local $ch i32)
    (local $title_len i32)
    (local $query_len i32)
    (local $content_len i32)
    (local $repo_json_len i32)
    (local $tok_json_len i32)

    ;; Reset globals
    (global.set $arg_len (i32.const 0))
    (global.set $op_len (i32.const 0))
    (global.set $repo_len (i32.const 0))
    (global.set $url_q_len (i32.const 0))
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
    (local.set $query_len (call $extract_json_raw_ws (local.get $in_ptr) (local.get $in_len) (i32.const 149140) (i32.const 1312000) (i32.const 1000)))
    (local.set $repo_json_len (call $extract_json_raw_ws (local.get $in_ptr) (local.get $in_len) (i32.const 149060) (i32.const 1314000) (i32.const 200)))

    (if (i32.gt_s (local.get $repo_json_len) (i32.const 2))
      (then (drop (call $normalize_repo (i32.const 1314000) (local.get $repo_json_len))))
      (else (drop (call $load_default_repo)))
    )

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
        (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 149400) (i32.const 4)))
        (if (i32.lt_s (local.get $pos) (i32.const 0))
          (then (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 149430) (i32.const 11))))
        )
        (if (i32.lt_s (local.get $pos) (i32.const 0))
          (then (local.set $pos (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 149415) (i32.const 4))))
        )
        (if (i32.ge_s (local.get $pos) (i32.const 0))
          (then
            (local.set $token_start (i32.add (local.get $in_ptr) (local.get $pos)))
            (local.set $i (i32.const 0))
            (loop $scan_direct_tok
              (if (i32.lt_u (i32.add (local.get $token_start) (local.get $i)) (i32.add (local.get $in_ptr) (local.get $in_len)))
                (then
                  (if (i32.lt_u (local.get $i) (i32.const 140))
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
                (local.set $p (call $copy_zstr (i32.const 144100) (i32.const 200000)))
                (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
                (local.set $p (call $copy_zstr (i32.const 144200) (local.get $p)))
                (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
                (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

                (local.set $p (call $copy_zstr (i32.const 144520) (i32.const 200000)))
                (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
                (local.set $p (call $copy_zstr (i32.const 144700) (local.get $p)))
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
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149380) (i32.const 4)) (i32.const 0))
      (then (return (call $return_static (i32.const 140000))))
    )

    ;; B. "disconnect"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149360) (i32.const 10)) (i32.const 0))
      (then
        (local.set $req_len (call $zlen (i32.const 144220)))
        (drop (call $host_call (i32.const 144220) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))
        (return (call $return_static (i32.const 142100)))
      )
    )

    ;; C. "config"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149340) (i32.const 6)) (i32.const 0))
      (then
        (local.set $tok_json_len (call $extract_json_raw_ws (local.get $in_ptr) (local.get $in_len) (i32.const 149160) (i32.const 1302000) (i32.const 150)))
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
            (local.set $p (call $copy_zstr (i32.const 144100) (i32.const 200000)))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_zstr (i32.const 144200) (local.get $p)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

            (local.set $p (call $copy_zstr (i32.const 144520) (i32.const 200000)))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_zstr (i32.const 144700) (local.get $p)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (global.set $phase (i32.const 1))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
            (return (i32.const 0))
          )
        )
        (return (call $return_static (i32.const 141750)))
      )
    )

    ;; D. "set_repo"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149300) (i32.const 8)) (i32.const 0))
      (then
        (if (i32.le_s (local.get $repo_json_len) (i32.const 2))
          (then
            (if (i32.gt_s (local.get $query_len) (i32.const 2))
              (then (drop (call $normalize_repo (i32.const 1312000) (local.get $query_len))))
            )
          )
        )
        (if (i32.gt_u (global.get $repo_len) (i32.const 2))
          (then
            (local.set $p (call $copy_zstr (i32.const 144420) (i32.const 200000)))
            (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
            (local.set $p (call $copy_zstr (i32.const 144200) (local.get $p)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))

            (local.set $p (call $copy_zstr (i32.const 142620) (i32.const 65536)))
            (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
            (local.set $p (call $copy_zstr (i32.const 142670) (local.get $p)))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
        )
        (return (call $return_static (i32.const 142780)))
      )
    )

    ;; E. "status"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149320) (i32.const 6)) (i32.const 0))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then (return (call $return_static (i32.const 141750))))
        )
        (local.set $p (call $copy_zstr (i32.const 144520) (i32.const 200000)))
        (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_zstr (i32.const 144700) (local.get $p)))
        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (global.set $phase (i32.const 2))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; F. "create" (Create Issue)
    (if (i32.or
          (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149200) (i32.const 6)) (i32.const 0))
          (i32.gt_s (local.get $content_len) (i32.const 0)))
      (then
        (local.set $raw_len (call $load_api_token))
        (if (i32.eqz (local.get $raw_len))
          (then (return (call $return_static (i32.const 141750))))
        )
        (if (i32.le_u (global.get $repo_len) (i32.const 2))
          (then (return (call $return_static (i32.const 142780))))
        )

        (if (i32.gt_s (local.get $repo_json_len) (i32.const 2))
          (then
            (local.set $p (call $copy_zstr (i32.const 144420) (i32.const 200000)))
            (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
            (local.set $p (call $copy_zstr (i32.const 144200) (local.get $p)))
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 1300000) (i32.const 1024)))
          )
        )

        (if (i32.gt_s (local.get $title_len) (i32.const 0))
          (then (drop (call $sanitize_single_line (i32.const 1310000) (local.get $title_len))))
          (else
            (if (i32.gt_s (local.get $query_len) (i32.const 0))
              (then (drop (call $sanitize_single_line (i32.const 1312000) (local.get $query_len))))
              (else
                (local.set $p (call $copy_zstr (i32.const 143640) (i32.const 1303000)))
                (global.set $arg_len (i32.sub (local.get $p) (i32.const 1303000)))
              )
            )
          )
        )

        (local.set $p (call $copy_zstr (i32.const 145460) (i32.const 200000)))
        (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_zstr (i32.const 145900) (local.get $p)))
        (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
        (local.set $p (call $copy_zstr (i32.const 146000) (local.get $p)))
        (local.set $p (call $append_json_escaped (local.get $p) (i32.const 1303000) (global.get $arg_len)))
        (local.set $p (call $copy_zstr (i32.const 146180) (local.get $p)))
        (local.set $p (call $append_json_escaped (local.get $p) (i32.const 1600000) (global.get $preview_len)))
        (local.set $p (call $copy_zstr (i32.const 146220) (local.get $p)))

        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (global.set $phase (i32.const 5))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; G. "issues"
    (if (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149220) (i32.const 6)) (i32.const 0))
      (then
        (if (i32.le_u (global.get $repo_len) (i32.const 2))
          (then
            (if (i32.gt_s (local.get $query_len) (i32.const 2))
              (then (drop (call $normalize_repo (i32.const 1312000) (local.get $query_len))))
            )
          )
        )
        (if (i32.le_u (global.get $repo_len) (i32.const 2))
          (then (return (call $return_static (i32.const 142780))))
        )

        (local.set $raw_len (call $load_api_token))
        (local.set $p (call $copy_zstr (i32.const 145460) (i32.const 200000)))
        (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
        (if (i32.gt_u (local.get $raw_len) (i32.const 0))
          (then
            (local.set $p (call $copy_zstr (i32.const 145580) (local.get $p)))
            (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
            (local.set $p (call $copy_zstr (i32.const 144700) (local.get $p)))
          )
          (else
            (local.set $p (call $copy_zstr (i32.const 145700) (local.get $p)))
          )
        )
        (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
        (global.set $phase (i32.const 4))
        (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
        (return (i32.const 0))
      )
    )

    ;; H. "search"
    (if (i32.or
          (i32.ge_s (call $find_substring (i32.const 1306000) (global.get $op_len) (i32.const 149280) (i32.const 6)) (i32.const 0))
          (i32.gt_s (local.get $query_len) (i32.const 0)))
      (then
        (if (i32.gt_s (local.get $query_len) (i32.const 0))
          (then
            (drop (call $sanitize_single_line (i32.const 1312000) (local.get $query_len)))
            (drop (call $encode_url_query))
          )
        )
        (if (i32.gt_u (global.get $url_q_len) (i32.const 0))
          (then
            (local.set $raw_len (call $load_api_token))
            (local.set $p (call $copy_zstr (i32.const 145050) (i32.const 200000)))
            (local.set $p (call $copy_mem (i32.const 1308000) (local.get $p) (global.get $url_q_len)))
            (if (i32.gt_u (local.get $raw_len) (i32.const 0))
              (then
                (local.set $p (call $copy_zstr (i32.const 145220) (local.get $p)))
                (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
                (local.set $p (call $copy_zstr (i32.const 144700) (local.get $p)))
              )
              (else
                (local.set $p (call $copy_zstr (i32.const 145300) (local.get $p)))
              )
            )
            (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
            (global.set $phase (i32.const 6))
            (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
            (return (i32.const 0))
          )
        )
      )
    )

    ;; I. Default / "repos" / "list"
    (local.set $raw_len (call $load_api_token))
    (if (i32.eqz (local.get $raw_len))
      (then (return (call $return_static (i32.const 141750))))
    )
    (local.set $p (call $copy_zstr (i32.const 144840) (i32.const 200000)))
    (local.set $p (call $copy_mem (i32.const 1302000) (local.get $p) (global.get $token_len)))
    (local.set $p (call $copy_zstr (i32.const 144700) (local.get $p)))
    (local.set $req_len (i32.sub (local.get $p) (i32.const 200000)))
    (global.set $phase (i32.const 3))
    (drop (call $host_call (i32.const 200000) (local.get $req_len) (i32.const 500000) (i32.const 400000)))
    (i32.const 0)
  )

  ;; ── Resume Handler (Async HTTP Response) ─────────────────────────────────
  (func (export "resume") (param $res_ptr i32) (param $res_len i32) (result i32)
    (local $is_200 i32)
    (local $is_201 i32)
    (local $idx i32)
    (local $p i32)
    (local $scan_ptr i32)
    (local $scan_end i32)
    (local $item_count i32)
    (local $url_start i32)
    (local $url_len i32)
    (local $url_end i32)
    (local $next_idx i32)
    (local $next_bound i32)
    (local $title_start i32)
    (local $title_len i32)
    (local $desc_start i32)
    (local $desc_len i32)
    (local $i i32)
    (local $ch i32)
    (local $u_len i32)
    (local $msg_start i32)
    (local $prev_copy_len i32)

    (local.set $u_len (call $unescape_response (local.get $res_ptr) (local.get $res_len) (i32.const 900000)))
    (local.set $is_200 (i32.ge_s (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 149460) (i32.const 16)) (i32.const 0)))
    (local.set $is_201 (i32.ge_s (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 149490) (i32.const 16)) (i32.const 0)))

    ;; ─── Phase 1: Config Verification ───
    (if (i32.eq (global.get $phase) (i32.const 1))
      (then
        (if (local.get $is_200)
          (then
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 149520) (i32.const 9)))
            (local.set $title_start (i32.const 900000))
            (local.set $title_len (i32.const 0))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $title_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 9)))
                (local.set $i (i32.const 0))
                (loop $scan_login1
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 60)) (i32.lt_u (i32.add (local.get $title_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len))))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $title_start) (local.get $i))) (i32.const 34))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $scan_login1)
                        )
                      )
                    )
                  )
                )
                (local.set $title_len (local.get $i))
              )
            )
            (local.set $p (call $copy_zstr (i32.const 141200) (i32.const 65536)))
            (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))
            (local.set $p (call $copy_zstr (i32.const 141260) (local.get $p)))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
          (else (return (call $return_static (i32.const 141450))))
        )
      )
    )

    ;; ─── Phase 2: Status Check ───
    (if (i32.eq (global.get $phase) (i32.const 2))
      (then
        (if (local.get $is_200)
          (then
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 149520) (i32.const 9)))
            (local.set $title_start (i32.const 900000))
            (local.set $title_len (i32.const 0))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $title_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 9)))
                (local.set $i (i32.const 0))
                (loop $scan_login2
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 60)) (i32.lt_u (i32.add (local.get $title_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len))))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $title_start) (local.get $i))) (i32.const 34))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $scan_login2)
                        )
                      )
                    )
                  )
                )
                (local.set $title_len (local.get $i))
              )
            )
            (drop (call $load_default_repo))
            (local.set $p (call $copy_zstr (i32.const 142220) (i32.const 65536)))
            (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))
            (local.set $p (call $copy_zstr (i32.const 142280) (local.get $p)))
            (if (i32.gt_u (global.get $repo_len) (i32.const 0))
              (then (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len))))
              (else (local.set $p (call $copy_zstr (i32.const 142380) (local.get $p))))
            )
            (local.set $p (call $copy_zstr (i32.const 142320) (local.get $p)))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
          (else (return (call $return_static (i32.const 142460))))
        )
      )
    )

    ;; ─── Phase 3 & Phase 6: List User Repos (3) or Search Repos (6) ───
    (if (i32.or (i32.eq (global.get $phase) (i32.const 3)) (i32.eq (global.get $phase) (i32.const 6)))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 149670) (i32.const 11)))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 11)))
                (local.set $i (i32.const 0))
                (loop $find_r_msg
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 160)) (i32.lt_u (i32.add (local.get $msg_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len))))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $msg_start) (local.get $i))) (i32.const 34))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $find_r_msg)
                        )
                      )
                    )
                  )
                )
                (local.set $p (call $copy_zstr (i32.const 143280) (i32.const 65536)))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $i)))
                (local.set $p (call $copy_zstr (i32.const 143320) (local.get $p)))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (return (call $return_static (i32.const 143180)))
          )
        )

        (local.set $p (call $copy_zstr
          (if (result i32) (i32.eq (global.get $phase) (i32.const 3)) (then (i32.const 143020)) (else (i32.const 143070)))
          (i32.const 65536)))

        (local.set $scan_ptr (i32.const 900000))
        (local.set $scan_end (i32.add (i32.const 900000) (local.get $u_len)))
        (local.set $item_count (i32.const 0))

        (loop $parse_repos
          (if (i32.and (i32.lt_u (local.get $item_count) (i32.const 6)) (i32.lt_u (local.get $scan_ptr) (local.get $scan_end)))
            (then
              (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const 149540) (i32.const 13)))
              (if (i32.ge_s (local.get $idx) (i32.const 0))
                (then
                  (local.set $title_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const 13)))
                  (local.set $i (i32.const 0))
                  (loop $find_fn_end
                    (if (i32.and (i32.lt_u (local.get $i) (i32.const 90)) (i32.lt_u (i32.add (local.get $title_start) (local.get $i)) (local.get $scan_end)))
                      (then
                        (if (i32.ne (i32.load8_u (i32.add (local.get $title_start) (local.get $i))) (i32.const 34))
                          (then
                            (local.set $i (i32.add (local.get $i) (i32.const 1)))
                            (br $find_fn_end)
                          )
                        )
                      )
                    )
                  )
                  (local.set $title_len (local.get $i))
                  (local.set $scan_ptr (i32.add (local.get $title_start) (local.get $title_len)))

                  ;; Bound description search strictly before next "full_name":" (and <= scan_end)
                  (local.set $next_idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const 149540) (i32.const 13)))
                  (local.set $next_bound (if (result i32) (i32.ge_s (local.get $next_idx) (i32.const 0))
                    (then (i32.add (local.get $scan_ptr) (local.get $next_idx)))
                    (else (local.get $scan_end))))

                  (local.set $p (call $copy_zstr (i32.const 143690) (local.get $p)))
                  (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))
                  (local.set $p (call $copy_zstr (i32.const 143710) (local.get $p)))
                  (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))

                  (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $next_bound) (local.get $scan_ptr)) (i32.const 149640) (i32.const 15)))
                  (if (i32.ge_s (local.get $idx) (i32.const 0))
                    (then
                      (local.set $desc_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const 15)))
                      (local.set $i (i32.const 0))
                      (loop $find_d_end
                        (if (i32.and (i32.lt_u (local.get $i) (i32.const 100)) (i32.lt_u (i32.add (local.get $desc_start) (local.get $i)) (local.get $next_bound)))
                          (then
                            (local.set $ch (i32.load8_u (i32.add (local.get $desc_start) (local.get $i))))
                            (if (i32.and (i32.ne (local.get $ch) (i32.const 34)) (i32.ne (local.get $ch) (i32.const 10)))
                              (then
                                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                (br $find_d_end)
                              )
                            )
                          )
                        )
                      )
                      (local.set $desc_len (local.get $i))
                      (if (i32.gt_u (local.get $desc_len) (i32.const 0))
                        (then
                          (local.set $p (call $copy_zstr (i32.const 143750) (local.get $p)))
                          (local.set $p (call $copy_mem (local.get $desc_start) (local.get $p) (local.get $desc_len)))
                          (local.set $p (call $copy_zstr (i32.const 143780) (local.get $p)))
                        )
                        (else (local.set $p (call $copy_zstr (i32.const 143770) (local.get $p))))
                      )
                    )
                    (else (local.set $p (call $copy_zstr (i32.const 143770) (local.get $p))))
                  )

                  (local.set $item_count (i32.add (local.get $item_count) (i32.const 1)))
                  (br $parse_repos)
                )
              )
            )
          )
        )

        (if (i32.eqz (local.get $item_count))
          (then (return (call $return_static (i32.const 143180))))
        )
        (return (i32.sub (local.get $p) (i32.const 65536)))
      )
    )

    ;; ─── Phase 4: List Open Issues (filters /issues/ URLs & bounds title) ───
    (if (i32.eq (global.get $phase) (i32.const 4))
      (then
        (if (i32.eqz (local.get $is_200))
          (then
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 149670) (i32.const 11)))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 11)))
                (local.set $i (i32.const 0))
                (loop $find_i_msg
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 160)) (i32.lt_u (i32.add (local.get $msg_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len))))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $msg_start) (local.get $i))) (i32.const 34))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $find_i_msg)
                        )
                      )
                    )
                  )
                )
                (local.set $p (call $copy_zstr (i32.const 143280) (i32.const 65536)))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $i)))
                (local.set $p (call $copy_zstr (i32.const 143320) (local.get $p)))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (return (call $return_static (i32.const 143180)))
          )
        )

        (local.set $p (call $copy_zstr (i32.const 143120) (i32.const 65536)))
        (local.set $p (call $copy_mem (i32.const 1307000) (local.get $p) (global.get $repo_len)))
        (local.set $p (call $copy_zstr (i32.const 143160) (local.get $p)))

        (local.set $scan_ptr (i32.const 900000))
        (local.set $scan_end (i32.add (i32.const 900000) (local.get $u_len)))
        (local.set $item_count (i32.const 0))

        (loop $parse_issues
          (if (i32.and (i32.lt_u (local.get $item_count) (i32.const 6)) (i32.lt_u (local.get $scan_ptr) (local.get $scan_end)))
            (then
              (local.set $idx (call $find_substring (local.get $scan_ptr) (i32.sub (local.get $scan_end) (local.get $scan_ptr)) (i32.const 149560) (i32.const 31)))
              (if (i32.ge_s (local.get $idx) (i32.const 0))
                (then
                  (local.set $url_start (i32.add (i32.add (local.get $scan_ptr) (local.get $idx)) (i32.const 31)))
                  (local.set $i (i32.const 0))
                  (loop $find_iu_end
                    (if (i32.lt_u (i32.add (local.get $url_start) (local.get $i)) (local.get $scan_end))
                      (then
                        (if (i32.ne (i32.load8_u (i32.add (local.get $url_start) (local.get $i))) (i32.const 34))
                          (then
                            (local.set $i (i32.add (local.get $i) (i32.const 1)))
                            (br $find_iu_end)
                          )
                        )
                      )
                    )
                  )
                  (local.set $url_len (local.get $i))
                  (local.set $url_end (i32.add (local.get $url_start) (local.get $url_len)))
                  (local.set $scan_ptr (local.get $url_end))

                  ;; Only accept actual issue URLs containing "/issues/" (skip user.html_url etc.)
                  (if (i32.lt_s (call $find_substring (local.get $url_start) (local.get $url_len) (i32.const 149600) (i32.const 8)) (i32.const 0))
                    (then (br $parse_issues))
                  )

                  ;; Bound title search before the next issue URL containing "/issues/" (skipping user.html_url)
                  (local.set $next_bound (local.get $url_end))
                  (block $nb_done
                    (loop $nb_loop
                      (local.set $next_idx (call $find_substring (local.get $next_bound) (i32.sub (local.get $scan_end) (local.get $next_bound)) (i32.const 149560) (i32.const 31)))
                      (if (i32.lt_s (local.get $next_idx) (i32.const 0))
                        (then
                          (local.set $next_bound (local.get $scan_end))
                          (br $nb_done)
                        )
                      )
                      (local.set $next_bound (i32.add (i32.add (local.get $next_bound) (local.get $next_idx)) (i32.const 31)))
                      (if (i32.ge_s (call $find_substring (local.get $next_bound) (i32.sub (local.get $scan_end) (local.get $next_bound)) (i32.const 149600) (i32.const 8)) (i32.const 0))
                        (then
                          ;; Check if "/issues/" appears before the closing quote of this html_url
                          (local.set $i (i32.const 0))
                          (loop $chk_q
                            (if (i32.and (i32.lt_u (i32.add (local.get $next_bound) (local.get $i)) (local.get $scan_end))
                                         (i32.ne (i32.load8_u (i32.add (local.get $next_bound) (local.get $i))) (i32.const 34)))
                              (then
                                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                (br $chk_q)
                              )
                            )
                          )
                          (if (i32.ge_s (call $find_substring (local.get $next_bound) (local.get $i) (i32.const 149600) (i32.const 8)) (i32.const 0))
                            (then
                              (local.set $next_bound (i32.sub (local.get $next_bound) (i32.const 31)))
                              (br $nb_done)
                            )
                          )
                        )
                      )
                      (br $nb_loop)
                    )
                  )

                  (local.set $title_start (i32.const 143660))
                  (local.set $title_len (call $zlen (i32.const 143660)))
                  (local.set $idx (call $find_substring (local.get $url_end) (i32.sub (local.get $next_bound) (local.get $url_end)) (i32.const 149620) (i32.const 9)))
                  (if (i32.ge_s (local.get $idx) (i32.const 0))
                    (then
                      (local.set $title_start (i32.add (i32.add (local.get $url_end) (local.get $idx)) (i32.const 9)))
                      (local.set $i (i32.const 0))
                      (loop $find_it_end
                        (if (i32.and (i32.lt_u (local.get $i) (i32.const 100)) (i32.lt_u (i32.add (local.get $title_start) (local.get $i)) (local.get $next_bound)))
                          (then
                            (if (i32.ne (i32.load8_u (i32.add (local.get $title_start) (local.get $i))) (i32.const 34))
                              (then
                                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                                (br $find_it_end)
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

                  (local.set $p (call $copy_zstr (i32.const 143690) (local.get $p)))
                  (local.set $p (call $copy_mem (local.get $title_start) (local.get $p) (local.get $title_len)))
                  (local.set $p (call $copy_zstr (i32.const 143710) (local.get $p)))
                  (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
                  (local.set $p (call $copy_zstr (i32.const 143770) (local.get $p)))

                  (local.set $item_count (i32.add (local.get $item_count) (i32.const 1)))
                  (br $parse_issues)
                )
              )
            )
          )
        )

        (if (i32.eqz (local.get $item_count))
          (then (return (call $return_static (i32.const 143180))))
        )
        (return (i32.sub (local.get $p) (i32.const 65536)))
      )
    )

    ;; ─── Phase 5: Issue Created Response ───
    (if (i32.eq (global.get $phase) (i32.const 5))
      (then
        (if (i32.eqz (i32.or (local.get $is_200) (local.get $is_201)))
          (then
            (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 149670) (i32.const 11)))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $msg_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 11)))
                (local.set $i (i32.const 0))
                (loop $find_ci_msg
                  (if (i32.and (i32.lt_u (local.get $i) (i32.const 180)) (i32.lt_u (i32.add (local.get $msg_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len))))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $msg_start) (local.get $i))) (i32.const 34))
                        (then
                          (local.set $i (i32.add (local.get $i) (i32.const 1)))
                          (br $find_ci_msg)
                        )
                      )
                    )
                  )
                )
                (local.set $p (call $copy_zstr (i32.const 143280) (i32.const 65536)))
                (local.set $p (call $copy_mem (local.get $msg_start) (local.get $p) (local.get $i)))
                (local.set $p (call $copy_zstr (i32.const 143320) (local.get $p)))
                (return (i32.sub (local.get $p) (i32.const 65536)))
              )
            )
            (local.set $p (call $copy_zstr (i32.const 143280) (i32.const 65536)))
            (local.set $p (call $copy_zstr (i32.const 143320) (local.get $p)))
            (return (i32.sub (local.get $p) (i32.const 65536)))
          )
        )

        ;; Extract created issue html_url (points after "html_url":")
        (local.set $idx (call $find_substring (i32.const 900000) (local.get $u_len) (i32.const 149560) (i32.const 31)))
        (local.set $url_start (i32.const 900000))
        (local.set $url_len (i32.const 0))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $url_start (i32.add (i32.add (i32.const 900000) (local.get $idx)) (i32.const 12)))
            (local.set $i (i32.const 0))
            (loop $find_ci_url
              (if (i32.lt_u (i32.add (local.get $url_start) (local.get $i)) (i32.add (i32.const 900000) (local.get $u_len)))
                (then
                  (if (i32.ne (i32.load8_u (i32.add (local.get $url_start) (local.get $i))) (i32.const 34))
                    (then
                      (local.set $i (i32.add (local.get $i) (i32.const 1)))
                      (br $find_ci_url)
                    )
                  )
                )
              )
            )
            (local.set $url_len (local.get $i))
          )
        )

        (local.set $p (call $copy_zstr (i32.const 143460) (i32.const 65536)))
        (local.set $p (call $copy_mem (i32.const 1303000) (local.get $p) (global.get $arg_len)))
        (local.set $p (call $copy_zstr (i32.const 143510) (local.get $p)))
        (local.set $p (call $copy_mem (local.get $url_start) (local.get $p) (local.get $url_len)))
        (local.set $p (call $copy_zstr (i32.const 143530) (local.get $p)))

        (if (i32.gt_u (global.get $preview_len) (i32.const 0))
          (then
            (local.set $prev_copy_len (global.get $preview_len))
            (if (i32.gt_u (local.get $prev_copy_len) (i32.const 12000))
              (then (local.set $prev_copy_len (i32.const 12000)))
            )
            (local.set $p (call $copy_mem (i32.const 1600000) (local.get $p) (local.get $prev_copy_len)))
          )
        )

        (local.set $p (call $copy_zstr (i32.const 143560) (local.get $p)))
        (return (i32.sub (local.get $p) (i32.const 65536)))
      )
    )

    (call $return_static (i32.const 140000))
  )
)
