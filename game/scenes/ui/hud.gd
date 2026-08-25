extends CanvasLayer

@onready var hp_label: Label        = $HUDRoot/StatPanel/TopLeft/HPLabel
@onready var hp_bar: ProgressBar    = $HUDRoot/StatPanel/TopLeft/HPBar
@onready var type_label: Label      = $HUDRoot/StatPanel/TopLeft/TypeLabel
@onready var xp_bar: ProgressBar    = $HUDRoot/StatPanel/TopLeft/XPBar
@onready var quest_label: Label     = $HUDRoot/StatPanel/TopLeft/QuestLabel
@onready var combat_label: Label    = $HUDRoot/StatPanel/TopLeft/CombatLabel
@onready var status_label: Label    = $HUDRoot/StatPanel/TopLeft/StatusLabel
@onready var coins_label: Label     = $HUDRoot/TopRight/CoinsLabel
@onready var logout_btn: Button     = $HUDRoot/TopRight/LogoutBtn
@onready var help_btn: Button       = $HUDRoot/TopRight/HelpBtn
@onready var inv_btn: Button        = $HUDRoot/MenuBar/InvBtn
@onready var coll_btn: Button       = $HUDRoot/MenuBar/CollBtn
@onready var party_btn: Button      = $HUDRoot/MenuBar/PartyBtn
@onready var shop_btn: Button       = $HUDRoot/MenuBar/ShopBtn
@onready var party_strip: HBoxContainer = $HUDRoot/PartyStrip
@onready var ability1: Button       = $HUDRoot/Bottom/AbilityBar/Ability1
@onready var ability2: Button       = $HUDRoot/Bottom/AbilityBar/Ability2
@onready var ability3: Button       = $HUDRoot/Bottom/AbilityBar/Ability3
@onready var inventory_panel: Control = $InventoryPanel
@onready var collection_panel: Control = $CollectionPanel
@onready var party_panel: Control   = $PartyPanel
@onready var shop_panel: Control    = $ShopPanel
@onready var modal_backdrop: ColorRect = $ModalBackdrop
@onready var shop_hint: Label       = $HUDRoot/ShopHint
@onready var catch_msg: Label       = $HUDRoot/Center/CatchMsg

var _catch_msg_timer: float = 0.0
var _hp_flash_timer: float = 0.0
var _status_timer: float = 0.0
var _player: Node = null


func _ready() -> void:
	add_to_group("hud")
	UiTheme.apply($HUDRoot)
	$HUDRoot/StatPanel.add_theme_stylebox_override("panel", UiTheme.make_hud_card())
	for panel in [inventory_panel, collection_panel, party_panel, shop_panel]:
		UiTheme.apply(panel)

	GameState.party_changed.connect(_refresh_hud)
	GameState.coins_changed.connect(_refresh_coins)
	GameState.inventory_changed.connect(_on_inventory_changed)

	inventory_panel.hide()
	collection_panel.hide()
	party_panel.hide()
	shop_panel.hide()
	modal_backdrop.hide()
	catch_msg.hide()
	combat_label.hide()
	status_label.hide()

	logout_btn.visible = Auth.is_logged_in()
	logout_btn.pressed.connect(_on_logout)
	help_btn.pressed.connect(show_tutorial)
	inv_btn.pressed.connect(toggle_inventory)
	coll_btn.pressed.connect(toggle_collection)
	party_btn.pressed.connect(show_party_swap)
	shop_btn.pressed.connect(_on_shop_btn_pressed)

	ability1.pressed.connect(_on_ability_attack)
	ability2.pressed.connect(_on_ability_special)
	ability3.pressed.connect(_on_ability_heal)

	modal_backdrop.gui_input.connect(_on_modal_backdrop_input)

	_refresh_hud()
	_refresh_coins(GameState.coins)

	var spawn_mgr = get_parent().get_node_or_null("WildSpawnManager")
	if spawn_mgr:
		spawn_mgr.catch_attempt.connect(_on_catch_attempt)
		spawn_mgr.sync_error.connect(_show_status)
		spawn_mgr.battle_won.connect(_on_battle_won)

	if not Auth.is_logged_in():
		_show_demo_badge()

	call_deferred("_layout_panels")
	if not GameState.tutorial_done:
		call_deferred("show_tutorial")


func _layout_panels() -> void:
	var vp_size: Vector2 = get_viewport().get_visible_rect().size
	modal_backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	modal_backdrop.set_size(vp_size)
	for panel in [inventory_panel, collection_panel, party_panel, shop_panel]:
		panel.top_level = true
		panel.set_anchors_preset(Control.PRESET_CENTER)
		panel.move_to_front()


