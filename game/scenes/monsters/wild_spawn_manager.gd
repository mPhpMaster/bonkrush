extends Node3D
## Scatters wild monsters across the terrain and handles battle resolution.

signal battle_won(wild_data: Dictionary, xp_gained: int, coins_gained: int)
signal catch_attempt(wild_data: Dictionary, success: bool)
signal sync_error(message: String)

const MONSTER_SCENE: PackedScene = preload("res://scenes/monsters/monster.tscn")
const CATCH_POPUP: PackedScene = preload("res://scenes/ui/catch_popup.tscn")

const SPAWN_CONFIGS: Array = [
	{"species_id": "emberling",  "level": 1, "pos": Vector3(18,  0,  16)},
	{"species_id": "leafkin",    "level": 1, "pos": Vector3(-18, 0,  16)},
	{"species_id": "aquafin",    "level": 1, "pos": Vector3(16,  0, -18)},
	{"species_id": "emberling",  "level": 2, "pos": Vector3(25,  0,  5)},
	{"species_id": "aquafin",    "level": 1, "pos": Vector3(-20, 0,  15)},
	{"species_id": "aquafin",    "level": 2, "pos": Vector3(-30, 0,  8)},
	{"species_id": "leafkin",    "level": 1, "pos": Vector3(0,   0,  25)},
	{"species_id": "leafkin",    "level": 3, "pos": Vector3(5,   0,  35)},
	{"species_id": "sparkit",    "level": 1, "pos": Vector3(30,  0, -15)},
	{"species_id": "sparkit",    "level": 2, "pos": Vector3(40,  0, -20)},
	{"species_id": "mindwisp",   "level": 1, "pos": Vector3(-15, 0, -20)},
	{"species_id": "mindwisp",   "level": 2, "pos": Vector3(-25, 0, -30)},
	{"species_id": "shadeclaw",  "level": 2, "pos": Vector3(-40, 0,  0)},
	{"species_id": "shadeclaw",  "level": 3, "pos": Vector3(-50, 0, -10)},
	{"species_id": "galehart",   "level": 1, "pos": Vector3(10,  0, -30)},
	{"species_id": "galehart",   "level": 2, "pos": Vector3(20,  0, -40)},
	{"species_id": "emberling",  "level": 3, "pos": Vector3(35,  0,  20)},
	{"species_id": "aquafin",    "level": 3, "pos": Vector3(-35, 0,  25)},
	{"species_id": "leafkin",    "level": 2, "pos": Vector3(-5,  0,  20)},
	{"species_id": "sparkit",    "level": 3, "pos": Vector3(45,  0, -5)},
	{"species_id": "mindwisp",   "level": 3, "pos": Vector3(-20, 0, -40)},
	{"species_id": "galehart",   "level": 3, "pos": Vector3(15,  0, -45)},
	{"species_id": "shadeclaw",  "level": 1, "pos": Vector3(-45, 0,  15)},
	{"species_id": "leafkin",    "level": 1, "pos": Vector3(22,   0,  28)},
	{"species_id": "aquafin",    "level": 1, "pos": Vector3(-10, 0,  30)},
	{"species_id": "emberling",  "level": 1, "pos": Vector3(20,  0,  15)},
	{"species_id": "sparkit",    "level": 1, "pos": Vector3(25,  0, -10)},
]

var _active_monsters: Array[Node] = []
var _pending_catch: Dictionary = {}
var _pending_battle: Dictionary = {}


func _ready() -> void:
	Api.response_ready.connect(_on_api_response)
	call_deferred("_spawn_all")


func _spawn_all() -> void:
	for cfg in SPAWN_CONFIGS:
		_spawn_monster(cfg)


