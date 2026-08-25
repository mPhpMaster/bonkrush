extends PanelContainer

@onready var item_list: VBoxContainer = $Margin/VBox/ItemList
@onready var coins_label: Label       = $Margin/VBox/CoinsLabel
@onready var close_btn: Button        = $Margin/VBox/CloseBtn

const SHOP_ITEMS: Array = [
	{"id": "potion", "name": "Potion", "price": 50},
	{"id": "super_potion", "name": "Super Potion", "price": 120},
	{"id": "full_restore", "name": "Full Restore", "price": 200},
]


func _ready() -> void:
	UiTheme.apply(self)
	hide()
	Api.response_ready.connect(_on_api_response)


func refresh() -> void:
	coins_label.text = "Coins: " + str(GameState.coins)
	for child in item_list.get_children():
		child.queue_free()
	for item in SHOP_ITEMS:
		_add_row(item)


func _add_row(item: Dictionary) -> void:
	var hbox = HBoxContainer.new()
	var lbl = Label.new()
	lbl.text = item["name"] + "  —  " + str(item["price"]) + " coins"
	lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(lbl)
	var btn = Button.new()
	btn.text = "Buy"
	btn.disabled = GameState.coins < item["price"]
	btn.pressed.connect(_buy.bind(item["id"], item["price"]))
	hbox.add_child(btn)
	item_list.add_child(hbox)


func _buy(item_id: String, price: int) -> void:
	if GameState.coins < price:
		_show_error("Not enough coins.")
		return
	Sfx.play_ui()
	if Auth.is_logged_in() and GameState.character_id != "":
		Api.call_rpc("buy_item", "buy_item", {
			"p_item_id": item_id,
			"p_character_id": GameState.character_id,
		})
	else:
		GameState.spend_coins(price)
		_add_local_item(item_id)
		GameState.inventory_changed.emit()
		refresh()


func _add_local_item(item_id: String) -> void:
	for entry in GameState.inventory:
		if entry.get("item_id") == item_id:
			entry["qty"] = entry.get("qty", 0) + 1
			return
	var names := {"potion": "Potion", "super_potion": "Super Potion", "full_restore": "Full Restore"}
	GameState.inventory.append({"item_id": item_id, "name": names.get(item_id, item_id), "qty": 1})


func _reload_inventory() -> void:
	if not Auth.is_logged_in() or GameState.character_id == "":
		return
	Api.select("inventory", "shop_inv_reload",
		"character_id=eq." + GameState.character_id + "&select=item_id,quantity,items(name)")


func _on_api_response(tag: String, data, error: String) -> void:
	if tag == "shop_inv_reload":
		if error == "" and data is Array:
			GameState.load_inventory_from_api(data)
		return
	if tag != "buy_item":
		return
	if error != "":
		_show_error(error)
		return
	if not (data is Dictionary):
		_show_error("Purchase failed.")
		return
	GameState.coins = int(data.get("coins", GameState.coins))
	GameState.coins_changed.emit(GameState.coins)
	Sfx.play_coin()
	_reload_inventory()
	refresh()
	_show_error("Purchased " + str(data.get("item_id", "item")) + "!")


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
