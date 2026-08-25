extends PanelContainer



@onready var monster_list: VBoxContainer = $Margin/VBox/ScrollContainer/MonsterList

@onready var close_btn: Button           = $Margin/VBox/CloseBtn





func _ready() -> void:
	UiTheme.apply(self)
	hide()
	Api.response_ready.connect(_on_api_response)
	GameState.collection_changed.connect(_on_collection_changed)


func _on_collection_changed() -> void:
	if not visible:
		return
	for child in monster_list.get_children():
		child.queue_free()
	_populate_from_state()





func refresh() -> void:

	for child in monster_list.get_children():

		child.queue_free()

	if Auth.is_logged_in() and GameState.character_id != "":

		Api.select("player_monsters", "load_collection",

			"character_id=eq." + GameState.character_id + "&slot=lt.0&order=created_at.asc")

	else:

		_populate_from_state()





func _populate_from_state() -> void:
	if GameState.collection.is_empty():
		var lbl := Label.new()
		lbl.text = "No caught monsters yet. Defeat a wild monster for a catch chance."
		lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		lbl.modulate = Color(0.75, 0.78, 0.88)
		monster_list.add_child(lbl)
		return
	for m in GameState.collection:
		_add_monster_row(m)





func _on_api_response(tag: String, data, _error: String) -> void:

	if tag == "load_collection":

		if not (data is Array):

			return

		GameState.collection.clear()

		for row in data:

			if int(row.get("slot", -1)) >= 0:

				continue

			GameState.collection.append(GameState.build_monster_entry(row))

		for m in GameState.collection:

			_add_monster_row(m)

		GameState.collection_changed.emit()

	elif tag == "set_party_slot":
		if _error != "":
			return
		GameState.request_monster_reload()


func _reload_all_monsters() -> void:
	GameState.request_monster_reload()





func _add_monster_row(m: Dictionary) -> void:

	var hbox = HBoxContainer.new()

	var lbl = Label.new()

	var color = SpeciesDB.get_type_color(m.get("type", "fire"))

	lbl.text = (

		m.get("species_name", "?") +

		"  [" + m.get("type", "?").capitalize() + "]" +

		"  Lv." + str(m.get("level", 1)) +

		"  XP: " + str(m.get("xp", 0)) + "/" + str(50 * m.get("level", 1))

	)

	lbl.modulate = color

	lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	hbox.add_child(lbl)



	if GameState.party_count() < 4:

		var btn = Button.new()

		btn.text = "Add to Party"

		btn.pressed.connect(_add_to_party.bind(m))

		hbox.add_child(btn)



	monster_list.add_child(hbox)





func _add_to_party(m: Dictionary) -> void:

	var slot: int = GameState.party_count()

	if slot >= 4:

		return

	if Auth.is_logged_in() and GameState.character_id != "":

		Api.call_rpc("set_party_slot", "set_party_slot", {

			"p_character_id": GameState.character_id,

			"p_monster_id":   m["id"],

			"p_slot":         slot,

		})

	else:

		if GameState.move_local_to_party(m["id"], slot):

			refresh()





func _on_close_btn_pressed() -> void:
	var hud = get_tree().get_first_node_in_group("hud")
	if hud and hud.has_method("_close_panel_ui"):
		hud._close_panel_ui()
	else:
		hide()
		Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

