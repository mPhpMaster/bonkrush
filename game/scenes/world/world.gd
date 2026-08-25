extends Node3D



@onready var spawn_point: Node3D = $Shrine/SpawnPoint

@onready var player: CharacterBody3D = $Player

@onready var hud = $HUD



var _save_timer: float = 0.0

var _terrain3d: Node = null

var _terrain3d_active: bool = false

const SHRINE_RADIUS: float = 6.0

const SAVE_INTERVAL: float = 30.0

var _near_shrine: bool = false

var _fainting: bool = false

const TERRAIN_SIZE: float = IslandHeightmap.TERRAIN_SIZE





func _ready() -> void:

	add_to_group("world")

	_build_island_terrain()

	_scatter_halloween_props()

	Api.response_ready.connect(_on_api_response)



	var last = GameState.last_pos

	if last.is_finite() and last != Vector3.ZERO:

		player.global_position = sanitize_position(last, 1.0)

	else:

		player.global_position = sanitize_position(spawn_point.global_position, 1.0)



	GameState.character_loaded.connect(_on_character_loaded)

	hud.show()

	_place_player_on_ground()

	call_deferred("_show_welcome")





func _show_welcome() -> void:
	if hud and hud.has_method("_show_status"):
		hud._show_status(
			"Click Inventory/Collection/Party at top, or press I/C/P. Esc locks cursor for camera."
		)


func _build_island_terrain() -> void:
	var terrain_root: Node3D = get_node_or_null("Terrain") as Node3D
	if terrain_root == null:
		terrain_root = Node3D.new()
		terrain_root.name = "Terrain"
		add_child(terrain_root)

	_terrain3d = null
	_terrain3d_active = false
	IslandTerrainBuilder.build(terrain_root)
	_finalize_spawn_height()


func _is_terrain3d_node(node: Node) -> bool:
	return node != null and ClassDB.class_exists("Terrain3D") and node.is_class("Terrain3D")


func _finalize_spawn_height() -> void:
	spawn_point.global_position = sanitize_position(spawn_point.global_position, 1.5)


func _place_player_on_ground() -> void:
	player.global_position = sanitize_position(player.global_position, 1.0)





func get_ground_height(x: float, z: float) -> float:
	if not is_finite(x):
		x = 0.0
	if not is_finite(z):
		z = 0.0

	var height: float = IslandHeightmap.sample(x, z)
	if not is_finite(height):
		height = 0.0

	if _terrain3d != null and is_instance_valid(_terrain3d):
		var data: Variant = _terrain3d.get("data")
		if data != null and data.has_method("get_height"):
			var terrain_h: float = float(data.get_height(Vector3(x, height, z)))
			if is_finite(terrain_h):
				return terrain_h

	return height


func sanitize_position(pos: Vector3, y_offset: float = 0.0) -> Vector3:
	if not pos.is_finite():
		pos = spawn_point.global_position
	var ground_y: float = get_ground_height(pos.x, pos.z)
	if not is_finite(ground_y):
		ground_y = 0.0
	pos.y = ground_y + y_offset
	return pos





func _process(delta: float) -> void:
	_save_timer += delta
	if _save_timer >= SAVE_INTERVAL:
		_save_timer = 0.0
		_auto_save()

	_near_shrine = player.global_position.distance_to(spawn_point.global_position) <= SHRINE_RADIUS
	if hud.has_method("set_shop_hint"):
		hud.set_shop_hint(_near_shrine)


func try_open_shop() -> bool:
	if not _near_shrine:
		return false
	if hud.has_method("toggle_shop"):
		hud.toggle_shop()
	return true





func _auto_save() -> void:
	GameState.last_pos = player.global_position
	if DemoSave.demo_active or not Auth.is_logged_in():
		DemoSave.save_now()
		return
	if GameState.character_id == "":
		return

	Api.call_rpc("save_position", "save_pos", {

		"p_character_id": GameState.character_id,

		"p_x": player.global_position.x,

		"p_y": player.global_position.y,

		"p_z": player.global_position.z,

	})





func respawn_player() -> void:
	_fainting = false
	player.global_position = spawn_point.global_position
	_place_player_on_ground()
	for m in GameState.party:
		m["hp"] = m.get("max_hp", 1)
	GameState.party_changed.emit()
	GameState.sync_active_hp()
	_reset_wild_aggro()


func _reset_wild_aggro() -> void:
	for node in get_tree().get_nodes_in_group("wild_monster"):
		if node.has_method("reset_aggro"):
			node.reset_aggro()


func handle_player_faint() -> void:
	if _fainting:
		return
	if GameState.try_swap_on_faint():
		var hud_node = hud
		if hud_node and hud_node.has_method("_show_status"):
			hud_node._show_status("Active monster fainted — switched to next party member!")
		return
	_fainting = true
	var penalty: int = maxi(1, int(GameState.coins * 0.05))
	if Auth.is_logged_in() and GameState.character_id != "":
		Api.call_rpc("apply_faint_penalty", "faint_penalty", {
			"p_character_id": GameState.character_id,
		})
	else:
		GameState.spend_coins(penalty)
		respawn_player()
		if hud and hud.has_method("_show_status"):
			hud._show_status("Fainted! Lost " + str(penalty) + " coins. Respawned at Shrine.")


