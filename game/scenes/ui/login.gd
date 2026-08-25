extends Control



@onready var email_input: LineEdit    = $Panel/VBox/EmailInput

@onready var pass_input: LineEdit     = $Panel/VBox/PassInput

@onready var login_btn: Button        = $Panel/VBox/LoginBtn

@onready var signup_btn: Button       = $Panel/VBox/SignupBtn

@onready var error_label: Label       = $Panel/VBox/ErrorLabel

@onready var spinner: Label           = $Panel/VBox/Spinner



const WORLD_SCENE: String = "res://scenes/world/world.tscn"

const CHAR_CREATE: String = "res://scenes/ui/character_create.tscn"



var _login_flags := {"party": false, "collection": false, "inventory": false}

var _loading: bool = false





func _ready() -> void:
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	UiTheme.apply(self)
	Auth.logged_in.connect(_on_logged_in)

	Auth.login_failed.connect(_on_login_failed)

	Auth.logged_out.connect(_on_logged_out)

	Auth.session_expired.connect(_on_session_expired)

	Api.response_ready.connect(_on_api_response)

	error_label.hide()

	spinner.hide()

	pass_input.secret = true
	pass_input.text_submitted.connect(func(_t): _on_login_btn_pressed())
	email_input.text_submitted.connect(func(_t): pass_input.grab_focus())



	if OS.get_cmdline_args().has("--demo"):

		_start_demo()

		return



	if Auth.is_logged_in():

		_begin_loading("Resuming session…")

		_load_character()





func _begin_loading(msg: String) -> void:

	_loading = true

	login_btn.disabled = true

	signup_btn.disabled = true

	spinner.show()

	spinner.text = msg





func _end_loading() -> void:

	_loading = false

	login_btn.disabled = false

	signup_btn.disabled = false

	spinner.hide()





func _validate_credentials() -> bool:

	var email := email_input.text.strip_edges()

	var password := pass_input.text

	if email.is_empty() or not email.contains("@"):

		_show_error("Enter a valid email address.")

		return false

	if password.length() < 6:

		_show_error("Password must be at least 6 characters.")

		return false

	return true





func _on_login_btn_pressed() -> void:

	if not _validate_credentials():

		return

	_clear_error()

	_begin_loading("Logging in…")

	Auth.sign_in(email_input.text.strip_edges(), pass_input.text)





func _on_signup_btn_pressed() -> void:

	if not _validate_credentials():

		return

	_clear_error()

	_begin_loading("Creating account…")

	Auth.sign_up(email_input.text.strip_edges(), pass_input.text)





func _on_demo_btn_pressed() -> void:

	_clear_error()

	_start_demo()





func _on_logged_in(_uid: String) -> void:

	_begin_loading("Loading character…")

	_load_character()





func _on_login_failed(err: String) -> void:

	_end_loading()

	_show_error(err)





func _on_session_expired() -> void:

	_on_logged_out()

	_show_error("Session expired. Please log in again.")





func _load_character() -> void:

	Api.select("characters", "load_character",

		"user_id=eq." + Auth.user_id + "&select=*&limit=1")





func _load_party(char_data: Dictionary) -> void:

	set_meta("_char_data", char_data)

	_login_flags = {"party": false, "collection": false, "inventory": false}

	var cid: String = char_data["id"]

	Api.select("player_monsters", "load_party",

		"character_id=eq." + cid + "&slot=gte.0&order=slot.asc")

	Api.select("player_monsters", "load_collection",

		"character_id=eq." + cid + "&slot=lt.0&order=created_at.asc")

	Api.select("inventory", "load_inventory",

		"character_id=eq." + cid + "&select=item_id,quantity,items(name,description)")





func _on_api_response(tag: String, data, error: String) -> void:

	if tag == "load_character":

		if error != "":

			_end_loading()

			_show_error("Failed to load character: " + error)

			return

		if data is Array and data.size() > 0:

			_load_party(data[0])

		else:

			_end_loading()

			get_tree().change_scene_to_file(CHAR_CREATE)

		return



	if tag == "load_party":

		if error != "":

			_end_loading()

			_show_error("Failed to load party: " + error)

			return

		set_meta("_party_data", data if data is Array else [])

		_login_flags["party"] = true

		_try_enter_world()

	elif tag == "load_collection":

		if error != "":

			_end_loading()

			_show_error("Failed to load collection: " + error)

			return

		set_meta("_collection_data", data if data is Array else [])

		_login_flags["collection"] = true

		_try_enter_world()

	elif tag == "load_inventory":

		if error != "":

			_end_loading()

			_show_error("Failed to load inventory: " + error)

			return

		if data is Array:

			GameState.load_inventory_from_api(data)

		_login_flags["inventory"] = true

		_try_enter_world()





func _try_enter_world() -> void:

	for key in _login_flags:

		if not _login_flags[key]:

			return

	_end_loading()

	GameState.load_from_api_data(

		get_meta("_char_data", {}),

		get_meta("_party_data", []),

		get_meta("_collection_data", [])

	)

	get_tree().change_scene_to_file(WORLD_SCENE)





func _show_error(msg: String) -> void:

	error_label.text = msg

	error_label.show()





func _clear_error() -> void:

	error_label.hide()

	error_label.text = ""





func _start_demo() -> void:
	Auth.sign_out()
	GameState.reset()
	DemoSave.enter_demo_mode()
	_end_loading()
	error_label.hide()
	if DemoSave.load_into_game_state():
		get_tree().change_scene_to_file(WORLD_SCENE)
		return
	get_tree().change_scene_to_file(CHAR_CREATE)


func _on_reset_demo_pressed() -> void:
	DemoSave.clear_save()
	_show_error("Demo save cleared. Press Play Demo to start fresh.")





func _on_logged_out() -> void:

	_loading = false

	_login_flags = {"party": false, "collection": false, "inventory": false}

	_end_loading()

	_clear_error()

	GameState.reset()
