extends Node
## Persists demo-mode progress to user://demo_save.json

const SAVE_PATH: String = "user://demo_save.json"

var demo_active: bool = false


func enter_demo_mode() -> void:
	demo_active = true


func exit_demo_mode() -> void:
	demo_active = false


func _ready() -> void:
	if not Auth.is_logged_in():
		GameState.party_changed.connect(_autosave)
		GameState.collection_changed.connect(_autosave)
		GameState.coins_changed.connect(func(_a): _autosave())
		GameState.character_loaded.connect(_autosave)


func _autosave(_a = null) -> void:
	if demo_active or not Auth.is_logged_in():
		save_now()


func clear_save() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.remove_absolute(SAVE_PATH)


func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)


func save_now() -> void:
	if Auth.is_logged_in() and not demo_active:
		return
	var data := {
		"character": {
			"id":           GameState.character_id,
			"name":         GameState.character_name,
			"starter_type": GameState.starter_type,
			"level":        GameState.char_level,
			"xp":           GameState.char_xp,
			"coins":        GameState.coins,
			"last_pos_x":   GameState.last_pos.x,
			"last_pos_y":   GameState.last_pos.y,
			"last_pos_z":   GameState.last_pos.z,
		},
		"party":              _serialize_monsters(GameState.party),
		"collection":         _serialize_monsters(GameState.collection),
		"inventory":          GameState.inventory.duplicate(true),
		"active_slot":        GameState.active_slot,
		"kills_this_session": GameState.kills_this_session,
		"quest_target":       GameState.quest_target,
		"tutorial_done":      GameState.tutorial_done,
	}
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data))


func load_into_game_state() -> bool:
	if not has_save():
		return false
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f == null:
		return false
	var json := JSON.new()
	if json.parse(f.get_as_text()) != OK:
		return false
	var data: Dictionary = json.get_data()
	if not data.has("character"):
		return false

	var char_data: Dictionary = data["character"]
	var party_data: Array = data.get("party", [])
	var collection_data: Array = data.get("collection", [])
	GameState.load_from_api_data(char_data, party_data, collection_data)
	GameState.inventory = data.get("inventory", [])
	GameState.active_slot = int(data.get("active_slot", 0))
	GameState.kills_this_session = int(data.get("kills_this_session", 0))
	GameState.quest_target = int(data.get("quest_target", 3))
	GameState.tutorial_done = bool(data.get("tutorial_done", false))
	GameState.set_active_monster(GameState.active_slot)
	return true


func _serialize_monsters(list: Array) -> Array:
	var out: Array = []
	for m in list:
		if m is Dictionary:
			out.append(m.duplicate(true))
	return out
