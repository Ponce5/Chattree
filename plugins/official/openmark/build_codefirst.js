const fs = require('fs');
const path = require('path');

// ─── THEME METADATA & CODE TEMPLATES ───────────────────────────────────────
const THEMES = [
  {
    id: 'dino',
    badge: 'CIENCIA & PALEONTOLOGÍA',
    paletteName: 'Selva Jurásica & Fósil',
    primary: '#10B981',
    bg: '#08100C',
    surface: '#112018',
    text: '#F5F5FA',
    accent: '#F59E0B',
    font: 'Space Grotesk / Inter',
    bgWord: 'DINO',
    metric: '100 TON',
    metricLabel: 'Argentinosaurus • 14 elefantes de peso',
    hashtags: '#Paleontologia #Dinosaurios #Ciencia #Evolucion #Aves #OpenMark'
  },
  {
    id: 'cyber',
    badge: 'TECH & AI ARCHITECTURE',
    paletteName: 'Cyberpunk Obsidian',
    primary: '#00F0FF',
    bg: '#0A0A0F',
    surface: '#12121E',
    text: '#FFFFFF',
    accent: '#7928CA',
    font: 'JetBrains Mono / Outfit',
    bgWord: 'CYBER',
    metric: '99.8%',
    metricLabel: 'Latencia submilisegundo • Pipeline Vectorial',
    hashtags: '#InteligenciaArtificial #Tech #NextGen #MachineLearning #OpenMark'
  },
  {
    id: 'gold',
    badge: 'BUSINESS & GROWTH HACKING',
    paletteName: 'Imperial Gold & Onyx',
    primary: '#F59E0B',
    bg: '#0D0D09',
    surface: '#1A1810',
    text: '#FDFBF7',
    accent: '#EAB308',
    font: 'Outfit / Syne',
    bgWord: 'SCALE',
    metric: '10x',
    metricLabel: 'Retorno sobre Inversión • Escala B2B',
    hashtags: '#Estrategia #Negocios #Emprendimiento #Growth #Marketing #OpenMark'
  },
  {
    id: 'emerald',
    badge: 'SOSTENIBILIDAD & SALUD',
    paletteName: 'Nordic Forest & Mint',
    primary: '#10B981',
    bg: '#060F0B',
    surface: '#0D1D16',
    text: '#F0FDF4',
    accent: '#34D399',
    font: 'Geist / Inter',
    bgWord: 'NATURE',
    metric: '100%',
    metricLabel: 'Orgánico & Renovable • Ciclo Circular',
    hashtags: '#Sostenibilidad #Salud #Naturaleza #EcoDesign #OpenMark'
  },
  {
    id: 'default',
    badge: 'CREATIVIDAD & PRODUCTIVIDAD',
    paletteName: 'Deep Violet & Electric Cyan',
    primary: '#8B5CF6',
    bg: '#0B0914',
    surface: '#151226',
    text: '#F5F3FF',
    accent: '#06B6D4',
    font: 'Inter / Outfit',
    bgWord: 'FLOW',
    metric: '3X',
    metricLabel: 'Eficiencia en Flujo de Trabajo',
    hashtags: '#Productividad #Diseno #Creatividad #CodeFirst #OpenMark #SocialMedia'
  }
];

