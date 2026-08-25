extends Control



@onready var name_input: LineEdit  = $Panel/VBox/NameInput

@onready var type_grid: GridContainer = $Panel/VBox/TypeGrid

@onready var confirm_btn: Button   = $Panel/VBox/ConfirmBtn

@onready var error_label: Label    = $Panel/VBox/ErrorLabel

@onready var preview_label: Label  = $Panel/VBox/PreviewLabel



const WORLD_SCENE: String = "res://scenes/world/world.tscn"

const TYPES: Array = ["fire", "water", "grass", "electric", "psychic", "dark", "wind"]

const TYPE_EMOJI: Dictionary = {
	"fire": "🔥 Fire", "water": "💧 Water", "grass": "🌿 Grass",
	"electric": "⚡ Electric", "psychic": "🔮 Psychic", "dark": "🌑 Dark", "wind": "🌬 Wind",
}

const TYPE_SPECIES: Dictionary = {
	"fire": "emberling", "water": "aquafin", "grass": "leafkin",
	"electric": "sparkit", "psychic": "mindwisp", "dark": "shadeclaw", "wind": "galehart",
}



var _selected_type: String = "fire"

var _type_buttons: Dictionary = {}





func _ready() -> void:

	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	UiTheme.apply(self)
	Api.response_ready.connect(_on_api_response)

	_build_type_buttons()

	_select_type("fire")

	error_label.hide()





func _build_type_buttons() -> void:

	for t in TYPES:

		var btn = Button.new()

		btn.text = TYPE_EMOJI.get(t, t.capitalize())
		btn.custom_minimum_size = Vector2(108, 40)

		var color = SpeciesDB.get_type_color(t)

		btn.add_theme_color_override("font_color", color)

		btn.pressed.connect(_select_type.bind(t))

		type_grid.add_child(btn)

		_type_buttons[t] = btn





func _select_type(t: String) -> void:

	_selected_type = t

	for key in _type_buttons:

		var btn = _type_buttons[key]

		btn.flat = (key != t)

	var species = SpeciesDB.get_species(TYPE_SPECIES.get(t, "emberling"))

	var stats = SpeciesDB.calc_stats(species["id"], 5)

	preview_label.text = (

		"Starter: " + species["name"] + " (Lv.5)\n" +

		"HP: " + str(stats["max_hp"]) +

		"  ATK: " + str(stats["attack"]) +

		"  DEF: " + str(stats["defense"]) +

		"  SPD: " + str(stats["speed"])

	)





func _on_confirm_btn_pressed() -> void:

	var char_name = name_input.text.strip_edges()

	if char_name.length() < 2:

		_show_error("Name must be at least 2 characters.")

		return

	if char_name.length() > 20:

		_show_error("Name must be 20 characters or less.")

		return

	confirm_btn.disabled = true

	if DemoSave.demo_active or not Auth.is_logged_in():

		_create_offline_character(char_name)

		return

	Api.call_rpc("create_character", "create_char", {

		"p_name":         char_name,

		"p_starter_type": _selected_type,

	})





func _create_offline_character(char_name: String) -> void:

	var species_id: String = TYPE_SPECIES.get(_selected_type, "emberling")

	var stats := SpeciesDB.calc_stats(species_id, 5)

	var char_data := {

		"id": "demo_char",

		"name": char_name,

		"starter_type": _selected_type,

		"level": 1,

		"xp": 0,

		"coins": 120,

		"last_pos_x": 0.0,

		"last_pos_y": 0.0,

		"last_pos_z": 0.0,

	}

	var party := [{

		"id": "demo_mon_1",

		"species_id": species_id,

		"level": 5,

		"xp": 0,

		"is_active": true,

		"slot": 0,

		"current_hp": stats.get("max_hp", 60),

	}]

	GameState.load_from_api_data(char_data, party)

	GameState.inventory = [

		{"item_id": "potion", "name": "Potion", "qty": 3},

	]

	GameState.inventory_changed.emit()

	DemoSave.save_now()

	confirm_btn.disabled = false

	get_tree().change_scene_to_file(WORLD_SCENE)





func _on_api_response(tag: String, data, error: String) -> void:

	if tag != "create_char":

		return

	confirm_btn.disabled = false

	if error != "":

		_show_error("Error: " + error)

		return

	if data is Dictionary:

		var party = data.get("party", [])

		GameState.load_from_api_data(data, party)

		GameState.inventory = [

			{"item_id": "potion", "name": "Potion", "qty": 3},

		]

		GameState.inventory_changed.emit()

	get_tree().change_scene_to_file(WORLD_SCENE)





func _show_error(msg: String) -> void:

	error_label.text = msg

	error_label.show()