func _spawn_monster(cfg: Dictionary) -> void:
	var m: CharacterBody3D = MONSTER_SCENE.instantiate()
	add_child(m)
	m.setup(cfg)
	var pos: Vector3 = cfg["pos"]
	if Vector2(pos.x, pos.z).length() < 14.0:
		var flat := Vector2(pos.x, pos.z)
		if flat.length() < 0.01:
			flat = Vector2(16, 8)
		else:
			flat = flat.normalized() * 16.0
		pos.x = flat.x
		pos.z = flat.y
	var world = get_parent()
	if world and world.has_method("get_ground_height"):
		var gy: float = world.get_ground_height(pos.x, pos.z)
		if is_finite(gy):
			pos.y = gy + 0.5
		else:
			pos.y = 0.5
	m.global_position = pos
	m.died.connect(_on_monster_died.bind(m, cfg))
	_active_monsters.append(m)


func _on_monster_died(_monster: Node, cfg: Dictionary) -> void:
	_active_monsters.erase(_monster)
	get_tree().create_timer(30.0).timeout.connect(_spawn_monster.bind(cfg))
	var active = GameState.get_active_monster()
	if active.is_empty():
		return
	var wild_level: int = cfg["level"]
	var wild_data := {"species_id": cfg["species_id"], "level": wild_level}
	if Auth.is_logged_in() and GameState.character_id != "":
		_pending_battle = {"monster_id": active["id"], "wild_data": wild_data, "cfg": cfg}
		Api.call_rpc("resolve_battle", "resolve_battle", {
			"p_character_id": GameState.character_id,
			"p_monster_id": active["id"],
			"p_wild_level": wild_level,
		})
	else:
		_apply_battle_rewards_local(active["id"], 15 + wild_level * 10, 5 + wild_level * 3, wild_data)


func _apply_battle_rewards_local(monster_id: String, xp_gain: int, coins_gain: int, wild_data: Dictionary) -> void:
	GameState.add_coins(coins_gain)
	GameState.apply_xp(monster_id, xp_gain)
	GameState.char_xp += xp_gain
	var xp_needed := 50 * GameState.char_level
	while GameState.char_xp >= xp_needed:
		GameState.char_xp -= xp_needed
		GameState.char_level += 1
		xp_needed = 50 * GameState.char_level
	Sfx.play_coin()
	if randf() < 0.25:
		_grant_local_item("potion")
		GameState.inventory_changed.emit()
	battle_won.emit(wild_data, xp_gain, coins_gain)
	GameState.register_battle_win()
	_try_catch_local(wild_data)


func _grant_local_item(item_id: String) -> void:
	for entry in GameState.inventory:
		if entry.get("item_id") == item_id:
			entry["qty"] = entry.get("qty", 0) + 1
			return
	GameState.inventory.append({"item_id": item_id, "name": "Potion", "qty": 1})


func _try_catch(wild_data: Dictionary) -> void:
	if Auth.is_logged_in() and GameState.character_id != "":
		_pending_catch = wild_data.duplicate()
		Api.call_rpc("attempt_catch_wild", "attempt_catch", {
			"p_species_id": wild_data["species_id"],
			"p_wild_level": wild_data["level"],
		})
	else:
		_try_catch_local(wild_data)


func _try_catch_local(wild_data: Dictionary) -> void:
	var species = SpeciesDB.get_species(wild_data["species_id"])
	if species.is_empty():
		return
	var chance := clampf(species.get("catch_rate", 0.5) - wild_data["level"] * 0.12, 0.05, 0.95)
	if randf() >= chance:
		Sfx.play_catch(false)
		catch_attempt.emit(wild_data, false)
		_show_catch_popup(wild_data, false)
		return
	_catch_local(wild_data)