function buildWatModule() {
  const themeOutputs = THEMES.map(t => {
    const slideCode = 
`// ─── React Slide 1 Component (OpenMark Code-First) ────────────
export const Slide1: React.FC<SlideProps> = ({ theme, data }) => (
  <div style={{
    width: "1080px", height: "1080px",
    background: "${t.bg}",
    fontFamily: "${t.font}",
    display: "flex", flexDirection: "column",
    justifyContent: "space-between", padding: "80px",
    position: "relative", overflow: "hidden"
  }}>
    {/* Fondo Acentuado Asimétrico */}
    <span style={{
      position: "absolute", top: "20px", right: "-10px",
      fontSize: "240px", fontWeight: 900,
      color: "${t.primary}", opacity: 0.05, lineHeight: 0.8
    }}>
      ${t.bgWord}
    </span>
    {/* Badge */}
    <div style={{
      background: "${t.primary}", color: "${t.bg}",
      padding: "10px 28px", borderRadius: "99px",
      fontSize: "15px", fontWeight: 800, letterSpacing: "2px",
      alignSelf: "flex-start", textTransform: "uppercase"
    }}>
      ${t.badge}
    </div>
    {/* Tarjeta Principal */}
    <div style={{
      background: "${t.surface}", borderLeft: "8px solid ${t.primary}",
      borderRadius: "24px", padding: "48px 56px", zIndex: 2
    }}>
      <h1 style={{ color: "${t.text}", fontSize: "58px", fontWeight: 900, lineHeight: 1.15, margin: "0 0 20px" }}>
        {data?.headline}
      </h1>
      <p style={{ color: "${t.primary}", fontSize: "24px", margin: 0, fontWeight: 600 }}>
        Métrica Clave: ${t.metric} — ${t.metricLabel}
      </p>
    </div>
    {/* Pie de Slide */}
    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "24px" }}>
      <span style={{ color: "${t.text}", fontSize: "20px", fontWeight: 700 }}>OPENMARK STUDIO</span>
      <span style={{ color: "${t.primary}", fontSize: "18px" }}>SLIDE 01 / 05</span>
    </div>
  </div>
);`;

    const md = 
`### 🎨 OpenMark Studio — Slide Canvas (1080×1080)
*Marca de agua*: ${t.bgWord}

---

#### 📐 Especificación de Diseño (Code-First)
* **Formato**: 1080 × 1080 px (Relación 1:1 Cuadrado)
* **Paleta**: ${t.paletteName} (\`Primary ${t.primary}\` • \`Surface ${t.surface}\` • \`Background ${t.bg}\`)
* **Tipografía**: ${t.font}
* **Métrica Destacada**: **${t.metric}** (${t.metricLabel})

\`\`\`tsx
${slideCode}
\`\`\`

---

#### 📱 Copy para Redes Sociales
> 🔥 **${t.badge}**  
> Desliza para descubrir los puntos clave que transforman tu perspectiva sobre este tema.
> 
> ${t.hashtags}
`;
    return { ...t, md };
  });

  let currentOffset = 16384;
  const segments = [];

  for (const t of themeOutputs) {
    const buf = Buffer.from(t.md, 'utf8');
    segments.push({
      id: t.id,
      offset: currentOffset,
      len: buf.length,
      bytes: buf
    });
    currentOffset += buf.length + 64;
  }

  const helpText = 
`### 🎨 OpenMark Studio v1.2.1
*Motor de diseño Code-First con renderizado visual interactivo nativo (canvas.render).*

**Uso:**
\`/openmark <tema o idea>\`

**Ejemplos:**
• \`/openmark 3 Curiosidades de los Dinosaurios\`
• \`/openmark Inteligencia Artificial en 2026\`
• \`/openmark 3 Claves de Crecimiento para Empresas\`
• \`/openmark Hábitos Diarios de Alta Productividad\`
`;
  const helpBuf = Buffer.from(helpText, 'utf8');
  const helpOffset = currentOffset;
  const helpLen = helpBuf.length;

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

  let wat = `;; OpenMark Code-First Presentation Plugin for Chattree
(module
  (memory (export "memory") 8)

`;

  for (const seg of segments) {
    wat += `  ;; Theme: ${seg.id} (len: ${seg.len})\n`;
    wat += `  (data (i32.const ${seg.offset}) "${escapeWatString(seg.bytes)}")\n\n`;
  }
  wat += `  ;; Help Text (len: ${helpLen})\n`;
  wat += `  (data (i32.const ${helpOffset}) "${escapeWatString(helpBuf)}")\n\n`;

  const dinoSeg = segments.find(s => s.id === 'dino');
  const cyberSeg = segments.find(s => s.id === 'cyber');
  const goldSeg = segments.find(s => s.id === 'gold');
  const emeraldSeg = segments.find(s => s.id === 'emerald');
  const defaultSeg = segments.find(s => s.id === 'default');

  wat += `  (func $copy_output (param $src_ptr i32) (param $len i32) (result i32)
    (memory.copy (i32.const 1024) (local.get $src_ptr) (local.get $len))
    (local.get $len)
  )

  ;; Check substring of 4 characters at offset $pos
  (func $match4 (param $ptr i32) (param $pos i32) (param $b0 i32) (param $b1 i32) (param $b2 i32) (param $b3 i32) (result i32)
    (local $c0 i32) (local $c1 i32) (local $c2 i32) (local $c3 i32)
    (local.set $c0 (i32.load8_u (i32.add (local.get $ptr) (local.get $pos))))
    (if (i32.and (i32.ge_u (local.get $c0) (i32.const 65)) (i32.le_u (local.get $c0) (i32.const 90)))
      (then (local.set $c0 (i32.add (local.get $c0) (i32.const 32)))))
    (if (i32.ne (local.get $c0) (local.get $b0)) (then (return (i32.const 0))))

    (local.set $c1 (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $pos) (i32.const 1)))))
    (if (i32.and (i32.ge_u (local.get $c1) (i32.const 65)) (i32.le_u (local.get $c1) (i32.const 90)))
      (then (local.set $c1 (i32.add (local.get $c1) (i32.const 32)))))
    (if (i32.ne (local.get $c1) (local.get $b1)) (then (return (i32.const 0))))

    (local.set $c2 (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $pos) (i32.const 2)))))
    (if (i32.and (i32.ge_u (local.get $c2) (i32.const 65)) (i32.le_u (local.get $c2) (i32.const 90)))
      (then (local.set $c2 (i32.add (local.get $c2) (i32.const 32)))))
    (if (i32.ne (local.get $c2) (local.get $b2)) (then (return (i32.const 0))))

    (local.set $c3 (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $pos) (i32.const 3)))))
    (if (i32.and (i32.ge_u (local.get $c3) (i32.const 65)) (i32.le_u (local.get $c3) (i32.const 90)))
      (then (local.set $c3 (i32.add (local.get $c3) (i32.const 32)))))
    (if (i32.ne (local.get $c3) (local.get $b3)) (then (return (i32.const 0))))

    (i32.const 1)
  )

  (func (export "openmark_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    (local $i i32)
    (local $max_i i32)
    (local $theme_offset i32)
    (local $theme_len i32)

    ;; 1. Empty input -> help
    (if (i32.eqz (local.get $in_len))
      (then
        (return (call $copy_output (i32.const ${helpOffset}) (i32.const ${helpLen})))
      )
    )

    ;; Default: violet
    (local.set $theme_offset (i32.const ${defaultSeg.offset}))
    (local.set $theme_len (i32.const ${defaultSeg.len}))

    (if (i32.ge_u (local.get $in_len) (i32.const 4))
      (then
        (local.set $max_i (i32.sub (local.get $in_len) (i32.const 3)))
        (local.set $i (i32.const 0))
        (block $found
          (loop $loop
            (br_if $found (i32.ge_u (local.get $i) (local.get $max_i)))

            ;; 'dino' = 100, 105, 110, 111
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 100) (i32.const 105) (i32.const 110) (i32.const 111))
              (then
                (local.set $theme_offset (i32.const ${dinoSeg.offset}))
                (local.set $theme_len (i32.const ${dinoSeg.len}))
                (br $found)
              )
            )

            ;; 'fosi' = 102, 111, 115, 105
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 102) (i32.const 111) (i32.const 115) (i32.const 105))
              (then
                (local.set $theme_offset (i32.const ${dinoSeg.offset}))
                (local.set $theme_len (i32.const ${dinoSeg.len}))
                (br $found)
              )
            )

            ;; 'inte' (inteligencia) = 105, 110, 116, 101
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 105) (i32.const 110) (i32.const 116) (i32.const 101))
              (then
                (local.set $theme_offset (i32.const ${cyberSeg.offset}))
                (local.set $theme_len (i32.const ${cyberSeg.len}))
                (br $found)
              )
            )

            ;; 'tech' = 116, 101, 99, 104
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 116) (i32.const 101) (i32.const 99) (i32.const 104))
              (then
                (local.set $theme_offset (i32.const ${cyberSeg.offset}))
                (local.set $theme_len (i32.const ${cyberSeg.len}))
                (br $found)
              )
            )

            ;; 'robo' (robot) = 114, 111, 98, 111
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 114) (i32.const 111) (i32.const 98) (i32.const 111))
              (then
                (local.set $theme_offset (i32.const ${cyberSeg.offset}))
                (local.set $theme_len (i32.const ${cyberSeg.len}))
                (br $found)
              )
            )

            ;; 'crec' (crecimiento) = 99, 114, 101, 99
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 99) (i32.const 114) (i32.const 101) (i32.const 99))
              (then
                (local.set $theme_offset (i32.const ${goldSeg.offset}))
                (local.set $theme_len (i32.const ${goldSeg.len}))
                (br $found)
              )
            )

            ;; 'nego' (negocio) = 110, 101, 103, 111
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 110) (i32.const 101) (i32.const 103) (i32.const 111))
              (then
                (local.set $theme_offset (i32.const ${goldSeg.offset}))
                (local.set $theme_len (i32.const ${goldSeg.len}))
                (br $found)
              )
            )

            ;; 'vent' (ventas) = 118, 101, 110, 116
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 118) (i32.const 101) (i32.const 110) (i32.const 116))
              (then
                (local.set $theme_offset (i32.const ${goldSeg.offset}))
                (local.set $theme_len (i32.const ${goldSeg.len}))
                (br $found)
              )
            )

            ;; 'salu' (salud) = 115, 97, 108, 117
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 115) (i32.const 97) (i32.const 108) (i32.const 117))
              (then
                (local.set $theme_offset (i32.const ${emeraldSeg.offset}))
                (local.set $theme_len (i32.const ${emeraldSeg.len}))
                (br $found)
              )
            )

            ;; 'verd' (verde) = 118, 101, 114, 100
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 118) (i32.const 101) (i32.const 114) (i32.const 100))
              (then
                (local.set $theme_offset (i32.const ${emeraldSeg.offset}))
                (local.set $theme_len (i32.const ${emeraldSeg.len}))
                (br $found)
              )
            )

            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $loop)
          )
        )
      )
    )

    (call $copy_output (local.get $theme_offset) (local.get $theme_len))
  )
)
`;

  return wat;
}

const wat = buildWatModule();
fs.writeFileSync(path.join(__dirname, 'plugin.wat'), wat, 'utf8');
console.log('Successfully generated Code-First OpenMark plugin.wat with 4-byte matcher!');
