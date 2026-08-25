extends Node

signal logged_in(user_id: String)
signal login_failed(error: String)
signal logged_out
signal token_refreshed
signal session_expired

var access_token: String = ""
var refresh_token: String = ""
var user_id: String = ""
var user_email: String = ""

var _http: HTTPRequest
var _refresh_http: HTTPRequest
var _refreshing: bool = false


func _ready() -> void:
	_http = HTTPRequest.new()
	add_child(_http)
	_http.request_completed.connect(_on_request_completed)

	_refresh_http = HTTPRequest.new()
	add_child(_refresh_http)
	_refresh_http.request_completed.connect(_on_refresh_completed)

	_load_session()


func sign_up(email: String, password: String) -> void:
	_post("/signup", {"email": email, "password": password})


func sign_in(email: String, password: String) -> void:
	_post("/token?grant_type=password", {"email": email, "password": password})


func sign_out() -> void:
	access_token = ""
	refresh_token = ""
	user_id = ""
	user_email = ""
	_save_session()
	logged_out.emit()


func is_logged_in() -> bool:
	return access_token != ""


func get_headers() -> PackedStringArray:
	return PackedStringArray([
		"Content-Type: application/json",
		"apikey: " + Config.SUPABASE_ANON_KEY,
		"Authorization: Bearer " + access_token
	])


func refresh_access_token() -> bool:
	if refresh_token == "" or _refreshing:
		return false
	_refreshing = true
	var headers = PackedStringArray([
		"Content-Type: application/json",
		"apikey: " + Config.SUPABASE_ANON_KEY,
	])
	_refresh_http.request(
		Config.AUTH_URL + "/token?grant_type=refresh_token",
		headers,
		HTTPClient.METHOD_POST,
		JSON.stringify({"refresh_token": refresh_token})
	)
	return true


func _post(path: String, body: Dictionary) -> void:
	var headers = PackedStringArray([
		"Content-Type: application/json",
		"apikey: " + Config.SUPABASE_ANON_KEY
	])
	_http.request(
		Config.AUTH_URL + path,
		headers,
		HTTPClient.METHOD_POST,
		JSON.stringify(body)
	)


func _on_request_completed(result: int, response_code: int,
		_headers: PackedStringArray, body: PackedByteArray) -> void:
	if result != HTTPRequest.RESULT_SUCCESS:
		login_failed.emit("Network error")
		return

	var json = JSON.new()
	if json.parse(body.get_string_from_utf8()) != OK:
		login_failed.emit("Parse error")
		return

	var data = json.get_data()
	if response_code >= 400:
		var msg = data.get("error_description", data.get("msg", "Unknown error"))
		login_failed.emit(msg)
		return

	_apply_token_response(data)
	logged_in.emit(user_id)


func _on_refresh_completed(result: int, response_code: int,
		_headers: PackedStringArray, body: PackedByteArray) -> void:
	_refreshing = false
	if result != HTTPRequest.RESULT_SUCCESS or response_code >= 400:
		session_expired.emit()
		sign_out()
		login_failed.emit("Session expired. Please log in again.")
		return

	var json = JSON.new()
	if json.parse(body.get_string_from_utf8()) != OK:
		return

	_apply_token_response(json.get_data())
	token_refreshed.emit()


func _apply_token_response(data: Dictionary) -> void:
	access_token = data.get("access_token", "")
	if data.has("refresh_token"):
		refresh_token = data.get("refresh_token", refresh_token)
	var user = data.get("user", {})
	if not user.is_empty():
		user_id = user.get("id", user_id)
		user_email = user.get("email", user_email)
	_save_session()


func _save_session() -> void:
	var cfg = ConfigFile.new()
	cfg.set_value("auth", "access_token", access_token)
	cfg.set_value("auth", "refresh_token", refresh_token)
	cfg.set_value("auth", "user_id", user_id)
	cfg.set_value("auth", "user_email", user_email)
	cfg.save("user://session.cfg")


func _load_session() -> void:
	var cfg = ConfigFile.new()
	if cfg.load("user://session.cfg") != OK:
		return
	access_token = cfg.get_value("auth", "access_token", "")
	refresh_token = cfg.get_value("auth", "refresh_token", "")
	user_id = cfg.get_value("auth", "user_id", "")
	user_email = cfg.get_value("auth", "user_email", "")
