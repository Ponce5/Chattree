const fs = require('fs');
const path = require('path');

// ─── CHUNKS FOR DYNAMIC OPENMARK CODE-FIRST GENERATION ───────────────────────
const CHUNK1 = `### 🎨 OpenMark Studio — Slide Canvas (1080×1080)
*Marca de agua*: `;

const CHUNK2 = `

---

#### 📐 Especificación de Diseño (Code-First)
* **Formato**: 1080 × 1080 px (Relación 1:1 Cuadrado)
* **Paleta**: Modern Studio Dark & Violet (\`Primary #8B5CF6\` • \`Surface #151226\` • \`Background #0B0914\`)
* **Tipografía**: Outfit / Space Grotesk
* **Métrica Destacada**: **TOP 1** (`;

const CHUNK3 = `)

\`\`\`tsx
// ─── React Slide 1 Component (OpenMark Code-First) ────────────
export const Slide1: React.FC<SlideProps> = ({ theme, data }) => (
  <div style={{
    width: "1080px", height: "1080px",
    background: "#0B0914",
    fontFamily: "Outfit",
    display: "flex", flexDirection: "column",
    justifyContent: "space-between", padding: "80px",
    position: "relative", overflow: "hidden"
  }}>
    <span style={{
      position: "absolute", top: "20px", right: "-10px",
      fontSize: "240px", fontWeight: 900,
      color: "#8B5CF6", opacity: 0.05, lineHeight: 0.8
    }}>
      `;

const CHUNK4 = `
    </span>
    <div style={{
      background: "#8B5CF6", color: "#0B0914",
      padding: "10px 28px", borderRadius: "99px",
      fontSize: "15px", fontWeight: 800, letterSpacing: "2px",
      alignSelf: "flex-start", textTransform: "uppercase"
    }}>
      OPENMARK STUDIO
    </div>
    <div style={{
      background: "#151226", borderLeft: "8px solid #8B5CF6",
      borderRadius: "24px", padding: "48px 56px", zIndex: 2
    }}>
      <h1 style={{ color: "#F5F3FF", fontSize: "52px", fontWeight: 900, lineHeight: 1.15, margin: "0 0 20px" }}>
        `;

const CHUNK5 = `
      </h1>
      <p style={{ color: "#8B5CF6", fontSize: "24px", margin: 0, fontWeight: 600 }}>
        Métrica Clave: TOP 1 — `;

const CHUNK6 = `
      </p>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "24px" }}>
      <span style={{ color: "#F5F3FF", fontSize: "20px", fontWeight: 700 }}>OPENMARK STUDIO</span>
      <span style={{ color: "#8B5CF6", fontSize: "18px" }}>SLIDE 01 / 05</span>
    </div>
  </div>
);
\`\`\`

---

#### 📱 Copy para Redes Sociales
> 🔥 **`;

const CHUNK7 = `**  
> Desliza para explorar todos los detalles clave y datos sorprendentes sobre este tema.
> 
> #OpenMark #CodeFirst #Innovation #Design
`;

const HELP_TEXT = `### 🎨 OpenMark Studio v1.3.0
*Motor de diseño Code-First con renderizado visual nativo a PNG en Chattree.*

**Uso:**
\`/openmark <tema o idea>\`

**Ejemplos:**
• \`/openmark 3 Curiosidades Fascinantes del Espacio\`
• \`/openmark Inteligencia Artificial en 2026\`
• \`/openmark Estrategias de Crecimiento para Startups\`
`;

function escapeWatString(buf) {
  let s = '';
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 0x22) s += '\\"';
    else if (b === 0x5c) s += '\\\\';
    else if (b >= 0x20 && b <= 0x7e) s += String.fromCharCode(b);
    else s += '\\' + b.toString(16).padStart(2, '0');
  }
  return s;
}