func handle_menu_input(event: InputEvent) -> bool:
	if not event is InputEventKey or not event.is_pressed() or event.is_echo():
		return false
	if event.is_action_pressed("ui_cancel"):
		return close_open_panel()
	if event.is_action_pressed("toggle_inventory"):
		toggle_inventory()
		return true
	if event.is_action_pressed("toggle_collection"):
		toggle_collection()
		return true
	if event.is_action_pressed("swap_monster"):
		show_party_swap()
		return true
	if event.is_action_pressed("interact"):
		var world = get_tree().get_first_node_in_group("world")
		if world and world.has_method("try_open_shop") and world.try_open_shop():
			return true
	if event.physical_keycode == KEY_H:
		show_tutorial()
		return true
	return false


func _open_panel(panel: Control) -> void:
	_close_all_panels()
	modal_backdrop.show()
	panel.top_level = true
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.show()
	panel.move_to_front()
	if Sfx and Sfx.has_method("play_ui"):
		Sfx.play_ui()
	if panel.has_method("refresh"):
		panel.refresh()
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)


func _close_panel_ui() -> void:
	_close_all_panels()
	modal_backdrop.hide()
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)


func _on_shop_btn_pressed() -> void:
	var world = get_tree().get_first_node_in_group("world")
	if world and world.has_method("try_open_shop") and world.try_open_shop():
		return
	_show_status("Stand near the Shrine to open the shop.")


func _process(delta: float) -> void:
	if _catch_msg_timer > 0.0:
		_catch_msg_timer -= delta
		if _catch_msg_timer <= 0.0:
			catch_msg.hide()

	if _hp_flash_timer > 0.0:
		_hp_flash_timer -= delta
		if _hp_flash_timer <= 0.0:
			hp_label.modulate = Color.WHITE

	if _status_timer > 0.0:
		_status_timer -= delta
		if _status_timer <= 0.0:
			status_label.hide()

	_update_combat_indicator()
	_update_ability_cooldowns(is_any_panel_open())


func _on_modal_backdrop_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_close_panel_ui()


func _update_combat_indicator() -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")

	var in_combat := false
	for node in get_tree().get_nodes_in_group("wild_monster"):
		if node.has_method("is_aggro") and node.is_aggro():
			var dist: float = _player.global_position.distance_to(node.global_position) if _player else 999.0
			if dist < 12.0:
				in_combat = true
				break

	combat_label.visible = in_combat
	combat_label.text = "⚔ In Combat" if in_combat else ""


func _update_ability_cooldowns(panels_open: bool = false) -> void:
	if _player == null:
		return
	if not _player.has_method("get_ability_cooldowns"):
		return

	var cds: Dictionary = _player.get_ability_cooldowns()
	ability1.disabled = panels_open or cds.get("attack", 0.0) > 0.0
	ability2.disabled = panels_open or cds.get("special", 0.0) > 0.0
	ability3.disabled = panels_open or cds.get("heal", 0.0) > 0.0
	ability1.text = "1  Attack" if cds.get("attack", 0.0) <= 0.0 else "1  %.1fs" % cds["attack"]
	ability2.text = "2  Special" if cds.get("special", 0.0) <= 0.0 else "2  %.1fs" % cds["special"]
	ability3.text = "3  Heal" if cds.get("heal", 0.0) <= 0.0 else "3  %.1fs" % cds["heal"]


func flash_damage() -> void:
	hp_label.modulate = Color(1.0, 0.3, 0.3)
	_hp_flash_timer = 0.35


func _on_inventory_changed() -> void:
	if inventory_panel.visible and inventory_panel.has_method("refresh"):
		inventory_panel.refresh()


func _on_battle_won(_wild_data: Dictionary, xp_gained: int, coins_gained: int) -> void:
	_refresh_hud()
	var msg := "Victory! +" + str(xp_gained) + " XP, +" + str(coins_gained) + " coins"
	if GameState.is_quest_complete():
		msg += " — Quest complete!"
	_show_status(msg)


func _show_demo_badge() -> void:
	var badge := Label.new()
	badge.text = "DEMO — progress saved locally"
	badge.modulate = Color(1.0, 0.85, 0.3, 0.9)
	badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	badge.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	badge.offset_left = -260.0
	badge.offset_top = 52.0
	badge.offset_right = -10.0
	badge.offset_bottom = 72.0
	$HUDRoot.add_child(badge)


func _show_status(msg: String) -> void:
	status_label.text = msg
	status_label.show()
	_status_timer = 4.0


func _refresh_hud() -> void:
	var active = GameState.get_active_monster()
	_refresh_quest()
	_refresh_party_strip()
	if active.is_empty():
		hp_label.text = "No companion"
		type_label.text = "Catch a wild monster or add one from Collection [C]"
		xp_bar.visible = false
		hp_bar.visible = false
		return
	xp_bar.visible = true
	hp_bar.visible = true
	var hp: int = int(active.get("hp", 0))
	var max_hp: int = maxi(1, int(active.get("max_hp", 1)))
	var name: String = str(active.get("species_name", "?"))
	var lvl: int = int(active.get("level", 1))
	var xp_needed: int = 50 * lvl
	var xp: int = int(active.get("xp", 0))
	hp_label.text = name + "  ·  Lv." + str(lvl)
	hp_bar.max_value = max_hp
	hp_bar.value = clampf(float(hp), 0.0, float(max_hp))
	hp_bar.modulate = Color(0.95, 0.32, 0.32) if hp < max_hp * 0.3 else Color(0.35, 0.85, 0.45)
	type_label.text = (
		active.get("type", "?").capitalize() + "   HP " + str(hp) + "/" + str(max_hp) +
		"   Trainer Lv." + str(GameState.char_level)
	)
	type_label.modulate = SpeciesDB.get_type_color(active.get("type", "fire"))
	xp_bar.max_value = xp_needed
	xp_bar.value = clampf(float(xp), 0.0, float(xp_needed))


