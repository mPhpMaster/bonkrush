extends Node
## Central store for runtime game data (NOT persisted here; Supabase owns source of truth).

signal character_loaded
signal party_changed
signal coins_changed(new_amount: int)
signal collection_changed
signal inventory_changed

var kills_this_session: int = 0
var quest_target: int = 3
var tutorial_done: bool = false
var character_id: String = ""
var character_name: String = ""
var starter_type: String = ""
var char_level: int = 1
var char_xp: int = 0
var coins: int = 0
var last_pos: Vector3 = Vector3.ZERO

var party: Array = []
var active_slot: int = 0
var collection: Array = []
var inventory: Array = []

var _reload_scheduled: bool = false


func reset() -> void:
	character_id = ""
	character_name = ""
	starter_type = ""
	char_level = 1
	char_xp = 0
	coins = 0
	last_pos = Vector3.ZERO
	active_slot = 0
	kills_this_session = 0
	tutorial_done = false
	party.clear()
	collection.clear()
	inventory.clear()
	party_changed.emit()
	collection_changed.emit()
	inventory_changed.emit()


func _ready() -> void:
	Api.response_ready.connect(_on_api_response)
	character_loaded.connect(func(): publish_score())


func _on_api_response(tag: String, data, _error: String) -> void:
	if tag == "reload_party" and data is Array:
		party.clear()
		for raw in data:
			if int(raw.get("slot", 0)) >= 0:
				party.append(build_monster_entry(raw))
		party_changed.emit()
	elif tag == "reload_collection" and data is Array:
		collection.clear()
		for raw in data:
			if int(raw.get("slot", -1)) < 0:
				collection.append(build_monster_entry(raw))
		collection_changed.emit()


func request_monster_reload() -> void:
	if not Auth.is_logged_in() or character_id == "":
		return
	if _reload_scheduled:
		return
	_reload_scheduled = true
	call_deferred("_do_monster_reload")


func _do_monster_reload() -> void:
	_reload_scheduled = false
	if not Auth.is_logged_in() or character_id == "":
		return
	Api.select("player_monsters", "reload_party",
		"character_id=eq." + character_id + "&slot=gte.0&order=slot.asc")
	Api.select("player_monsters", "reload_collection",
		"character_id=eq." + character_id + "&slot=lt.0&order=created_at.asc")


func get_active_monster() -> Dictionary:
	for m in party:
		if m.get("is_active", false):
			return m
	if party.size() > 0:
		return party[0]
	return {}


func build_monster_entry(raw: Dictionary) -> Dictionary:
	var species := SpeciesDB.get_species(raw.get("species_id", ""))
	var lvl: int = raw.get("level", 1)
	var stats := SpeciesDB.calc_stats(raw.get("species_id", ""), lvl)
	var max_hp: int = stats.get("max_hp", 60)
	var entry := {
		"id":           raw.get("id", ""),
		"species_id":   raw.get("species_id", ""),
		"species_name": species.get("name", "?"),
		"type":         species.get("type", "fire"),
		"mesh_key":     species.get("mesh_key", "skeleton_warrior"),
		"level":        lvl,
		"xp":           raw.get("xp", 0),
		"max_hp":       max_hp,
		"attack":       stats.get("attack", 20),
		"defense":      stats.get("defense", 15),
		"speed":        stats.get("speed", 18),
		"is_active":    raw.get("is_active", false),
		"slot":         raw.get("slot", 0),
	}
	if raw.has("current_hp") and raw["current_hp"] != null:
		entry["hp"] = clampi(int(raw["current_hp"]), 0, max_hp)
	else:
		entry["hp"] = max_hp
	return entry


func set_active_monster(party_index: int) -> void:
	if party_index < 0 or party_index >= party.size():
		return
	active_slot = party_index
	for i in party.size():
		party[i]["is_active"] = (i == party_index)
	party_changed.emit()

	if Auth.is_logged_in() and character_id != "":
		var db_slot: int = party[party_index].get("slot", party_index)
		Api.call_rpc("set_active_monster", "set_active_monster", {
			"p_character_id": character_id,
			"p_slot":         db_slot,
		})


func sync_active_hp() -> void:
	var active := get_active_monster()
	if active.is_empty() or not Auth.is_logged_in():
		return
	Api.call_rpc("sync_monster_hp", "sync_hp", {
		"p_monster_id": active["id"],
		"p_current_hp": active.get("hp", 0),
	})


func add_coins(amount: int) -> void:
	coins += amount
	coins_changed.emit(coins)


func spend_coins(amount: int) -> bool:
	if coins < amount:
		return false
	coins -= amount
	coins_changed.emit(coins)
	return true


func apply_xp(monster_id: String, xp_gain: int) -> void:
	for m in party:
		if m["id"] == monster_id:
			m["xp"] = m.get("xp", 0) + xp_gain
			var xp_needed: int = 50 * int(m["level"])
			while m["xp"] >= xp_needed:
				m["xp"] -= xp_needed
				m["level"] += 1
				_recalc_stats(m)
				xp_needed = 50 * m["level"]
			party_changed.emit()
			return
	for m in collection:
		if m["id"] == monster_id:
			m["xp"] = m.get("xp", 0) + xp_gain
			var xp_needed: int = 50 * int(m["level"])
			while m["xp"] >= xp_needed:
				m["xp"] -= xp_needed
				m["level"] += 1
				_recalc_stats(m)
				xp_needed = 50 * m["level"]
			collection_changed.emit()
			return


