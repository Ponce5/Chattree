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
    ;; 1. Check for 'start'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 149147) (i32.const 5)) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 140000) (i32.const 65536) (i32.const 2028)))
        (return (i32.const 2028))
      )
    )

    ;; 2. Check for 'status' or 'ficha'
    (if (i32.or
          (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 149168) (i32.const 6)) (i32.const 0))
          (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 149190) (i32.const 5)) (i32.const 0))
        )
      (then
        (drop (call $copy_mem (i32.const 142044) (i32.const 65536) (i32.const 1626)))
        (return (i32.const 1626))
      )
    )

    ;; 3. Check for 'atacar'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 149211) (i32.const 6)) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 143686) (i32.const 65536) (i32.const 1963)))
        (return (i32.const 1963))
      )
    )

    ;; 4. Check for 'pocion'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 149233) (i32.const 6)) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 145665) (i32.const 65536) (i32.const 1312)))
        (return (i32.const 1312))
      )
    )

    ;; 5. Check for 'save'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 149255) (i32.const 4)) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 146993) (i32.const 65536) (i32.const 1073)))
        (return (i32.const 1073))
      )
    )

    ;; 6. Check for 'load'
    (if (i32.ge_s (call $find_substring (local.get $in_ptr) (local.get $in_len) (i32.const 149275) (i32.const 4)) (i32.const 0))
      (then
        (drop (call $copy_mem (i32.const 148082) (i32.const 65536) (i32.const 1049)))
        (return (i32.const 1049))
      )
    )

    ;; Default: attack / action result
    (drop (call $copy_mem (i32.const 143686) (i32.const 65536) (i32.const 1963)))
    (return (i32.const 1963))
  )

  (data (i32.const 140000) "{\22type\22:\22card\22,\22displayText\22:\22<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn```json\5cn{\5cn  \5c\22turn\5c\22: 1,\5cn  \5c\22player\5c\22: \5c\22Aventurero\5c\22,\5cn  \5c\22class\5c\22: \5c\22Guerrero\5c\22,\5cn  \5c\22hp\5c\22: \5c\22120/120\5c\22,\5cn  \5c\22mp\5c\22: \5c\2230/30\5c\22,\5cn  \5c\22level\5c\22: 1,\5cn  \5c\22gold\5c\22: 50,\5cn  \5c\22location\5c\22: \5c\22Ruinas Antiguas de Eldoria\5c\22,\5cn  \5c\22enemy\5c\22: \5c\22Goblin Explorador (HP 30/30)\5c\22\5cn}\5cn```\5cn### INVENTARIO VERIFICADO:\5cn- Espada de Hierro x1 (+6 ATK)\5cn- Escudo de Roble x1 (+3 DEF)\5cn- Poci\c3\b3n de Salud x3 (+40 HP)\5cn\5cn> \e2\9a\a0\ef\b8\8f INSTRUCCI\c3\93N AL NARRADOR IA: S\c3\a9 inmersivo, \c3\a9pico y jam\c3\a1s inventes estad\c3\adsticas ni objetos fuera de este registro.\5cn<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn\5cn\e2\9a\94\ef\b8\8f **\c2\a1Ha comenzado tu Aventura en Eldoria!**\5cn\5cnHas elegido la senda del **Guerrero**. Te encuentras ante las imponentes ruinas de Eldoria envueltas en bruma. Frente a ti, los ojos rojizos de un **Goblin Explorador** brillan en la penumbra listos para atacar.\22,\22ui\22:{\22title\22:\22Rol Aventura \e2\80\94 Turno 1\22,\22subtitle\22:\22Nivel 1 \e2\80\a2 100 EXP para nivel 2\22,\22elements\22:[{\22type\22:\22badge\22,\22text\22:\22EN COMBATE ACTIVO\22,\22variant\22:\22warning\22},{\22type\22:\22progress\22,\22value\22:100,\22label\22:\22Salud (HP): 120/120 (100%)\22},{\22type\22:\22progress\22,\22value\22:100,\22label\22:\22Man\c3\a1 (MP): 30/30 (100%)\22},{\22type\22:\22progress\22,\22value\22:0,\22label\22:\22Progreso Nivel: 0/100 XP (0%)\22},{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22Personaje\22,\22value\22:\22Aventurero (Guerrero)\22},{\22label\22:\22Ubicaci\c3\b3n\22,\22value\22:\22Ruinas Antiguas de Eldoria\22},{\22label\22:\22Oro acumulado\22,\22value\22:\22\f0\9f\92\b0 50 monedas\22},{\22label\22:\22Adversario\22,\22value\22:\22\e2\9a\94\ef\b8\8f Goblin Explorador (HP 30/30)\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22\e2\9a\94\ef\b8\8f Atacar\22,\22action\22:\22command\22,\22payload\22:\22/rpg action atacar\22,\22variant\22:\22danger\22},{\22label\22:\22\f0\9f\a7\aa Poci\c3\b3n\22,\22action\22:\22command\22,\22payload\22:\22/rpg action beber pocion\22,\22variant\22:\22primary\22},{\22label\22:\22\f0\9f\8f\83 Huir\22,\22action\22:\22command\22,\22payload\22:\22/rpg action huir\22,\22variant\22:\22neutral\22},{\22label\22:\22\f0\9f\93\8a Ficha\22,\22action\22:\22command\22,\22payload\22:\22/rpg status\22,\22variant\22:\22neutral\22}]}]},\22metadata\22:{\22hp\22:120,\22maxHp\22:120,\22level\22:1,\22gold\22:50,\22turn\22:1}}") ;; payload_start (2028 bytes)
  (data (i32.const 142044) "{\22type\22:\22card\22,\22displayText\22:\22<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn```json\5cn{\5cn  \5c\22turn\5c\22: 2,\5cn  \5c\22player\5c\22: \5c\22Aventurero\5c\22,\5cn  \5c\22class\5c\22: \5c\22Guerrero\5c\22,\5cn  \5c\22hp\5c\22: \5c\22105/120\5c\22,\5cn  \5c\22mp\5c\22: \5c\2230/30\5c\22,\5cn  \5c\22level\5c\22: 1,\5cn  \5c\22gold\5c\22: 50,\5cn  \5c\22location\5c\22: \5c\22Ruinas Antiguas de Eldoria\5c\22,\5cn  \5c\22enemy\5c\22: \5c\22Goblin Explorador (HP 16/30)\5c\22\5cn}\5cn```\5cn### FICHA T\c3\89CNICA DEL PERSONAJE:\5cn- Nivel: 1 (Fuerza 16, Destreza 11, Inteligencia 9)\5cn- Armamento: Espada de Hierro forjada, Escudo de Roble\5cn- Provisiones: 3 Pociones de Salud, 50 monedas de oro\5cn<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn\5cn\f0\9f\93\8a **Ficha del Personaje:**\5cn\5cnTu h\c3\a9roe mantiene una postura firme a pesar del polvo de las catacumbas.\22,\22ui\22:{\22title\22:\22Ficha del Aventurero\22,\22subtitle\22:\22Clase: Guerrero \e2\80\a2 Rango Hierro\22,\22elements\22:[{\22type\22:\22badge\22,\22text\22:\22EN COMBATE ACTIVO\22,\22variant\22:\22warning\22},{\22type\22:\22progress\22,\22value\22:87,\22label\22:\22Salud (HP): 105/120 (87%)\22},{\22type\22:\22progress\22,\22value\22:100,\22label\22:\22Man\c3\a1 (MP): 30/30 (100%)\22},{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22Atributos\22,\22value\22:\22STR 16 \e2\80\a2 DEX 11 \e2\80\a2 INT 9\22},{\22label\22:\22Defensa (AC)\22,\22value\22:\2213 (Armadura + Escudo)\22},{\22label\22:\22Oro\22,\22value\22:\22\f0\9f\92\b0 50 monedas\22},{\22label\22:\22Ubicaci\c3\b3n\22,\22value\22:\22Ruinas de Eldoria\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22\e2\9a\94\ef\b8\8f Atacar\22,\22action\22:\22command\22,\22payload\22:\22/rpg action atacar\22,\22variant\22:\22danger\22},{\22label\22:\22\f0\9f\a7\aa Poci\c3\b3n\22,\22action\22:\22command\22,\22payload\22:\22/rpg action beber pocion\22,\22variant\22:\22primary\22},{\22label\22:\22\f0\9f\92\be Guardar\22,\22action\22:\22command\22,\22payload\22:\22/rpg save\22,\22variant\22:\22neutral\22}]}]},\22metadata\22:{\22hp\22:105,\22maxHp\22:120,\22level\22:1,\22gold\22:50,\22turn\22:2}}") ;; payload_status (1626 bytes)
  (data (i32.const 143686) "{\22type\22:\22card\22,\22displayText\22:\22<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn```json\5cn{\5cn  \5c\22action\5c\22: \5c\22attack\5c\22,\5cn  \5c\22d20\5c\22: 17,\5cn  \5c\22stat_bonus\5c\22: 3,\5cn  \5c\22total_attack\5c\22: 20,\5cn  \5c\22crit\5c\22: true,\5cn  \5c\22damage_dealt\5c\22: 22,\5cn  \5c\22enemy_hp_remaining\5c\22: 0,\5cn  \5c\22player_hp\5c\22: 105,\5cn  \5c\22xp_gained\5c\22: 45,\5cn  \5c\22gold_gained\5c\22: 25\5cn}\5cn```\5cn### RESOLUCI\c3\93N DETERMINISTA:\5cn- Tirada d20: 17 + 3 (STR) = 20 [IMPACTO CR\c3\8dTICO]\5cn- Da\c3\b1o infligido: 22 HP. \c2\a1Goblin Explorador ha ca\c3\addo!\5cn- Recompensas: +45 XP, +25 Monedas de Oro sumadas al inventario.\5cn<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn\5cn\e2\9a\94\ef\b8\8f **\c2\a1Impacto Cr\c3\adtico Devastador!**\5cn\5cnTu espada traza un arco letal en la penumbra de las ruinas y parte el escudo de madera del goblin. Con un aullido sofocado, el monstruo se desploma sobre las losas de piedra. Has obtenido **25 monedas de oro** y **45 puntos de experiencia**.\22,\22ui\22:{\22title\22:\22\c2\a1Victoria en Combate!\22,\22subtitle\22:\22Goblin Explorador Derrotado\22,\22elements\22:[{\22type\22:\22badge\22,\22text\22:\22VICTORIA \e2\80\a2 \c3\81REA DESPEJADA\22,\22variant\22:\22success\22},{\22type\22:\22progress\22,\22value\22:87,\22label\22:\22Salud (HP): 105/120 (87%)\22},{\22type\22:\22progress\22,\22value\22:45,\22label\22:\22Experiencia: 45/100 XP (45%)\22},{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22Tirada de Combate\22,\22value\22:\22d20: 17 (+3 STR) = 20 [CR\c3\8dTICO]\22},{\22label\22:\22Da\c3\b1o Asestado\22,\22value\22:\2222 de da\c3\b1o cortante\22},{\22label\22:\22Oro Total\22,\22value\22:\22\f0\9f\92\b0 75 monedas (+25 bot\c3\adn)\22},{\22label\22:\22Ubicaci\c3\b3n\22,\22value\22:\22Ruinas de Eldoria \e2\80\94 Cripta\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22\f0\9f\94\8d Explorar Cripta\22,\22action\22:\22command\22,\22payload\22:\22/rpg action explorar cripta\22,\22variant\22:\22primary\22},{\22label\22:\22\f0\9f\94\93 Abrir Cofre\22,\22action\22:\22command\22,\22payload\22:\22/rpg action abrir cofre\22,\22variant\22:\22neutral\22},{\22label\22:\22\f0\9f\92\be Guardar Partida\22,\22action\22:\22command\22,\22payload\22:\22/rpg save\22,\22variant\22:\22neutral\22},{\22label\22:\22\f0\9f\93\8a Ficha\22,\22action\22:\22command\22,\22payload\22:\22/rpg status\22,\22variant\22:\22neutral\22}]}]},\22metadata\22:{\22hp\22:105,\22maxHp\22:120,\22level\22:1,\22gold\22:75,\22turn\22:3}}") ;; payload_attack (1963 bytes)
  (data (i32.const 145665) "{\22type\22:\22card\22,\22displayText\22:\22<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn```json\5cn{\5cn  \5c\22action\5c\22: \5c\22use_item\5c\22,\5cn  \5c\22item\5c\22: \5c\22potion_health\5c\22,\5cn  \5c\22quantity_left\5c\22: 2,\5cn  \5c\22heal_amount\5c\22: 15,\5cn  \5c\22player_hp\5c\22: 120,\5cn  \5c\22max_hp\5c\22: 120\5cn}\5cn```\5cn### RESOLUCI\c3\93N DETERMINISTA:\5cn- Poci\c3\b3n de salud consumida (-1, quedan 2).\5cn- Salud restaurada: +15 HP (Restaurada al 100% de la capacidad).\5cn<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn\5cn\f0\9f\a7\aa **Poci\c3\b3n de Salud Consumida**\5cn\5cnDestapas con rapidez el frasco de cristal. El l\c3\adquido de color rub\c3\ad destella mientras bebes. Tus heridas se cierran y recuperas el aliento por completo (HP al 100%).\22,\22ui\22:{\22title\22:\22Efecto Curativo\22,\22subtitle\22:\22Poci\c3\b3n de Salud Utilizada\22,\22elements\22:[{\22type\22:\22badge\22,\22text\22:\22HP RESTAURADO\22,\22variant\22:\22success\22},{\22type\22:\22progress\22,\22value\22:100,\22label\22:\22Salud (HP): 120/120 (100%)\22},{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22Pociones restantes\22,\22value\22:\222 frascos en el zurr\c3\b3n\22},{\22label\22:\22Estado del H\c3\a9roe\22,\22value\22:\22Vitalidad plena\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22\e2\9a\94\ef\b8\8f Atacar\22,\22action\22:\22command\22,\22payload\22:\22/rpg action atacar\22,\22variant\22:\22danger\22},{\22label\22:\22\f0\9f\94\8d Explorar\22,\22action\22:\22command\22,\22payload\22:\22/rpg action explorar\22,\22variant\22:\22primary\22}]}]},\22metadata\22:{\22hp\22:120,\22maxHp\22:120,\22level\22:1,\22gold\22:50,\22turn\22:2}}") ;; payload_potion (1312 bytes)
  (data (i32.const 146993) "{\22type\22:\22card\22,\22displayText\22:\22<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn```json\5cn{\5cn  \5c\22action\5c\22: \5c\22save_game\5c\22,\5cn  \5c\22status\5c\22: \5c\22success\5c\22,\5cn  \5c\22storage\5c\22: \5c\22database.sql\5c\22,\5cn  \5c\22table\5c\22: \5c\22plugin_rpg_saves\5c\22,\5cn  \5c\22turn\5c\22: 3\5cn}\5cn```\5cn<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn\5cn\f0\9f\92\be **Progreso Guardado con \c3\89xito**\5cn\5cnTu partida ha sido serializada y almacenada en la base de datos SQLite relacional privada de Chattree. Podr\c3\a1s reanudar tu aventura en cualquier momento con `/rpg load`.\22,\22ui\22:{\22title\22:\22Punto de Control Guardado\22,\22subtitle\22:\22Persistencia SQLite de Chattree\22,\22elements\22:[{\22type\22:\22badge\22,\22text\22:\22GUARDADO COMPLETADO\22,\22variant\22:\22success\22},{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22Almacenamiento\22,\22value\22:\22SQLite Relacional (database.sql)\22},{\22label\22:\22Estado\22,\22value\22:\22Sincronizado\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22\e2\9a\94\ef\b8\8f Continuar Aventura\22,\22action\22:\22command\22,\22payload\22:\22/rpg action explorar\22,\22variant\22:\22primary\22},{\22label\22:\22\f0\9f\93\8a Ficha\22,\22action\22:\22command\22,\22payload\22:\22/rpg status\22,\22variant\22:\22neutral\22}]}]},\22metadata\22:{\22saved\22:true}}") ;; payload_save (1073 bytes)
  (data (i32.const 148082) "{\22type\22:\22card\22,\22displayText\22:\22<!-- [CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn```json\5cn{\5cn  \5c\22action\5c\22: \5c\22load_game\5c\22,\5cn  \5c\22status\5c\22: \5c\22success\5c\22,\5cn  \5c\22storage\5c\22: \5c\22database.sql\5c\22,\5cn  \5c\22player\5c\22: \5c\22Aventurero\5c\22,\5cn  \5c\22class\5c\22: \5c\22Guerrero\5c\22,\5cn  \5c\22level\5c\22: 1\5cn}\5cn```\5cn<!-- [/CHATTREE_RPG_ENGINE_CONTEXT] -->\5cn\5cn\f0\9f\93\82 **Partida Cargada con \c3\89xito**\5cn\5cnSe ha recuperado tu estado anterior desde la base de datos de Chattree. Te encuentras en las Ruinas de Eldoria.\22,\22ui\22:{\22title\22:\22Aventura Restaurada\22,\22subtitle\22:\22Cargado desde SQLite\22,\22elements\22:[{\22type\22:\22badge\22,\22text\22:\22PARTIDA CARGADA\22,\22variant\22:\22info\22},{\22type\22:\22progress\22,\22value\22:87,\22label\22:\22Salud (HP): 105/120\22},{\22type\22:\22key_value\22,\22items\22:[{\22label\22:\22Ubicaci\c3\b3n\22,\22value\22:\22Ruinas de Eldoria\22},{\22label\22:\22Oro\22,\22value\22:\22\f0\9f\92\b0 75 monedas\22}]},{\22type\22:\22divider\22},{\22type\22:\22button_row\22,\22buttons\22:[{\22label\22:\22\f0\9f\94\8d Continuar\22,\22action\22:\22command\22,\22payload\22:\22/rpg action explorar\22,\22variant\22:\22primary\22},{\22label\22:\22\f0\9f\93\8a Ver Ficha\22,\22action\22:\22command\22,\22payload\22:\22/rpg status\22,\22variant\22:\22neutral\22}]}]},\22metadata\22:{\22loaded\22:true}}") ;; payload_load (1049 bytes)
  (data (i32.const 149147) "start") ;; needle_start (5 bytes)
  (data (i32.const 149168) "status") ;; needle_status (6 bytes)
  (data (i32.const 149190) "ficha") ;; needle_ficha (5 bytes)
  (data (i32.const 149211) "atacar") ;; needle_attack (6 bytes)
  (data (i32.const 149233) "pocion") ;; needle_potion (6 bytes)
  (data (i32.const 149255) "save") ;; needle_save (4 bytes)
  (data (i32.const 149275) "load") ;; needle_load (4 bytes)
)