func _catch_local(wild_data: Dictionary) -> void:
	var species_id: String = wild_data.get("species_id", "")
	for m in GameState.party + GameState.collection:
		if m.get("species_id", "") == species_id:
			GameState.add_coins(10)
			GameState.apply_xp_to_active(20)
			var dup_data := wild_data.duplicate()
			dup_data["already_caught"] = true
			catch_attempt.emit(dup_data, false)
			_show_catch_popup(dup_data, false)
			return
	var species = SpeciesDB.get_species(species_id)
	var lvl: int = wild_data.get("level", 1)
	var stats := SpeciesDB.calc_stats(species_id, lvl)
	var entry := {
		"id": "local_" + species_id + "_" + str(Time.get_ticks_msec()),
		"species_id": species_id,
		"species_name": species.get("name", "?"),
		"type": species.get("type", "fire"),
		"mesh_key": species.get("mesh_key", "skeleton_warrior"),
		"level": lvl, "xp": 0, "is_active": false, "slot": -1,
	}
	entry.merge(stats)
	entry["hp"] = entry["max_hp"]
	GameState.collection.append(entry)
	GameState.collection_changed.emit()
	Sfx.play_catch(true)
	catch_attempt.emit(wild_data, true)
	_show_catch_popup(wild_data, true)
	GameState.publish_score()


func _on_api_response(tag: String, data, error: String) -> void:
	if tag == "resolve_battle":
		var wild_data: Dictionary = _pending_battle.get("wild_data", {})
		var monster_id: String = _pending_battle.get("monster_id", "")
		if error != "":
			sync_error.emit("Battle sync failed: " + error)
			var lvl: int = wild_data.get("level", 1)
			_apply_battle_rewards_local(monster_id, 15 + lvl * 10, 5 + lvl * 3, wild_data)
		elif data is Dictionary:
			var xp_gain := int(data.get("xp_gain", 0))
			var coin_gain := int(data.get("coin_gain", 0))
			GameState.apply_battle_result_from_server(monster_id, data)
			Sfx.play_coin()
			if data.get("item_drop"):
				sync_error.emit("Found " + str(data["item_drop"]) + "!")
				_reload_inventory()
			battle_won.emit(wild_data, xp_gain, coin_gain)
			GameState.register_battle_win()
			_try_catch(wild_data)
		_pending_battle.clear()
		return

	if tag == "battle_inv_reload":
		if error == "" and data is Array:
			GameState.load_inventory_from_api(data)
		return

	if tag == "attempt_catch":
		var wild_data: Dictionary = _pending_catch.duplicate()
		_pending_catch.clear()
		if error != "":
			sync_error.emit("Catch sync failed: " + error)
			_try_catch_local(wild_data)
			return
		if not (data is Dictionary):
			return
		var result: String = data.get("result", "escaped")
		if result == "escaped":
			Sfx.play_catch(false)
			catch_attempt.emit(wild_data, false)
			_show_catch_popup(wild_data, false)
		elif result == "duplicate":
			wild_data["already_caught"] = true
			if data.has("coins"):
				GameState.coins = int(data["coins"])
				GameState.coins_changed.emit(GameState.coins)
			GameState.request_monster_reload()
			catch_attempt.emit(wild_data, false)
			_show_catch_popup(wild_data, false)
		elif result == "caught":
			var entry := GameState.build_monster_entry({
				"id": data.get("monster_id", ""),
				"species_id": data.get("species_id", wild_data.get("species_id", "")),
				"level": wild_data.get("level", 1),
				"xp": 0, "is_active": false, "slot": -1,
			})
			GameState.collection.append(entry)
			GameState.collection_changed.emit()
			Sfx.play_catch(true)
			catch_attempt.emit(wild_data, true)
			_show_catch_popup(wild_data, true)
			GameState.publish_score()
		return


func _show_catch_popup(wild_data: Dictionary, success: bool) -> void:
	var popup = CATCH_POPUP.instantiate()
	var hud = get_tree().get_first_node_in_group("hud")
	if hud:
		hud.add_child(popup)
	else:
		get_tree().current_scene.add_child(popup)
	popup.show_result(wild_data, success)


func _reload_inventory() -> void:
	if not Auth.is_logged_in() or GameState.character_id == "":
		return
	Api.select("inventory", "battle_inv_reload",
		"character_id=eq." + GameState.character_id + "&select=item_id,quantity,items(name)")