func apply_xp_to_active(xp_gain: int) -> void:
	var active := get_active_monster()
	if not active.is_empty():
		apply_xp(active["id"], xp_gain)


func _recalc_stats(m: Dictionary) -> void:
	var stats := SpeciesDB.calc_stats(m.get("species_id", ""), m["level"])
	if stats.is_empty():
		return
	m.merge(stats)
	m["hp"] = m["max_hp"]


func register_battle_win() -> void:
	kills_this_session += 1
	party_changed.emit()
	publish_score()


func publish_score() -> void:
	if not Auth.is_logged_in() or character_id == "":
		return
	Api.call_rpc("publish_score", "publish_score", {
		"p_name": character_name,
		"p_level": char_level,
		"p_coins": coins,
		"p_kills": kills_this_session,
		"p_catches": collection.size(),
	})


func party_count() -> int:
	return party.size()


func is_quest_complete() -> bool:
	return kills_this_session >= quest_target


func try_swap_on_faint() -> bool:
	var fainted_idx := -1
	for i in party.size():
		if party[i].get("is_active", false):
			fainted_idx = i
			party[i]["hp"] = 0
			break
	if fainted_idx < 0:
		return false
	for i in party.size():
		if i == fainted_idx:
			continue
		if party[i].get("hp", 0) > 0:
			set_active_monster(i)
			return true
	return false


func apply_battle_result_from_server(monster_id: String, data: Dictionary) -> void:
	coins = int(data.get("coins", coins))
	char_xp = int(data.get("char_xp", char_xp))
	char_level = int(data.get("char_level", char_level))
	coins_changed.emit(coins)

	for m in party:
		if m["id"] == monster_id:
			var prev_hp: int = m.get("hp", 0)
			if data.has("monster_xp"):
				m["xp"] = int(data["monster_xp"])
			if data.has("monster_level"):
				var old_level: int = m.get("level", 1)
				m["level"] = int(data["monster_level"])
				if data.get("leveled_up", false) or m["level"] > old_level:
					_recalc_stats(m)
				else:
					var stats := SpeciesDB.calc_stats(m.get("species_id", ""), m["level"])
					if not stats.is_empty():
						m["max_hp"] = stats.get("max_hp", m.get("max_hp", 60))
						m["attack"] = stats.get("attack", m.get("attack", 20))
						m["defense"] = stats.get("defense", m.get("defense", 15))
						m["speed"] = stats.get("speed", m.get("speed", 18))
						m["hp"] = mini(prev_hp, m["max_hp"])
			party_changed.emit()
			return


func move_local_to_party(monster_id: String, slot: int) -> bool:
	if party.size() >= 4:
		return false
	var idx := -1
	for i in collection.size():
		if collection[i]["id"] == monster_id:
			idx = i
			break
	if idx < 0:
		return false
	var m: Dictionary = collection[idx]
	collection.remove_at(idx)
	m["slot"] = slot
	m["is_active"] = false
	party.append(m)
	party.sort_custom(func(a, b): return a.get("slot", 0) < b.get("slot", 0))
	party_changed.emit()
	collection_changed.emit()
	return true


func move_local_to_collection(monster_id: String) -> bool:
	var idx := -1
	for i in party.size():
		if party[i]["id"] == monster_id:
			idx = i
			break
	if idx < 0 or party.size() <= 1:
		return false
	var was_active: bool = party[idx].get("is_active", false)
	var m: Dictionary = party[idx]
	party.remove_at(idx)
	m["slot"] = -1
	m["is_active"] = false
	collection.append(m)
	if was_active and party.size() > 0:
		set_active_monster(0)
	party_changed.emit()
	collection_changed.emit()
	return true


func reload_monsters_from_api(party_rows: Array, collection_rows: Array) -> void:
	party.clear()
	for raw in party_rows:
		if int(raw.get("slot", 0)) >= 0:
			party.append(build_monster_entry(raw))
	collection.clear()
	for raw in collection_rows:
		if int(raw.get("slot", -1)) < 0:
			collection.append(build_monster_entry(raw))
	party_changed.emit()
	collection_changed.emit()


func load_inventory_from_api(rows: Array) -> void:
	inventory.clear()
	for row in rows:
		var item = row.get("items", {})
		inventory.append({
			"item_id": row.get("item_id", ""),
			"name":    item.get("name", "?"),
			"qty":     row.get("quantity", 0),
		})
	inventory_changed.emit()


func load_from_api_data(
	char_data: Dictionary,
	party_data: Array,
	collection_data: Array = []
) -> void:
	character_id   = char_data.get("id", "")
	character_name = char_data.get("name", "")
	starter_type   = char_data.get("starter_type", "")
	char_level     = char_data.get("level", 1)
	char_xp        = char_data.get("xp", 0)
	coins          = char_data.get("coins", 0)
	last_pos = Vector3(
		char_data.get("last_pos_x", 0.0),
		char_data.get("last_pos_y", 0.0),
		char_data.get("last_pos_z", 0.0)
	)
	if not last_pos.is_finite():
		last_pos = Vector3.ZERO

	party.clear()
	for raw in party_data:
		if int(raw.get("slot", 0)) < 0:
			continue
		party.append(build_monster_entry(raw))

	collection.clear()
	for raw in collection_data:
		if int(raw.get("slot", -1)) >= 0:
			continue
		collection.append(build_monster_entry(raw))

	party_changed.emit()
	collection_changed.emit()
	character_loaded.emit()