func is_fainting() -> bool:
	return _fainting





func _on_api_response(tag: String, data, error: String) -> void:

	if tag == "faint_penalty":

		if error == "" and data != null:

			GameState.coins = int(data)

			GameState.coins_changed.emit(GameState.coins)

		respawn_player()





const HALLOWEEN_MODELS: Array[String] = [

	"res://assets/models/kaykit/halloween/Assets/gltf/tree_dead_medium.gltf",

	"res://assets/models/kaykit/halloween/Assets/gltf/tree_dead_large.gltf",

	"res://assets/models/kaykit/halloween/Assets/gltf/tree_pine_orange_medium.gltf",

	"res://assets/models/kaykit/halloween/Assets/gltf/pumpkin_orange_jackolantern.gltf",

	"res://assets/models/kaykit/halloween/Assets/gltf/gravestone.gltf",

	"res://assets/models/kaykit/halloween/Assets/gltf/grave_A.gltf",

	"res://assets/models/kaykit/halloween/Assets/gltf/lantern_standing.gltf",

	"res://assets/models/kaykit/halloween/Assets/gltf/post_lantern.gltf",

	"res://assets/models/kaykit/halloween/Assets/gltf/fence.gltf",

	"res://assets/models/kaykit/halloween/Assets/gltf/skull_candle.gltf",

]



const HALLOWEEN_SCATTER: Array[Vector3] = [

	Vector3(18, 0, 12), Vector3(-22, 0, 16), Vector3(6, 0, 28),

	Vector3(32, 0, -12), Vector3(-28, 0, -8), Vector3(-12, 0, -24),

	Vector3(14, 0, -32), Vector3(40, 0, 18), Vector3(-38, 0, 22),

	Vector3(22, 0, 22), Vector3(-8, 0, 18), Vector3(10, 0, -18),

	Vector3(-18, 0, 30), Vector3(28, 0, 8), Vector3(-32, 0, -18),

	Vector3(35, 0, -22), Vector3(-14, 0, -12), Vector3(8, 0, 35),

]





func _scatter_halloween_props() -> void:

	var decor: Node3D = get_node_or_null("Decorations") as Node3D

	if decor == null:

		decor = Node3D.new()

		decor.name = "Decorations"

		add_child(decor)



	var rng := RandomNumberGenerator.new()

	rng.seed = 4242



	for i in HALLOWEEN_SCATTER.size():
		var base_pos: Vector3 = HALLOWEEN_SCATTER[i]
		if base_pos.length() > TERRAIN_SIZE * 0.38:
			continue
		var pos: Vector3 = base_pos
		pos.x += rng.randf_range(-2.0, 2.0)
		pos.z += rng.randf_range(-2.0, 2.0)
		pos = sanitize_position(pos, 0.0)

		var model_path: String = HALLOWEEN_MODELS[i % HALLOWEEN_MODELS.size()]
		var res = ResourceLoader.load(model_path, "PackedScene")
		var inst: Node3D = null
		if res is PackedScene:
			inst = (res as PackedScene).instantiate() as Node3D
		if inst == null:
			_add_placeholder_prop(decor, pos, i)
			continue
		inst.position = pos
		inst.rotation.y = rng.randf_range(0.0, TAU)
		decor.add_child(inst)
		var target_h: float = 1.6
		if "tree" in model_path:
			target_h = 5.5
		elif "fence" in model_path:
			target_h = 1.4
		elif "lantern" in model_path:
			target_h = 1.8
		KayKitVisuals.fit_to_height(inst, target_h)

	_add_water_plane()


func _add_placeholder_prop(decor: Node3D, pos: Vector3, i: int) -> void:
	var inst := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.35
	mesh.bottom_radius = 0.55
	mesh.height = 2.4 + float(i % 3) * 0.4
	inst.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.22, 0.38, 0.16) if i % 2 == 0 else Color(0.35, 0.22, 0.12)
	inst.material_override = mat
	inst.position = pos + Vector3(0.0, mesh.height * 0.5, 0.0)
	decor.add_child(inst)





func _add_water_plane() -> void:

	if get_node_or_null("Water") != null:

		return

	var water := MeshInstance3D.new()

	water.name = "Water"

	var plane := PlaneMesh.new()

	plane.size = Vector2(TERRAIN_SIZE * 1.4, TERRAIN_SIZE * 1.4)

	water.mesh = plane

	var mat := StandardMaterial3D.new()

	mat.albedo_color = Color(0.08, 0.35, 0.65, 0.85)

	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA

	mat.roughness = 0.15

	mat.metallic = 0.1

	water.material_override = mat

	water.position = Vector3(0, -1.8, 0)

	add_child(water)





func _on_character_loaded() -> void:

	var last = GameState.last_pos

	if last.is_finite() and last != Vector3.ZERO:

		player.global_position = sanitize_position(last, 1.0)

		_place_player_on_ground()
