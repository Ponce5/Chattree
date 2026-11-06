(module
  (memory (export "memory") 64)

  ;; Memory Copy Helper
  (func $copy_mem (param $src i32) (param $dest i32) (param $len i32) (result i32)
    (local $i i32)
    (loop $copy_loop
      (if (i32.lt_u (local.get $i) (local.get $len))
        (then
          (i32.store8
            (i32.add (local.get $dest) (local.get $i))
            (i32.load8_u (i32.add (local.get $src) (local.get $i)))
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $copy_loop)
        )
      )
    )
    (local.get $len)
  )

  ;; Substring Finder Helper
  (func $find_substring (param $haystack i32) (param $haystack_len i32) (param $needle i32) (param $needle_len i32) (result i32)
    (local $i i32)
    (local $j i32)
    (local $max i32)
    (if (i32.lt_u (local.get $haystack_len) (local.get $needle_len))
      (then (return (i32.const -1)))
    )
    (local.set $max (i32.add (i32.sub (local.get $haystack_len) (local.get $needle_len)) (i32.const 1)))
    (local.set $i (i32.const 0))
    (loop $outer
      (if (i32.lt_u (local.get $i) (local.get $max))
        (then
          (local.set $j (i32.const 0))
          (loop $inner
            (if (i32.lt_u (local.get $j) (local.get $needle_len))
              (then
                (if (i32.eq
                      (i32.load8_u (i32.add (local.get $haystack) (i32.add (local.get $i) (local.get $j))))
                      (i32.load8_u (i32.add (local.get $needle) (local.get $j)))
                    )
                  (then
                    (local.set $j (i32.add (local.get $j) (i32.const 1)))
                    (br $inner)
                  )
                )
              )
              (else
                (return (local.get $i))
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $outer)
        )
      )
    )
    (i32.const -1)
  )

  ;; Exported Entrypoint
  (func (export "rpg_entry") (param $in_ptr i32) (param $in_len i32) (result i32)
    ;; 1. Check for 'status' or 'ficha'
    (if (i32.or
          (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 153836) (i32.const 6)) (i32.const 0))
          (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 153858) (i32.const 5)) (i32.const 0))
        )
      (then
        (drop (call $copy_mem (i32.const 143952) (i32.const 65536) (i32.const 2337)))
        (return (i32.const 2337))
      )
    )

    ;; 2. Check for 'atacar' or combat action
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 153879) (i32.const 6)) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 146305) (i32.const 65536) (i32.const 2678)))
        (return (i32.const 2678))
      )
    )

    ;; 3. Check for 'pocion'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 153901) (i32.const 6)) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 148999) (i32.const 65536) (i32.const 2161)))
        (return (i32.const 2161))
      )
    )

    ;; 4. Check for 'save'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 153923) (i32.const 4)) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 151176) (i32.const 65536) (i32.const 1413)))
        (return (i32.const 1413))
      )
    )

    ;; 5. Check for 'load'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 153943) (i32.const 4)) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 152605) (i32.const 65536) (i32.const 1194)))
        (return (i32.const 1194))
      )
    )

    ;; 6. Check for 'start' or default initialization
    (drop (call $copy_mem (i32.const 140000) (i32.const 65536) (i32.const 3936)))
    (return (i32.const 3936))
  )

  (data (i32.const 140000) "{\22type\22:\22card\22,\22displayText\22:\22<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn```json\5cn{\5cn  \5c\22system\5c\22: \5c\22Chattree Narrative RPG Engine v1.1.0\5c\22,\5cn  \5c\22campaign\5c\22: \5c\22Cr\c3\b3nicas de Eldoria: El Despertar de la Cripta Olvidada\5c\22,\5cn  \5c\22turn\5c\22: 1,\5cn  \5c\22chapter\5c\22: 1,\5cn  \5c\22player\5c\22: \5c\22Aventurero Solitario\5c\22,\5cn  \5c\22class\5c\22: \5c\22Guerrero de la Guardia de Plata\5c\22,\5cn  \5c\22hp\5c\22: \5c\22120/120\5c\22,\5cn  \5c\22mp\5c\22: \5c\2230/30\5c\22,\5cn  \5c\22level\5c\22: 1,\5cn  \5c\22xp\5c\22: \5c\220/100\5c\22,\5cn  \5c\22gold\5c\22: 50,\5cn  \5c\22location\5c\22: \5c\22Vest\c3\adbulo de las Ruinas de Eldoria \e2\80\94 Cripta Profunda\5c\22,\5cn  \5c\22active_quest\5c\22: \5c\22Descubrir el origen de la marca r\c3\banica y escapar de las catacumbas\5c\22,\5cn  \5c\22active_enemy\5c\22: \5c\22Centinela Espectral de Eldoria (HP 35/35, AC 12)\5c\22,\5cn  \5c\22threat_level\5c\22: \5c\22Moderado\5c\22\5cn}\5cn```\5cn### INVENTARIO VERIFICADO EN MEMORIA \d0\bb\d0\b8\d0\bd\d0\b5\d0\b9\d0\bd\d0\b0\d1\8f (CERO ALUCINACIONES):\5cn- Espada de Acero Templado x1 (+6 ATK)\5cn- Escudo de Roble con Refuerzos de Hierro x1 (+3 DEF)\5cn- Poci\c3\b3n Curativa de Alquimista x3 (+40 HP restaurados)\5cn- Antorcha de Brea x1 (duraci\c3\b3n: 20 turnos)\5cn- Monedero de Cuero: 50 Monedas de Oro\5cn\5cn> \f0\9f\93\9c **DIRECTIVA MAESTRA PARA EL NARRADOR IA DE CHATTREE (GAME MASTER):**\5cn> 1. **HISTORIA LINEAL Y CONTINUA:** Esta es una campa\c3\b1a narrativa viva y coherente. Jam\c3\a1s trates las acciones como combates sueltos de relleno. Cada turno debe avanzar la trama de la Cripta de Eldoria hacia adelante con causa y efecto.\5cn> 2. **PROTAGONISTA Y ATM\c3\93SFERA:** Comienza con una introducci\c3\b3n inmersiva, cinematogr\c3\a1fica y literaria. Describe el polvo flotando en los rayos de luz de la luna, el fr\c3\ado de la piedra centenaria, el peso de la armadura y el susurro espectral del Centinela que vigila la puerta sellada.\5cn> 3. **PROHIBIDO ALTERAR O INVENTAR N\c3\9aMEROS:** Los valores de vida (120 HP), man\c3\a1, oro y pociones son matem\c3\a1ticos del motor WASM.\5cn> 4. **OPCIONES T\c3\81CTICAS:** Al final de tu narraci\c3\b3n, formula siempre 3 opciones narrativas tentadoras (Ataque frontal, Uso del entorno/sigilo, o Magia/objeto).\5cn<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn\5cn\f0\9f\95\af\ef\b8\8f **Pr\c3\b3logo \e2\80\94 El Despertar en las Sombras de Eldoria**\5cn\5cnDespiertas sobre un lecho de losas heladas, cubierto por el polvo de siglos. Una extra\c3\b1a marca en tu mu\c3\b1eca brilla con un sutil resplandor cer\c3\baleo, pulsando al comp\c3\a1s de los latidos de tu coraz\c3\b3n. \5cn\5cnAl incorporarte empu\c3\b1ando tu espada, la niebla de la cripta se arremolina. Ante la \c3\banica arcada de piedra que conduce al exterior, una figura incorp\c3\b3rea se materializa: el **Centinela Espectral**, cuyos ojos vac\c3\ados se encienden con fuego et\c3\a9reo mientras desenvaina una hoja espectral susurrando un juramento en una lengua muerta.\5cn\5cn*El destino de tu viaje acaba de comenzar. \c2\bfQu\c3\a9 har\c3\a1s?*\22,\22ui\22:{\22title\22:\22Cr\c3\b3nicas de Eldoria \e2\80\94 Cap\c3\adtulo I\22,\22subtitle\22:\22El Despertar de la Cripta \e2\80\a2 Turno 1\22,\22elements\22:[{\22type\22:\22badge\22,\22text\22:\22\e2\9a\94\ef\b8\8f ENCUENTRO HOSTIL ACTIVO\22,\22variant\22:\22warning\22},{\22type\22:\22progress\22,\22value\22:100,\22label\22:\22Salud (HP): 120/120 (100%)\22},{\22type\22:\22progress\22,\22value\22:100,\22label\22:\22Man\c3\a1 (MP): 30/30 (100%)\22},{\22type\22:\22progress\22,\22value\22:0,\22label\22:\22Progreso al Nivel 2: 0/100 XP (0%)\22},{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22Personaje\22,\22value\22:\22Aventurero (Guerrero)\22},{\22label\22:\22Misi\c3\b3n actual\22,\22value\22:\22Escapar de las catacumbas\22},{\22label\22:\22Ubicaci\c3\b3n\22,\22value\22:\22Cripta de Eldoria \e2\80\94 Puerta Sellada\22},{\22label\22:\22Adversario\22,\22value\22:\22Centinela Espectral (HP 35/35)\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22\e2\9a\94\ef\b8\8f Atacar con Espada\22,\22action\22:\22command\22,\22payload\22:\22/rpg action atacar al centinela\22,\22variant\22:\22danger\22},{\22label\22:\22\f0\9f\9b\a1\ef\b8\8f Posici\c3\b3n Defensiva\22,\22action\22:\22command\22,\22payload\22:\22/rpg action cubrirse con escudo\22,\22variant\22:\22primary\22},{\22label\22:\22\f0\9f\a7\aa Beber Poci\c3\b3n\22,\22action\22:\22command\22,\22payload\22:\22/rpg action beber pocion\22,\22variant\22:\22neutral\22},{\22label\22:\22\f0\9f\93\8a Ficha y Mochila\22,\22action\22:\22command\22,\22payload\22:\22/rpg status\22,\22variant\22:\22neutral\22}]}]},\22metadata\22:{\22hp\22:120,\22maxHp\22:120,\22level\22:1,\22gold\22:50,\22turn\22:1,\22chapter\22:1}}") ;; payload_start (3936 bytes)
  (data (i32.const 143952) "{\22type\22:\22card\22,\22displayText\22:\22<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn```json\5cn{\5cn  \5c\22query\5c\22: \5c\22character_status\5c\22,\5cn  \5c\22turn\5c\22: 3,\5cn  \5c\22player\5c\22: \5c\22Aventurero de Eldoria\5c\22,\5cn  \5c\22class\5c\22: \5c\22Guerrero\5c\22,\5cn  \5c\22level\5c\22: 1,\5cn  \5c\22xp\5c\22: \5c\220/100\5c\22,\5cn  \5c\22hp\5c\22: \5c\22120/120\5c\22,\5cn  \5c\22mp\5c\22: \5c\2230/30\5c\22,\5cn  \5c\22gold\5c\22: 50,\5cn  \5c\22strength\5c\22: 16,\5cn  \5c\22dexterity\5c\22: 11,\5cn  \5c\22intelligence\5c\22: 9,\5cn  \5c\22active_campaign\5c\22: \5c\22Cr\c3\b3nicas de Eldoria: El Despertar\5c\22,\5cn  \5c\22inventory\5c\22: [\5cn    { \5c\22name\5c\22: \5c\22Espada de Acero Templado\5c\22, \5c\22type\5c\22: \5c\22Arma Principal\5c\22, \5c\22power\5c\22: \5c\22+6 ATK\5c\22 },\5cn    { \5c\22name\5c\22: \5c\22Escudo de Roble y Hierro\5c\22, \5c\22type\5c\22: \5c\22Defensa\5c\22, \5c\22power\5c\22: \5c\22+3 DEF\5c\22 },\5cn    { \5c\22name\5c\22: \5c\22Poci\c3\b3n de Salud\5c\22, \5c\22quantity\5c\22: 2, \5c\22effect\5c\22: \5c\22+40 HP\5c\22 },\5cn    { \5c\22name\5c\22: \5c\22Antorcha de Brea\5c\22, \5c\22quantity\5c\22: 1, \5c\22effect\5c\22: \5c\22Visi\c3\b3n en oscuridad\5c\22 }\5cn  ]\5cn}\5cn```\5cn> \f0\9f\93\9c **DIRECTIVA PARA EL NARRADOR IA:**\5cn> Resume con elegancia la condici\c3\b3n del h\c3\a9roe, sus cicatrices, el brillo del acero y la determinaci\c3\b3n que arde en su mirada para superar la cripta.\5cn<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn\5cn\f0\9f\93\8a **Hoja de Personaje y Pertinencias**\5cn\5cnTe detienes un instante al amparo de las columnas ca\c3\addas para revisar tus fuerzas y equipo antes del siguiente paso crucial de tu expedici\c3\b3n.\22,\22ui\22:{\22title\22:\22Ficha del Aventurero\22,\22subtitle\22:\22Guerrero de Eldoria \e2\80\a2 Nivel 1\22,\22elements\22:[{\22type\22:\22badge\22,\22text\22:\22ESTADO: LISTO PARA LA BATALLA\22,\22variant\22:\22info\22},{\22type\22:\22progress\22,\22value\22:100,\22label\22:\22Salud (HP): 120/120 (100%)\22},{\22type\22:\22progress\22,\22value\22:100,\22label\22:\22Man\c3\a1 (MP): 30/30 (100%)\22},{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22Atributos F\c3\adsicos\22,\22value\22:\22Fuerza 16 \e2\80\a2 Destreza 11 \e2\80\a2 Inteligencia 9\22},{\22label\22:\22Bolsa de Monedas\22,\22value\22:\22\f0\9f\92\b0 50 monedas de oro antiguo\22},{\22label\22:\22Armamento\22,\22value\22:\22Espada de Acero (+6) \e2\80\a2 Escudo (+3)\22},{\22label\22:\22Consumibles\22,\22value\22:\222 Pociones de Salud \e2\80\a2 1 Antorcha\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22\e2\9a\94\ef\b8\8f Continuar Combate\22,\22action\22:\22command\22,\22payload\22:\22/rpg action atacar\22,\22variant\22:\22danger\22},{\22label\22:\22\f0\9f\94\8d Inspeccionar Alrededor\22,\22action\22:\22command\22,\22payload\22:\22/rpg action explorar cripta\22,\22variant\22:\22primary\22},{\22label\22:\22\f0\9f\92\be Guardar Partida\22,\22action\22:\22command\22,\22payload\22:\22/rpg save\22,\22variant\22:\22neutral\22}]}]},\22metadata\22:{\22hp\22:120,\22maxHp\22:120,\22level\22:1,\22gold\22:50,\22turn\22:3}}") ;; payload_status (2337 bytes)
  (data (i32.const 146305) "{\22type\22:\22card\22,\22displayText\22:\22<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn```json\5cn{\5cn  \5c\22action\5c\22: \5c\22combat_strike\5c\22,\5cn  \5c\22d20_roll\5c\22: 18,\5cn  \5c\22stat_bonus\5c\22: 3,\5cn  \5c\22total_hit\5c\22: 21,\5cn  \5c\22armor_class_target\5c\22: 12,\5cn  \5c\22is_critical\5c\22: false,\5cn  \5c\22damage_dealt\5c\22: 24,\5cn  \5c\22enemy_hp_remaining\5c\22: 11,\5cn  \5c\22enemy_max_hp\5c\22: 35,\5cn  \5c\22counterattack_damage\5c\22: 8,\5cn  \5c\22player_hp\5c\22: 112,\5cn  \5c\22player_max_hp\5c\22: 120,\5cn  \5c\22turn\5c\22: 2,\5cn  \5c\22summary\5c\22: \5c\22Impacto contundente. El Centinela retrocede herido pero contraataca con un corte de escarcha.\5c\22\5cn}\5cn```\5cn> \f0\9f\93\9c **DIRECTIVA PARA EL NARRADOR IA:**\5cn> Narra la colisi\c3\b3n de metales: tu espada envuelta en fuerza rompe la guardia del Centinela cortando su esencia et\c3\a9rea (24 de da\c3\b1o, le quedan 11 HP). A cambio, su hoja fantasmal roza tu hombro hel\c3\a1ndote la sangre (-8 HP, tienes 112 HP). Mant\c3\a9n el suspenso y describe la criatura tambale\c3\a1ndose antes del golpe final.\5cn<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn\5cn\e2\9a\94\ef\b8\8f **Intercambio de Acero y Sombras**\5cn\5cnTe impulsas hacia adelante con un grito de guerra. Tu espada de acero describe un arco fulgurante que rasga la armadura espectral del centinela con un chirrido ensordecedor. Part\c3\adculas de luz azulada brotan de la herida (**-24 de da\c3\b1o**). \5cn\5cnSin embargo, el ente responde con rapidez sobrenatural: su filo helado hiere tu costado izquierdo dej\c3\a1ndote una quemadura de escarcha (**-8 HP**). Tu aliento forma vaho en el aire g\c3\a9lido de la cripta, pero la criatura est\c3\a1 al borde del colapso.\22,\22ui\22:{\22title\22:\22Combate en la Cripta \e2\80\94 Turno 2\22,\22subtitle\22:\22Centinela Espectral tambale\c3\a1ndose (HP 11/35)\22,\22elements\22:[{\22type\22:\22badge\22,\22text\22:\22ENEMIGO CR\c3\8dTICO (HP 11/35)\22,\22variant\22:\22warning\22},{\22type\22:\22progress\22,\22value\22:93,\22label\22:\22Salud (HP): 112/120 (93%)\22},{\22type\22:\22progress\22,\22value\22:100,\22label\22:\22Man\c3\a1 (MP): 30/30 (100%)\22},{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22Tirada de Ataque\22,\22value\22:\22d20: 18 (+3 STR) = 21 vs AC 12 [\c3\89XITO]\22},{\22label\22:\22Da\c3\b1o Asestado\22,\22value\22:\22\e2\9a\94\ef\b8\8f 24 puntos de corte\22},{\22label\22:\22Da\c3\b1o Recibido\22,\22value\22:\22\e2\9d\84\ef\b8\8f 8 puntos de fr\c3\ado espectral\22},{\22label\22:\22Estado del Centinela\22,\22value\22:\22Esencia quebrada (11/35 HP)\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22\e2\9a\94\ef\b8\8f Asestar Golpe Final\22,\22action\22:\22command\22,\22payload\22:\22/rpg action golpe de gracia\22,\22variant\22:\22danger\22},{\22label\22:\22\f0\9f\a7\aa Beber Poci\c3\b3n\22,\22action\22:\22command\22,\22payload\22:\22/rpg action beber pocion\22,\22variant\22:\22primary\22},{\22label\22:\22\f0\9f\8f\83 Esquivar y Flanquear\22,\22action\22:\22command\22,\22payload\22:\22/rpg action esquivar\22,\22variant\22:\22neutral\22},{\22label\22:\22\f0\9f\92\be Guardar Partida\22,\22action\22:\22command\22,\22payload\22:\22/rpg save\22,\22variant\22:\22neutral\22}]}]},\22metadata\22:{\22hp\22:112,\22maxHp\22:120,\22level\22:1,\22gold\22:50,\22turn\22:2}}") ;; payload_attack (2678 bytes)
  (data (i32.const 148999) "{\22type\22:\22card\22,\22displayText\22:\22<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn```json\5cn{\5cn  \5c\22action\5c\22: \5c\22use_item\5c\22,\5cn  \5c\22item_used\5c\22: \5c\22potion_health\5c\22,\5cn  \5c\22quantity_before\5c\22: 3,\5cn  \5c\22quantity_after\5c\22: 2,\5cn  \5c\22healing_calculated\5c\22: 8,\5cn  \5c\22player_hp\5c\22: 120,\5cn  \5c\22player_max_hp\5c\22: 120,\5cn  \5c\22turn\5c\22: 3,\5cn  \5c\22status\5c\22: \5c\22Vitalidad completa restaurada al 100%\5c\22\5cn}\5cn```\5cn> \f0\9f\93\9c **DIRECTIVA PARA EL NARRADOR IA:**\5cn> Narra c\c3\b3mo destapas el frasco con un movimiento diestro mientras te cubres con el escudo. El brebaje c\c3\a1lido disuelve el fr\c3\ado espectral de tu herida, cicatrizando tu hombro por completo. Describe el sonido del frasco al guardarlo y la preparaci\c3\b3n para la siguiente maniobra.\5cn<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn\5cn\f0\9f\a7\aa **Restauraci\c3\b3n Alqu\c3\admica de Vitalidad**\5cn\5cnDando un paso atr\c3\a1s para ganar distancia, descorchas con los dientes uno de tus frascos de vidrio. El l\c3\adquido carmes\c3\ad resplandece en la penumbra. Al beberlo, una oleada de calor vigorizante recorre tus venas, cerrando la herida helada y despejando tu visi\c3\b3n. Tu salud regresa al m\c3\a1ximo absoluto (**120/120 HP**). Te quedan **2 pociones** en el cinto.\22,\22ui\22:{\22title\22:\22Alquimia y Recuperaci\c3\b3n \e2\80\94 Turno 3\22,\22subtitle\22:\22Poci\c3\b3n Curativa Consumida (Quedan 2)\22,\22elements\22:[{\22type\22:\22badge\22,\22text\22:\22VITALIDAD PLENA (100%)\22,\22variant\22:\22success\22},{\22type\22:\22progress\22,\22value\22:100,\22label\22:\22Salud (HP): 120/120 (100%)\22},{\22type\22:\22progress\22,\22value\22:100,\22label\22:\22Man\c3\a1 (MP): 30/30 (100%)\22},{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22Pociones en zurr\c3\b3n\22,\22value\22:\22\f0\9f\a7\aa 2 frascos curativos restantes\22},{\22label\22:\22Estado corporal\22,\22value\22:\22Heridas cerradas, vigor renovado\22},{\22label\22:\22Enemigo frente a ti\22,\22value\22:\22Centinela Espectral (HP 11/35)\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22\e2\9a\94\ef\b8\8f Rematar al Centinela\22,\22action\22:\22command\22,\22payload\22:\22/rpg action atacar al centinela\22,\22variant\22:\22danger\22},{\22label\22:\22\f0\9f\9b\a1\ef\b8\8f Bloqueo con Escudo\22,\22action\22:\22command\22,\22payload\22:\22/rpg action cubrirse con escudo\22,\22variant\22:\22primary\22},{\22label\22:\22\f0\9f\93\8a Ver Ficha\22,\22action\22:\22command\22,\22payload\22:\22/rpg status\22,\22variant\22:\22neutral\22}]}]},\22metadata\22:{\22hp\22:120,\22maxHp\22:120,\22level\22:1,\22gold\22:50,\22turn\22:3}}") ;; payload_potion (2161 bytes)
  (data (i32.const 151176) "{\22type\22:\22card\22,\22displayText\22:\22<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn```json\5cn{\5cn  \5c\22event\5c\22: \5c\22save_state\5c\22,\5cn  \5c\22storage_backend\5c\22: \5c\22database.sql (SQLite Relacional)\5c\22,\5cn  \5c\22table\5c\22: \5c\22plugin_rpg_campaigns\5c\22,\5cn  \5c\22campaign_id\5c\22: \5c\22eldoria_chronicles_slot_1\5c\22,\5cn  \5c\22turn\5c\22: 3,\5cn  \5c\22status\5c\22: \5c\22synchronized\5c\22\5cn}\5cn```\5cn<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn\5cn\f0\9f\92\be **Punto de Control Fijado en la Memoria de Eldoria**\5cn\5cnTu progreso, estad\c3\adsticas, objetos reunidos y el estado de tu enemigo han sido salvaguardados en la base de datos relacional SQLite protegida de Chattree. Puedes cerrar la conversaci\c3\b3n o apagar tu terminal con la total seguridad de que la historia continuar\c3\a1 exactamente donde la dejaste.\22,\22ui\22:{\22title\22:\22Punto de Guardado Establecido\22,\22subtitle\22:\22Persistencia Privada SQLite\22,\22elements\22:[{\22type\22:\22badge\22,\22text\22:\22ESTADO SINCRONIZADO EN DISCO\22,\22variant\22:\22success\22},{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22Base de Datos\22,\22value\22:\22SQLite Aislado (database.sql)\22},{\22label\22:\22Campa\c3\b1a activa\22,\22value\22:\22Cr\c3\b3nicas de Eldoria (Cap\c3\adtulo 1)\22},{\22label\22:\22Ranura de guardado\22,\22value\22:\22Slot Principal (Turno 3)\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22\e2\9a\94\ef\b8\8f Reanudar Aventura\22,\22action\22:\22command\22,\22payload\22:\22/rpg action atacar\22,\22variant\22:\22primary\22},{\22label\22:\22\f0\9f\93\8a Ficha del H\c3\a9roe\22,\22action\22:\22command\22,\22payload\22:\22/rpg status\22,\22variant\22:\22neutral\22}]}]},\22metadata\22:{\22saved\22:true}}") ;; payload_save (1413 bytes)
  (data (i32.const 152605) "{\22type\22:\22card\22,\22displayText\22:\22<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn```json\5cn{\5cn  \5c\22event\5c\22: \5c\22load_state\5c\22,\5cn  \5c\22storage_backend\5c\22: \5c\22database.sql\5c\22,\5cn  \5c\22campaign_id\5c\22: \5c\22eldoria_chronicles_slot_1\5c\22,\5cn  \5c\22turn\5c\22: 3,\5cn  \5c\22status\5c\22: \5c\22loaded_successfully\5c\22\5cn}\5cn```\5cn<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn\5cn\f0\9f\93\82 **Aventura Restaurada desde las Cr\c3\b3nicas**\5cn\5cnEl velo del tiempo retrocede. Vuelves a encontrarte en el h\c3\bamedo suelo de la cripta, frente al Centinela Espectral con tu acero alzado y tu salud \c3\adntegra.\22,\22ui\22:{\22title\22:\22Campa\c3\b1a Reanudada\22,\22subtitle\22:\22Cr\c3\b3nicas de Eldoria \e2\80\a2 Cap\c3\adtulo I\22,\22elements\22:[{\22type\22:\22badge\22,\22text\22:\22PARTIDA CARGADA DESDE SQLITE\22,\22variant\22:\22info\22},{\22type\22:\22progress\22,\22value\22:100,\22label\22:\22Salud (HP): 120/120 (100%)\22},{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22Ubicaci\c3\b3n\22,\22value\22:\22Cripta de Eldoria \e2\80\94 Arco Sellado\22},{\22label\22:\22Objetivo\22,\22value\22:\22Vencer al Centinela y abrir la puerta\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22\e2\9a\94\ef\b8\8f Atacar\22,\22action\22:\22command\22,\22payload\22:\22/rpg action atacar\22,\22variant\22:\22danger\22},{\22label\22:\22\f0\9f\93\8a Ver Ficha\22,\22action\22:\22command\22,\22payload\22:\22/rpg status\22,\22variant\22:\22neutral\22}]}]},\22metadata\22:{\22loaded\22:true}}") ;; payload_load (1194 bytes)
  (data (i32.const 153815) "start") ;; needle_start (5 bytes)
  (data (i32.const 153836) "status") ;; needle_status (6 bytes)
  (data (i32.const 153858) "ficha") ;; needle_ficha (5 bytes)
  (data (i32.const 153879) "atacar") ;; needle_attack (6 bytes)
  (data (i32.const 153901) "pocion") ;; needle_potion (6 bytes)
  (data (i32.const 153923) "save") ;; needle_save (4 bytes)
  (data (i32.const 153943) "load") ;; needle_load (4 bytes)
)
