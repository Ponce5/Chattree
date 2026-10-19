;; OpenMark Code-First Presentation Plugin for Chattree
(module
  (memory (export "memory") 8)

  ;; Theme: dino (len: 2627)
  (data (i32.const 16384) "### \f0\9f\8e\a8 OpenMark Studio \e2\80\94 Slide Canvas (1080\c3\971080)\0a\0a![OpenMark Slide](https://og-image.vercel.app/**CIENCIA%20%26%20PALEONTOLOG%C3%8DA**.png?theme=dark&md=1&fontSize=65px)\0a\0a---\0a\0a#### \f0\9f\93\90 Especificaci\c3\b3n de Dise\c3\b1o (Code-First)\0a* **Formato**: 1080 \c3\97 1080 px (Relaci\c3\b3n 1:1 Cuadrado)\0a* **Paleta**: Selva Jur\c3\a1sica & F\c3\b3sil (`Primary #10B981` \e2\80\a2 `Surface #112018` \e2\80\a2 `Background #08100C`)\0a* **Tipograf\c3\ada**: Space Grotesk / Inter\0a* **M\c3\a9trica Destacada**: **100 TON** (Argentinosaurus \e2\80\a2 14 elefantes de peso)\0a\0a```tsx\0a// \e2\94\80\e2\94\80\e2\94\80 React Slide 1 Component (OpenMark Code-First) \e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\0aexport const Slide1: React.FC<SlideProps> = ({ theme, data }) => (\0a  <div style={{\0a    width: \"1080px\", height: \"1080px\",\0a    background: \"#08100C\",\0a    fontFamily: \"Space Grotesk / Inter\",\0a    display: \"flex\", flexDirection: \"column\",\0a    justifyContent: \"space-between\", padding: \"80px\",\0a    position: \"relative\", overflow: \"hidden\"\0a  }}>\0a    {/* Fondo Acentuado Asim\c3\a9trico */}\0a    <span style={{\0a      position: \"absolute\", top: \"20px\", right: \"-10px\",\0a      fontSize: \"240px\", fontWeight: 900,\0a      color: \"#10B981\", opacity: 0.05, lineHeight: 0.8\0a    }}>\0a      DINO\0a    </span>\0a    {/* Badge */}\0a    <div style={{\0a      background: \"#10B981\", color: \"#08100C\",\0a      padding: \"10px 28px\", borderRadius: \"99px\",\0a      fontSize: \"15px\", fontWeight: 800, letterSpacing: \"2px\",\0a      alignSelf: \"flex-start\", textTransform: \"uppercase\"\0a    }}>\0a      CIENCIA & PALEONTOLOG\c3\8dA\0a    </div>\0a    {/* Tarjeta Principal */}\0a    <div style={{\0a      background: \"#112018\", borderLeft: \"8px solid #10B981\",\0a      borderRadius: \"24px\", padding: \"48px 56px\", zIndex: 2\0a    }}>\0a      <h1 style={{ color: \"#F5F5FA\", fontSize: \"58px\", fontWeight: 900, lineHeight: 1.15, margin: \"0 0 20px\" }}>\0a        {data?.headline}\0a      </h1>\0a      <p style={{ color: \"#10B981\", fontSize: \"24px\", margin: 0, fontWeight: 600 }}>\0a        M\c3\a9trica Clave: 100 TON \e2\80\94 Argentinosaurus \e2\80\a2 14 elefantes de peso\0a      </p>\0a    </div>\0a    {/* Pie de Slide */}\0a    <div style={{ display: \"flex\", justifyContent: \"space-between\", borderTop: \"1px solid rgba(255,255,255,0.1)\", paddingTop: \"24px\" }}>\0a      <span style={{ color: \"#F5F5FA\", fontSize: \"20px\", fontWeight: 700 }}>OPENMARK STUDIO</span>\0a      <span style={{ color: \"#10B981\", fontSize: \"18px\" }}>SLIDE 01 / 05</span>\0a    </div>\0a  </div>\0a);\0a```\0a\0a---\0a\0a#### \f0\9f\93\b1 Copy para Redes Sociales\0a> \f0\9f\94\a5 **CIENCIA & PALEONTOLOG\c3\8dA**  \0a> Desliza para descubrir los puntos clave que transforman tu perspectiva sobre este tema.\0a> \0a> #Paleontologia #Dinosaurios #Ciencia #Evolucion #Aves #OpenMark\0a")

  ;; Theme: cyber (len: 2628)
  (data (i32.const 19075) "### \f0\9f\8e\a8 OpenMark Studio \e2\80\94 Slide Canvas (1080\c3\971080)\0a\0a![OpenMark Slide](https://og-image.vercel.app/**TECH%20%26%20AI%20ARCHITECTURE**.png?theme=dark&md=1&fontSize=65px)\0a\0a---\0a\0a#### \f0\9f\93\90 Especificaci\c3\b3n de Dise\c3\b1o (Code-First)\0a* **Formato**: 1080 \c3\97 1080 px (Relaci\c3\b3n 1:1 Cuadrado)\0a* **Paleta**: Cyberpunk Obsidian (`Primary #00F0FF` \e2\80\a2 `Surface #12121E` \e2\80\a2 `Background #0A0A0F`)\0a* **Tipograf\c3\ada**: JetBrains Mono / Outfit\0a* **M\c3\a9trica Destacada**: **99.8%** (Latencia submilisegundo \e2\80\a2 Pipeline Vectorial)\0a\0a```tsx\0a// \e2\94\80\e2\94\80\e2\94\80 React Slide 1 Component (OpenMark Code-First) \e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\0aexport const Slide1: React.FC<SlideProps> = ({ theme, data }) => (\0a  <div style={{\0a    width: \"1080px\", height: \"1080px\",\0a    background: \"#0A0A0F\",\0a    fontFamily: \"JetBrains Mono / Outfit\",\0a    display: \"flex\", flexDirection: \"column\",\0a    justifyContent: \"space-between\", padding: \"80px\",\0a    position: \"relative\", overflow: \"hidden\"\0a  }}>\0a    {/* Fondo Acentuado Asim\c3\a9trico */}\0a    <span style={{\0a      position: \"absolute\", top: \"20px\", right: \"-10px\",\0a      fontSize: \"240px\", fontWeight: 900,\0a      color: \"#00F0FF\", opacity: 0.05, lineHeight: 0.8\0a    }}>\0a      CYBER\0a    </span>\0a    {/* Badge */}\0a    <div style={{\0a      background: \"#00F0FF\", color: \"#0A0A0F\",\0a      padding: \"10px 28px\", borderRadius: \"99px\",\0a      fontSize: \"15px\", fontWeight: 800, letterSpacing: \"2px\",\0a      alignSelf: \"flex-start\", textTransform: \"uppercase\"\0a    }}>\0a      TECH & AI ARCHITECTURE\0a    </div>\0a    {/* Tarjeta Principal */}\0a    <div style={{\0a      background: \"#12121E\", borderLeft: \"8px solid #00F0FF\",\0a      borderRadius: \"24px\", padding: \"48px 56px\", zIndex: 2\0a    }}>\0a      <h1 style={{ color: \"#FFFFFF\", fontSize: \"58px\", fontWeight: 900, lineHeight: 1.15, margin: \"0 0 20px\" }}>\0a        {data?.headline}\0a      </h1>\0a      <p style={{ color: \"#00F0FF\", fontSize: \"24px\", margin: 0, fontWeight: 600 }}>\0a        M\c3\a9trica Clave: 99.8% \e2\80\94 Latencia submilisegundo \e2\80\a2 Pipeline Vectorial\0a      </p>\0a    </div>\0a    {/* Pie de Slide */}\0a    <div style={{ display: \"flex\", justifyContent: \"space-between\", borderTop: \"1px solid rgba(255,255,255,0.1)\", paddingTop: \"24px\" }}>\0a      <span style={{ color: \"#FFFFFF\", fontSize: \"20px\", fontWeight: 700 }}>OPENMARK STUDIO</span>\0a      <span style={{ color: \"#00F0FF\", fontSize: \"18px\" }}>SLIDE 01 / 05</span>\0a    </div>\0a  </div>\0a);\0a```\0a\0a---\0a\0a#### \f0\9f\93\b1 Copy para Redes Sociales\0a> \f0\9f\94\a5 **TECH & AI ARCHITECTURE**  \0a> Desliza para descubrir los puntos clave que transforman tu perspectiva sobre este tema.\0a> \0a> #InteligenciaArtificial #Tech #NextGen #MachineLearning #OpenMark\0a")

  ;; Theme: gold (len: 2602)
  (data (i32.const 21767) "### \f0\9f\8e\a8 OpenMark Studio \e2\80\94 Slide Canvas (1080\c3\971080)\0a\0a![OpenMark Slide](https://og-image.vercel.app/**BUSINESS%20%26%20GROWTH%20HACKING**.png?theme=dark&md=1&fontSize=65px)\0a\0a---\0a\0a#### \f0\9f\93\90 Especificaci\c3\b3n de Dise\c3\b1o (Code-First)\0a* **Formato**: 1080 \c3\97 1080 px (Relaci\c3\b3n 1:1 Cuadrado)\0a* **Paleta**: Imperial Gold & Onyx (`Primary #F59E0B` \e2\80\a2 `Surface #1A1810` \e2\80\a2 `Background #0D0D09`)\0a* **Tipograf\c3\ada**: Outfit / Syne\0a* **M\c3\a9trica Destacada**: **10x** (Retorno sobre Inversi\c3\b3n \e2\80\a2 Escala B2B)\0a\0a```tsx\0a// \e2\94\80\e2\94\80\e2\94\80 React Slide 1 Component (OpenMark Code-First) \e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\0aexport const Slide1: React.FC<SlideProps> = ({ theme, data }) => (\0a  <div style={{\0a    width: \"1080px\", height: \"1080px\",\0a    background: \"#0D0D09\",\0a    fontFamily: \"Outfit / Syne\",\0a    display: \"flex\", flexDirection: \"column\",\0a    justifyContent: \"space-between\", padding: \"80px\",\0a    position: \"relative\", overflow: \"hidden\"\0a  }}>\0a    {/* Fondo Acentuado Asim\c3\a9trico */}\0a    <span style={{\0a      position: \"absolute\", top: \"20px\", right: \"-10px\",\0a      fontSize: \"240px\", fontWeight: 900,\0a      color: \"#F59E0B\", opacity: 0.05, lineHeight: 0.8\0a    }}>\0a      SCALE\0a    </span>\0a    {/* Badge */}\0a    <div style={{\0a      background: \"#F59E0B\", color: \"#0D0D09\",\0a      padding: \"10px 28px\", borderRadius: \"99px\",\0a      fontSize: \"15px\", fontWeight: 800, letterSpacing: \"2px\",\0a      alignSelf: \"flex-start\", textTransform: \"uppercase\"\0a    }}>\0a      BUSINESS & GROWTH HACKING\0a    </div>\0a    {/* Tarjeta Principal */}\0a    <div style={{\0a      background: \"#1A1810\", borderLeft: \"8px solid #F59E0B\",\0a      borderRadius: \"24px\", padding: \"48px 56px\", zIndex: 2\0a    }}>\0a      <h1 style={{ color: \"#FDFBF7\", fontSize: \"58px\", fontWeight: 900, lineHeight: 1.15, margin: \"0 0 20px\" }}>\0a        {data?.headline}\0a      </h1>\0a      <p style={{ color: \"#F59E0B\", fontSize: \"24px\", margin: 0, fontWeight: 600 }}>\0a        M\c3\a9trica Clave: 10x \e2\80\94 Retorno sobre Inversi\c3\b3n \e2\80\a2 Escala B2B\0a      </p>\0a    </div>\0a    {/* Pie de Slide */}\0a    <div style={{ display: \"flex\", justifyContent: \"space-between\", borderTop: \"1px solid rgba(255,255,255,0.1)\", paddingTop: \"24px\" }}>\0a      <span style={{ color: \"#FDFBF7\", fontSize: \"20px\", fontWeight: 700 }}>OPENMARK STUDIO</span>\0a      <span style={{ color: \"#F59E0B\", fontSize: \"18px\" }}>SLIDE 01 / 05</span>\0a    </div>\0a  </div>\0a);\0a```\0a\0a---\0a\0a#### \f0\9f\93\b1 Copy para Redes Sociales\0a> \f0\9f\94\a5 **BUSINESS & GROWTH HACKING**  \0a> Desliza para descubrir los puntos clave que transforman tu perspectiva sobre este tema.\0a> \0a> #Estrategia #Negocios #Emprendimiento #Growth #Marketing #OpenMark\0a")

  ;; Theme: emerald (len: 2585)
  (data (i32.const 24433) "### \f0\9f\8e\a8 OpenMark Studio \e2\80\94 Slide Canvas (1080\c3\971080)\0a\0a![OpenMark Slide](https://og-image.vercel.app/**SOSTENIBILIDAD%20%26%20SALUD**.png?theme=dark&md=1&fontSize=65px)\0a\0a---\0a\0a#### \f0\9f\93\90 Especificaci\c3\b3n de Dise\c3\b1o (Code-First)\0a* **Formato**: 1080 \c3\97 1080 px (Relaci\c3\b3n 1:1 Cuadrado)\0a* **Paleta**: Nordic Forest & Mint (`Primary #10B981` \e2\80\a2 `Surface #0D1D16` \e2\80\a2 `Background #060F0B`)\0a* **Tipograf\c3\ada**: Geist / Inter\0a* **M\c3\a9trica Destacada**: **100%** (Org\c3\a1nico & Renovable \e2\80\a2 Ciclo Circular)\0a\0a```tsx\0a// \e2\94\80\e2\94\80\e2\94\80 React Slide 1 Component (OpenMark Code-First) \e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\0aexport const Slide1: React.FC<SlideProps> = ({ theme, data }) => (\0a  <div style={{\0a    width: \"1080px\", height: \"1080px\",\0a    background: \"#060F0B\",\0a    fontFamily: \"Geist / Inter\",\0a    display: \"flex\", flexDirection: \"column\",\0a    justifyContent: \"space-between\", padding: \"80px\",\0a    position: \"relative\", overflow: \"hidden\"\0a  }}>\0a    {/* Fondo Acentuado Asim\c3\a9trico */}\0a    <span style={{\0a      position: \"absolute\", top: \"20px\", right: \"-10px\",\0a      fontSize: \"240px\", fontWeight: 900,\0a      color: \"#10B981\", opacity: 0.05, lineHeight: 0.8\0a    }}>\0a      NATURE\0a    </span>\0a    {/* Badge */}\0a    <div style={{\0a      background: \"#10B981\", color: \"#060F0B\",\0a      padding: \"10px 28px\", borderRadius: \"99px\",\0a      fontSize: \"15px\", fontWeight: 800, letterSpacing: \"2px\",\0a      alignSelf: \"flex-start\", textTransform: \"uppercase\"\0a    }}>\0a      SOSTENIBILIDAD & SALUD\0a    </div>\0a    {/* Tarjeta Principal */}\0a    <div style={{\0a      background: \"#0D1D16\", borderLeft: \"8px solid #10B981\",\0a      borderRadius: \"24px\", padding: \"48px 56px\", zIndex: 2\0a    }}>\0a      <h1 style={{ color: \"#F0FDF4\", fontSize: \"58px\", fontWeight: 900, lineHeight: 1.15, margin: \"0 0 20px\" }}>\0a        {data?.headline}\0a      </h1>\0a      <p style={{ color: \"#10B981\", fontSize: \"24px\", margin: 0, fontWeight: 600 }}>\0a        M\c3\a9trica Clave: 100% \e2\80\94 Org\c3\a1nico & Renovable \e2\80\a2 Ciclo Circular\0a      </p>\0a    </div>\0a    {/* Pie de Slide */}\0a    <div style={{ display: \"flex\", justifyContent: \"space-between\", borderTop: \"1px solid rgba(255,255,255,0.1)\", paddingTop: \"24px\" }}>\0a      <span style={{ color: \"#F0FDF4\", fontSize: \"20px\", fontWeight: 700 }}>OPENMARK STUDIO</span>\0a      <span style={{ color: \"#10B981\", fontSize: \"18px\" }}>SLIDE 01 / 05</span>\0a    </div>\0a  </div>\0a);\0a```\0a\0a---\0a\0a#### \f0\9f\93\b1 Copy para Redes Sociales\0a> \f0\9f\94\a5 **SOSTENIBILIDAD & SALUD**  \0a> Desliza para descubrir los puntos clave que transforman tu perspectiva sobre este tema.\0a> \0a> #Sostenibilidad #Salud #Naturaleza #EcoDesign #OpenMark\0a")

  ;; Theme: default (len: 2597)
  (data (i32.const 27082) "### \f0\9f\8e\a8 OpenMark Studio \e2\80\94 Slide Canvas (1080\c3\971080)\0a\0a![OpenMark Slide](https://og-image.vercel.app/**CREATIVIDAD%20%26%20PRODUCTIVIDAD**.png?theme=dark&md=1&fontSize=65px)\0a\0a---\0a\0a#### \f0\9f\93\90 Especificaci\c3\b3n de Dise\c3\b1o (Code-First)\0a* **Formato**: 1080 \c3\97 1080 px (Relaci\c3\b3n 1:1 Cuadrado)\0a* **Paleta**: Deep Violet & Electric Cyan (`Primary #8B5CF6` \e2\80\a2 `Surface #151226` \e2\80\a2 `Background #0B0914`)\0a* **Tipograf\c3\ada**: Inter / Outfit\0a* **M\c3\a9trica Destacada**: **3X** (Eficiencia en Flujo de Trabajo)\0a\0a```tsx\0a// \e2\94\80\e2\94\80\e2\94\80 React Slide 1 Component (OpenMark Code-First) \e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\e2\94\80\0aexport const Slide1: React.FC<SlideProps> = ({ theme, data }) => (\0a  <div style={{\0a    width: \"1080px\", height: \"1080px\",\0a    background: \"#0B0914\",\0a    fontFamily: \"Inter / Outfit\",\0a    display: \"flex\", flexDirection: \"column\",\0a    justifyContent: \"space-between\", padding: \"80px\",\0a    position: \"relative\", overflow: \"hidden\"\0a  }}>\0a    {/* Fondo Acentuado Asim\c3\a9trico */}\0a    <span style={{\0a      position: \"absolute\", top: \"20px\", right: \"-10px\",\0a      fontSize: \"240px\", fontWeight: 900,\0a      color: \"#8B5CF6\", opacity: 0.05, lineHeight: 0.8\0a    }}>\0a      FLOW\0a    </span>\0a    {/* Badge */}\0a    <div style={{\0a      background: \"#8B5CF6\", color: \"#0B0914\",\0a      padding: \"10px 28px\", borderRadius: \"99px\",\0a      fontSize: \"15px\", fontWeight: 800, letterSpacing: \"2px\",\0a      alignSelf: \"flex-start\", textTransform: \"uppercase\"\0a    }}>\0a      CREATIVIDAD & PRODUCTIVIDAD\0a    </div>\0a    {/* Tarjeta Principal */}\0a    <div style={{\0a      background: \"#151226\", borderLeft: \"8px solid #8B5CF6\",\0a      borderRadius: \"24px\", padding: \"48px 56px\", zIndex: 2\0a    }}>\0a      <h1 style={{ color: \"#F5F3FF\", fontSize: \"58px\", fontWeight: 900, lineHeight: 1.15, margin: \"0 0 20px\" }}>\0a        {data?.headline}\0a      </h1>\0a      <p style={{ color: \"#8B5CF6\", fontSize: \"24px\", margin: 0, fontWeight: 600 }}>\0a        M\c3\a9trica Clave: 3X \e2\80\94 Eficiencia en Flujo de Trabajo\0a      </p>\0a    </div>\0a    {/* Pie de Slide */}\0a    <div style={{ display: \"flex\", justifyContent: \"space-between\", borderTop: \"1px solid rgba(255,255,255,0.1)\", paddingTop: \"24px\" }}>\0a      <span style={{ color: \"#F5F3FF\", fontSize: \"20px\", fontWeight: 700 }}>OPENMARK STUDIO</span>\0a      <span style={{ color: \"#8B5CF6\", fontSize: \"18px\" }}>SLIDE 01 / 05</span>\0a    </div>\0a  </div>\0a);\0a```\0a\0a---\0a\0a#### \f0\9f\93\b1 Copy para Redes Sociales\0a> \f0\9f\94\a5 **CREATIVIDAD & PRODUCTIVIDAD**  \0a> Desliza para descubrir los puntos clave que transforman tu perspectiva sobre este tema.\0a> \0a> #Productividad #Diseno #Creatividad #CodeFirst #OpenMark #SocialMedia\0a")

  ;; Help Text (len: 372)
  (data (i32.const 29743) "### \f0\9f\8e\a8 OpenMark Studio v1.2.0\0a*Motor de dise\c3\b1o Code-First con renderizado visual interactivo (canvas.render).*\0a\0a**Uso:**\0a`/openmark <tema o idea>`\0a\0a**Ejemplos:**\0a\e2\80\a2 `/openmark 3 Curiosidades de los Dinosaurios`\0a\e2\80\a2 `/openmark Inteligencia Artificial en 2026`\0a\e2\80\a2 `/openmark 3 Claves de Crecimiento para Empresas`\0a\e2\80\a2 `/openmark H\c3\a1bitos Diarios de Alta Productividad`\0a")

  (func $copy_output (param $src_ptr i32) (param $len i32) (result i32)
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
        (return (call $copy_output (i32.const 29743) (i32.const 372)))
      )
    )

    ;; Default: violet
    (local.set $theme_offset (i32.const 27082))
    (local.set $theme_len (i32.const 2597))

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
                (local.set $theme_offset (i32.const 16384))
                (local.set $theme_len (i32.const 2627))
                (br $found)
              )
            )

            ;; 'fosi' = 102, 111, 115, 105
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 102) (i32.const 111) (i32.const 115) (i32.const 105))
              (then
                (local.set $theme_offset (i32.const 16384))
                (local.set $theme_len (i32.const 2627))
                (br $found)
              )
            )

            ;; 'inte' (inteligencia) = 105, 110, 116, 101
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 105) (i32.const 110) (i32.const 116) (i32.const 101))
              (then
                (local.set $theme_offset (i32.const 19075))
                (local.set $theme_len (i32.const 2628))
                (br $found)
              )
            )

            ;; 'tech' = 116, 101, 99, 104
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 116) (i32.const 101) (i32.const 99) (i32.const 104))
              (then
                (local.set $theme_offset (i32.const 19075))
                (local.set $theme_len (i32.const 2628))
                (br $found)
              )
            )

            ;; 'robo' (robot) = 114, 111, 98, 111
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 114) (i32.const 111) (i32.const 98) (i32.const 111))
              (then
                (local.set $theme_offset (i32.const 19075))
                (local.set $theme_len (i32.const 2628))
                (br $found)
              )
            )

            ;; 'crec' (crecimiento) = 99, 114, 101, 99
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 99) (i32.const 114) (i32.const 101) (i32.const 99))
              (then
                (local.set $theme_offset (i32.const 21767))
                (local.set $theme_len (i32.const 2602))
                (br $found)
              )
            )

            ;; 'nego' (negocio) = 110, 101, 103, 111
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 110) (i32.const 101) (i32.const 103) (i32.const 111))
              (then
                (local.set $theme_offset (i32.const 21767))
                (local.set $theme_len (i32.const 2602))
                (br $found)
              )
            )

            ;; 'vent' (ventas) = 118, 101, 110, 116
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 118) (i32.const 101) (i32.const 110) (i32.const 116))
              (then
                (local.set $theme_offset (i32.const 21767))
                (local.set $theme_len (i32.const 2602))
                (br $found)
              )
            )

            ;; 'salu' (salud) = 115, 97, 108, 117
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 115) (i32.const 97) (i32.const 108) (i32.const 117))
              (then
                (local.set $theme_offset (i32.const 24433))
                (local.set $theme_len (i32.const 2585))
                (br $found)
              )
            )

            ;; 'verd' (verde) = 118, 101, 114, 100
            (if (call $match4 (local.get $in_ptr) (local.get $i) (i32.const 118) (i32.const 101) (i32.const 114) (i32.const 100))
              (then
                (local.set $theme_offset (i32.const 24433))
                (local.set $theme_len (i32.const 2585))
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