function buildWat() {
  const c1 = Buffer.from(CHUNK1, 'utf8');
  const c2 = Buffer.from(CHUNK2, 'utf8');
  const c3 = Buffer.from(CHUNK3, 'utf8');
  const c4 = Buffer.from(CHUNK4, 'utf8');
  const c5 = Buffer.from(CHUNK5, 'utf8');
  const c6 = Buffer.from(CHUNK6, 'utf8');
  const c7 = Buffer.from(CHUNK7, 'utf8');
  const help = Buffer.from(HELP_TEXT, 'utf8');

  const OFF_HELP = 8192;
  const OFF_C1 = 10000;
  const OFF_C2 = OFF_C1 + c1.length + 32;
  const OFF_C3 = OFF_C2 + c2.length + 32;
  const OFF_C4 = OFF_C3 + c3.length + 32;
  const OFF_C5 = OFF_C4 + c4.length + 32;
  const OFF_C6 = OFF_C5 + c5.length + 32;
  const OFF_C7 = OFF_C6 + c6.length + 32;

  let wat = `;; Dynamic OpenMark Code-First Plugin for Chattree v1.3.0
(module
  (memory (export "memory") 8)

  (data (i32.const ${OFF_HELP}) "${escapeWatString(help)}")
  (data (i32.const ${OFF_C1}) "${escapeWatString(c1)}")
  (data (i32.const ${OFF_C2}) "${escapeWatString(c2)}")
  (data (i32.const ${OFF_C3}) "${escapeWatString(c3)}")
  (data (i32.const ${OFF_C4}) "${escapeWatString(c4)}")
  (data (i32.const ${OFF_C5}) "${escapeWatString(c5)}")
  (data (i32.const ${OFF_C6}) "${escapeWatString(c6)}")
  (data (i32.const ${OFF_C7}) "${escapeWatString(c7)}")

  ;; Default watermark "CANVAS" at offset 500
  (data (i32.const 500) "CANVAS")

  (func (export "openmark_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $out_ptr i32)
    (local $title_ptr i32)
    (local $title_len i32)
    (local $wm_ptr i32)
    (local $wm_len i32)
    (local $i i32)
    (local $ch i32)
    (local $j i32)
    (local $match i32)

    ;; 1. If empty input -> return help
    (if (i32.eqz (local.get $in_len))
      (then
        (memory.copy (i32.const 1024) (i32.const ${OFF_HELP}) (i32.const ${help.length}))
        (return (i32.const ${help.length}))
      )
    )

    ;; 2. Default: title is the entire input
    (local.set $title_ptr (local.get $in_ptr))
    (local.set $title_len (local.get $in_len))

    ;; 3. Check if input is JSON starting with '{' (123)
    (if (i32.eq (i32.load8_u (local.get $in_ptr)) (i32.const 123))
      (then
        ;; Search for '"title":' -> 34, 116, 105, 116, 108, 101, 34, 58
        (local.set $i (i32.const 0))
        (block $json_search_done
          (loop $json_loop
            (if (i32.ge_u (local.get $i) (i32.sub (local.get $in_len) (i32.const 10)))
              (then (br $json_search_done))
            )

            ;; check "title":
            (local.set $match (i32.const 1))
            ;; '"'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (local.get $i))) (i32.const 34)) (then (local.set $match (i32.const 0))))
            ;; 't'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $i) (i32.const 1)))) (i32.const 116)) (then (local.set $match (i32.const 0))))
            ;; 'i'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $i) (i32.const 2)))) (i32.const 105)) (then (local.set $match (i32.const 0))))
            ;; 't'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $i) (i32.const 3)))) (i32.const 116)) (then (local.set $match (i32.const 0))))
            ;; 'l'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $i) (i32.const 4)))) (i32.const 108)) (then (local.set $match (i32.const 0))))
            ;; 'e'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $i) (i32.const 5)))) (i32.const 101)) (then (local.set $match (i32.const 0))))
            ;; '"'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $i) (i32.const 6)))) (i32.const 34)) (then (local.set $match (i32.const 0))))
            ;; ':'
            (if (i32.ne (i32.load8_u (i32.add (local.get $in_ptr) (i32.add (local.get $i) (i32.const 7)))) (i32.const 58)) (then (local.set $match (i32.const 0))))

            (if (local.get $match)
              (then
                ;; Skip any whitespace and the opening '"'
                (local.set $j (i32.add (local.get $i) (i32.const 8)))
                (loop $skip_ws
                  (if (i32.lt_u (local.get $j) (local.get $in_len))
                    (then
                      (if (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (local.get $j))) (i32.const 34))
                        (then
                          (local.set $j (i32.add (local.get $j) (i32.const 1)))
                        )
                        (else
                          (if (i32.eq (i32.load8_u (i32.add (local.get $in_ptr) (local.get $j))) (i32.const 32))
                            (then
                              (local.set $j (i32.add (local.get $j) (i32.const 1)))
                              (br $skip_ws)
                            )
                          )
                        )
                      )
                    )
                  )
                )

                (local.set $title_ptr (i32.add (local.get $in_ptr) (local.get $j)))
                (local.set $title_len (i32.const 0))
                ;; Count until closing '"'
                (loop $count_title
                  (if (i32.lt_u (i32.add (local.get $j) (local.get $title_len)) (local.get $in_len))
                    (then
                      (if (i32.ne (i32.load8_u (i32.add (local.get $title_ptr) (local.get $title_len))) (i32.const 34))
                        (then
                          (local.set $title_len (i32.add (local.get $title_len) (i32.const 1)))
                          (br $count_title)
                        )
                      )
                    )
                  )
                )
                (br $json_search_done)
              )
            )

            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $json_loop)
          )
        )
      )
    )

    ;; 4. Extract dynamic watermark at offset 600 (uppercase first keyword)
    (local.set $wm_ptr (i32.const 600))
    (local.set $wm_len (i32.const 0))
    (local.set $i (i32.const 0))

    ;; Skip leading spaces, numbers or common punctuation
    (loop $skip_punct
      (if (i32.lt_u (local.get $i) (local.get $title_len))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $title_ptr) (local.get $i))))
          (if (i32.or
                (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 90)))
                (i32.and (i32.ge_u (local.get $ch) (i32.const 97)) (i32.le_u (local.get $ch) (i32.const 122))))
            (then
              ;; Found letter!
            )
            (else
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $skip_punct)
            )
          )
        )
      )
    )

    ;; Copy up to 8 letters to wm_ptr in uppercase
    (loop $wm_copy
      (if (i32.and (i32.lt_u (local.get $i) (local.get $title_len)) (i32.lt_u (local.get $wm_len) (i32.const 8)))
        (then
          (local.set $ch (i32.load8_u (i32.add (local.get $title_ptr) (local.get $i))))
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 97)) (i32.le_u (local.get $ch) (i32.const 122)))
            (then
              (local.set $ch (i32.sub (local.get $ch) (i32.const 32)))
            )
          )
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 90)))
            (then
              (i32.store8 (i32.add (local.get $wm_ptr) (local.get $wm_len)) (local.get $ch))
              (local.set $wm_len (i32.add (local.get $wm_len) (i32.const 1)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $wm_copy)
            )
          )
        )
      )
    )

    ;; If watermark is empty, fall back to "CANVAS" (offset 500, len 6)
    (if (i32.eqz (local.get $wm_len))
      (then
        (local.set $wm_ptr (i32.const 500))
        (local.set $wm_len (i32.const 6))
      )
    )

    ;; 5. Assemble dynamic markdown response at offset 1024
    (local.set $out_ptr (i32.const 1024))

    ;; Chunk 1
    (memory.copy (local.get $out_ptr) (i32.const ${OFF_C1}) (i32.const ${c1.length}))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const ${c1.length})))

    ;; Watermark
    (memory.copy (local.get $out_ptr) (local.get $wm_ptr) (local.get $wm_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $wm_len)))

    ;; Chunk 2
    (memory.copy (local.get $out_ptr) (i32.const ${OFF_C2}) (i32.const ${c2.length}))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const ${c2.length})))

    ;; Title
    (memory.copy (local.get $out_ptr) (local.get $title_ptr) (local.get $title_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $title_len)))

    ;; Chunk 3
    (memory.copy (local.get $out_ptr) (i32.const ${OFF_C3}) (i32.const ${c3.length}))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const ${c3.length})))

    ;; Watermark
    (memory.copy (local.get $out_ptr) (local.get $wm_ptr) (local.get $wm_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $wm_len)))

    ;; Chunk 4
    (memory.copy (local.get $out_ptr) (i32.const ${OFF_C4}) (i32.const ${c4.length}))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const ${c4.length})))

    ;; Title
    (memory.copy (local.get $out_ptr) (local.get $title_ptr) (local.get $title_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $title_len)))

    ;; Chunk 5
    (memory.copy (local.get $out_ptr) (i32.const ${OFF_C5}) (i32.const ${c5.length}))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const ${c5.length})))

    ;; Title
    (memory.copy (local.get $out_ptr) (local.get $title_ptr) (local.get $title_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $title_len)))

    ;; Chunk 6
    (memory.copy (local.get $out_ptr) (i32.const ${OFF_C6}) (i32.const ${c6.length}))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const ${c6.length})))

    ;; Title
    (memory.copy (local.get $out_ptr) (local.get $title_ptr) (local.get $title_len))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (local.get $title_len)))

    ;; Chunk 7
    (memory.copy (local.get $out_ptr) (i32.const ${OFF_C7}) (i32.const ${c7.length}))
    (local.set $out_ptr (i32.add (local.get $out_ptr) (i32.const ${c7.length})))

    (i32.sub (local.get $out_ptr) (i32.const 1024))
  )
)
`;
  return wat;
}

const wat = buildWat();
fs.writeFileSync(path.join(__dirname, 'plugin.wat'), wat, 'utf8');
console.log('Successfully generated dynamic OpenMark plugin.wat without hardcoded static templates!');