func _refresh_party_strip() -> void:
	for child in party_strip.get_children():
		child.queue_free()
	for i in range(4):
		var btn := Button.new()
		btn.custom_minimum_size = Vector2(92, 72)
		if i < GameState.party.size():
			var m: Dictionary = GameState.party[i]
			var active: bool = bool(m.get("is_active", false))
			btn.text = str(i + 1) + "\n" + str(m.get("species_name", "?")) + "\nLv." + str(m.get("level", 1))
			btn.modulate = Color(1.15, 1.05, 0.75) if active else Color(1, 1, 1)
			btn.pressed.connect(GameState.set_active_monster.bind(i))
		else:
			btn.text = str(i + 1) + "\n—"
			btn.disabled = true
		party_strip.add_child(btn)


func _refresh_quest() -> void:
	var k := GameState.kills_this_session
	var t := GameState.quest_target
	if GameState.is_quest_complete():
		quest_label.text = "Quest complete — shop at the Shrine [E]"
		quest_label.modulate = Color(0.4, 1.0, 0.5)
	else:
		quest_label.text = "Quest: Defeat " + str(t) + " wild monsters (" + str(k) + "/" + str(t) + ")"
		quest_label.modulate = Color(0.75, 0.85, 1.0)


func _refresh_coins(amount: int) -> void:
	coins_label.text = "🪙  " + str(amount)


func _get_player() -> Node:
	return get_tree().get_first_node_in_group("player")


func _on_ability_attack() -> void:
	var player = _get_player()
	if player and player.has_method("do_basic_attack"):
		player.do_basic_attack()


func _on_ability_special() -> void:
	var player = _get_player()
	if player and player.has_method("do_special_attack"):
		player.do_special_attack()


func _on_ability_heal() -> void:
	var player = _get_player()
	if player and player.has_method("do_heal_ability"):
		player.do_heal_ability()


func set_shop_hint(visible_hint: bool) -> void:
	shop_hint.visible = visible_hint and not shop_panel.visible


func toggle_shop() -> void:
	if shop_panel.visible:
		_close_panel_ui()
	else:
		shop_hint.visible = false
		_open_panel(shop_panel)


func _close_all_panels() -> void:
	inventory_panel.hide()
	collection_panel.hide()
	party_panel.hide()
	shop_panel.hide()


func is_any_panel_open() -> bool:
	return (
		inventory_panel.visible
		or collection_panel.visible
		or party_panel.visible
		or shop_panel.visible
	)


func close_open_panel() -> bool:
	if not is_any_panel_open():
		return false
	_close_panel_ui()
	return true


func toggle_inventory() -> void:
	if inventory_panel.visible:
		_close_panel_ui()
	else:
		_open_panel(inventory_panel)


func toggle_collection() -> void:
	if collection_panel.visible:
		_close_panel_ui()
	else:
		_open_panel(collection_panel)


func show_party_swap() -> void:
	if party_panel.visible:
		_close_panel_ui()
	else:
		_open_panel(party_panel)


func show_catch_message(caught: bool, species_name: String) -> void:
	catch_msg.text = ("Caught " + species_name + "!") if caught else (species_name + " got away…")
	catch_msg.modulate = Color(0.3, 1.0, 0.4) if caught else Color(1.0, 0.5, 0.2)
	catch_msg.show()
	_catch_msg_timer = 3.0


func _on_catch_attempt(wild_data: Dictionary, _success: bool) -> void:
	if not wild_data.get("already_caught", false):
		return
	var species_id: String = wild_data.get("species_id", "")
	var species_name: String = SpeciesDB.get_species(species_id).get("name", "Monster")
	catch_msg.text = species_name + " already caught — +10 coins, +20 XP"
	catch_msg.modulate = Color(0.8, 0.8, 0.2)
	catch_msg.show()
	_catch_msg_timer = 3.0


func _on_logout() -> void:
	GameState.reset()
	Auth.sign_out()
	get_tree().change_scene_to_file("res://scenes/ui/login.tscn")


func show_tutorial() -> void:
	if get_node_or_null("TutorialOverlay") != null:
		return
	var overlay := preload("res://scenes/ui/tutorial_overlay.gd").new()
	overlay.name = "TutorialOverlay"
	add_child(overlay)
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
