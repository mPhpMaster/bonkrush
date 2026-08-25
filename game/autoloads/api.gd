extends Node
## Thin PostgREST + RPC client with automatic token refresh on 401.

signal response_ready(tag: String, data: Variant, error: String)

var _pool: Array[HTTPRequest] = []
var _active: Dictionary = {}
var _retry_queue: Array[Dictionary] = []


func _ready() -> void:
	Auth.token_refreshed.connect(_on_token_refreshed)
	Auth.session_expired.connect(_flush_retry_queue)


func _flush_retry_queue() -> void:
	for req in _retry_queue:
		response_ready.emit(req.get("tag", "unknown"), null, "Session expired")
	_retry_queue.clear()


func _get_http() -> HTTPRequest:
	for h in _pool:
		if not _active.has(h):
			return h
	var h = HTTPRequest.new()
	add_child(h)
	h.request_completed.connect(_on_done.bind(h))
	_pool.append(h)
	return h


func select(table: String, tag: String, query: String = "") -> void:
	var url = Config.REST_URL + "/" + table
	if query != "":
		url += "?" + query
	_request(url, HTTPClient.METHOD_GET, tag, "")


func insert(table: String, tag: String, body: Dictionary) -> void:
	_request(
		Config.REST_URL + "/" + table,
		HTTPClient.METHOD_POST,
		tag,
		JSON.stringify(body),
		["Prefer: return=representation"]
	)


func update(table: String, tag: String, query: String, body: Dictionary) -> void:
	_request(
		Config.REST_URL + "/" + table + "?" + query,
		HTTPClient.METHOD_PATCH,
		tag,
		JSON.stringify(body),
		["Prefer: return=representation"]
	)


func call_rpc(fn: String, tag: String, params: Dictionary) -> void:
	_request(Config.RPC_URL + "/" + fn, HTTPClient.METHOD_POST, tag, JSON.stringify(params))


func _request(url: String, method: int, tag: String, body: String, extra: Array = []) -> void:
	var h = _get_http()
	_active[h] = tag
	h.set_meta("req_url", url)
	h.set_meta("req_method", method)
	h.set_meta("req_body", body)
	h.set_meta("req_extra", extra)
	h.request(url, _headers(extra), method, body)


func _headers(extra: Array = []) -> PackedStringArray:
	var base = [
		"Content-Type: application/json",
		"apikey: " + Config.SUPABASE_ANON_KEY,
		"Authorization: Bearer " + Auth.access_token,
	]
	base.append_array(extra)
	return PackedStringArray(base)


func _on_done(result: int, code: int, _hdrs: PackedStringArray,
		body: PackedByteArray, http: HTTPRequest) -> void:
	var tag = _active.get(http, "unknown")
	var url: String = http.get_meta("req_url", "")
	var method: int = http.get_meta("req_method", HTTPClient.METHOD_GET)
	var req_body: String = http.get_meta("req_body", "")
	var extra: Array = http.get_meta("req_extra", [])
	_active.erase(http)

	if code == 401 and Auth.refresh_access_token():
		_retry_queue.append({
			"url": url, "method": method, "tag": tag,
			"body": req_body, "extra": extra,
		})
		return

	if code == 401:
		response_ready.emit(tag, null, "Session expired")
		return

	if result != HTTPRequest.RESULT_SUCCESS:
		response_ready.emit(tag, null, "network_error")
		return

	var text = body.get_string_from_utf8()
	if text == "" or text == "null":
		response_ready.emit(tag, null, "" if code < 400 else "empty_error")
		return

	var json = JSON.new()
	if json.parse(text) != OK:
		response_ready.emit(tag, null, "parse_error")
		return

	var data = json.get_data()
	if code >= 400:
		var msg = ""
		if data is Dictionary:
			msg = data.get("message", data.get("hint", "api_error"))
		response_ready.emit(tag, null, msg)
		return

	response_ready.emit(tag, data, "")


func _on_token_refreshed() -> void:
	var queue := _retry_queue.duplicate()
	_retry_queue.clear()
	for req in queue:
		_request(req["url"], req["method"], req["tag"], req["body"], req.get("extra", []))
