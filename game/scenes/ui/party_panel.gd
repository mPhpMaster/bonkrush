extends PanelContainer

@onready var slot_list: VBoxContainer = $Margin/VBox/SlotList
@onready var close_btn: Button        = $Margin/VBox/CloseBtn


func _ready() -> void:
	UiTheme.apply(self)
	hide()
	Api.response_ready.connect(_on_api_response)
	GameState.party_changed.connect(_on_party_changed)


func _on_party_changed() -> void:
	if visible:
		refresh()


func refresh() -> void:
	for child in slot_list.get_children():
		child.queue_free()
	if GameState.party.is_empty():
		var empty := Label.new()
		empty.text = "Party is empty. Add a monster from Collection [C]."
		empty.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		slot_list.add_child(empty)
		return
	for i in GameState.party.size():
		var m = GameState.party[i]
		var hbox = HBoxContainer.new()
		var lbl = Label.new()
		lbl.text = (
			"[" + str(i + 1) + "] " +
			m.get("species_name", "?") +
			"  Lv." + str(m.get("level", 1)) +
			"  HP: " + str(m.get("hp", 0)) + "/" + str(m.get("max_hp", 1))
		)
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lbl.modulate = SpeciesDB.get_type_color(m.get("type", "fire"))
		hbox.add_child(lbl)
		if not m.get("is_active", false):
			var btn = Button.new()
			btn.text = "Set Active"
			btn.pressed.connect(GameState.set_active_monster.bind(i))
			btn.pressed.connect(refresh)
			hbox.add_child(btn)
		else:
			var tag = Label.new()
			tag.text = "★ Active"
			tag.modulate = Color(1, 0.9, 0.2)
			hbox.add_child(tag)
		if GameState.party.size() > 1:
			var drop = Button.new()
			drop.text = "To Collection"
			drop.pressed.connect(_move_to_collection.bind(m))
			hbox.add_child(drop)
		slot_list.add_child(hbox)


func _move_to_collection(m: Dictionary) -> void:
	if Auth.is_logged_in() and GameState.character_id != "":
		Api.call_rpc("set_party_slot", "set_party_slot", {
			"p_character_id": GameState.character_id,
			"p_monster_id":   m["id"],
			"p_slot":         -1,
		})
	else:
		if GameState.move_local_to_collection(m["id"]):
			refresh()


func _on_api_response(tag: String, _data, error: String) -> void:
	if tag != "set_party_slot":
		return
	if error != "":
		_show_error(error)
		return
	GameState.request_monster_reload()
	refresh()


func _show_error(msg: String) -> void:
	var hud = get_tree().get_first_node_in_group("hud")
	if hud and hud.has_method("_show_status"):
		hud._show_status(msg)


func _on_close_btn_pressed() -> void:
	var hud = get_tree().get_first_node_in_group("hud")
	if hud and hud.has_method("_close_panel_ui"):
		hud._close_panel_ui()
	else:
		hide()
		Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
