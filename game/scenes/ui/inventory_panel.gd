extends PanelContainer



@onready var item_list: VBoxContainer = $Margin/VBox/ItemList

@onready var close_btn: Button        = $Margin/VBox/CloseBtn

@onready var coins_label: Label       = $Margin/VBox/CoinsLabel



const HEAL_ITEMS: Dictionary = {

	"potion": 30,

	"super_potion": 70,

	"full_restore": -1,

}





func _ready() -> void:
	UiTheme.apply(self)
	hide()
	Api.response_ready.connect(_on_api_response)





func refresh() -> void:

	coins_label.text = "Coins: " + str(GameState.coins)

	for child in item_list.get_children():

		child.queue_free()

	if Auth.is_logged_in() and GameState.character_id != "":

		Api.select("inventory", "load_inventory",

			"character_id=eq." + GameState.character_id + "&select=item_id,quantity,items(name,description,effect_type,effect_val)")

	else:

		_populate_local()





func _populate_local() -> void:
	var any := false
	for entry in GameState.inventory:
		if int(entry.get("qty", 0)) <= 0:
			continue
		any = true
		_add_row(entry.get("name", "?"), entry.get("qty", 0), entry.get("item_id", ""))
	if not any:
		_add_empty("Bag is empty. Win fights or shop at the Shrine [E].")





func _on_api_response(tag: String, data, error: String) -> void:

	if tag == "load_inventory":

		if error != "" or not (data is Array):

			return

		GameState.load_inventory_from_api(data)

		for row in data:

			var item = row.get("items", {})

			_add_row(item.get("name", "?"), row.get("quantity", 0), row.get("item_id", ""))

	elif tag == "use_item_rpc":
		if error != "" or not (data is Dictionary):
			_show_error(error if error != "" else "Could not use item.")
			return

		var new_hp := int(data.get("new_hp", 0))

		if new_hp > 0:

			var active = GameState.get_active_monster()

			if not active.is_empty():

				active["hp"] = new_hp

		GameState.party_changed.emit()
		GameState.sync_active_hp()
		Sfx.play_heal()
		refresh()





func _add_empty(msg: String) -> void:
	var empty := Label.new()
	empty.text = msg
	empty.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	empty.modulate = Color(0.75, 0.78, 0.88)
	item_list.add_child(empty)


func _add_row(item_name: String, qty: int, item_id: String) -> void:
	var hbox = HBoxContainer.new()
	var lbl = Label.new()
	lbl.text = item_name + "  ×" + str(qty)
	lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(lbl)
	if HEAL_ITEMS.has(item_id) and qty > 0:
		var btn = Button.new()
		btn.text = "Use"
		btn.pressed.connect(_use_item.bind(item_id))
		hbox.add_child(btn)
	item_list.add_child(hbox)





func _use_item(item_id: String) -> void:

	if not HEAL_ITEMS.has(item_id):

		return

	var active = GameState.get_active_monster()

	if active.is_empty():

		return

	if Auth.is_logged_in() and GameState.character_id != "":

		Api.call_rpc("use_item", "use_item_rpc", {

			"p_item_id":      item_id,

			"p_character_id": GameState.character_id,

			"p_monster_id":   active["id"],

		})

	else:

		_use_item_local(item_id)





func _use_item_local(item_id: String) -> void:
	for entry in GameState.inventory:
		if entry.get("item_id") == item_id and entry.get("qty", 0) > 0:
			entry["qty"] -= 1
			var amount: int = HEAL_ITEMS[item_id]
			var active = GameState.get_active_monster()
			if not active.is_empty():
				if amount < 0:
					active["hp"] = active.get("max_hp", 1)
				else:
					active["hp"] = mini(active.get("max_hp", 1), active.get("hp", 0) + amount)
			GameState.party_changed.emit()
			Sfx.play_heal()
			GameState.inventory_changed.emit()
			refresh()
			return



func _apply_heal(amount: int) -> void:

	var active = GameState.get_active_monster()

	if active.is_empty():

		return

	active["hp"] = mini(active.get("max_hp", 1), active.get("hp", 0) + amount)





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

