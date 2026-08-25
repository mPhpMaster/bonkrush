extends CharacterBody3D

const SPEED: float = 6.0
const SPRINT_SPEED: float = 10.0
const JUMP_VELOCITY: float = 5.0
const GRAVITY: float = 9.8
const ATTACK_RANGE: float = 3.5
const ATTACK_COOLDOWN: float = 0.8
const SPECIAL_COOLDOWN: float = 2.0
const HEAL_COOLDOWN: float = 3.0
const HEAL_AMOUNT: int = 25

@export var cam_sensitivity: float = 0.003
@export var cam_distance: float = 8.0

@onready var camera_pivot: Node3D = $CameraPivot
@onready var camera: Camera3D = $CameraPivot/Camera3D
@onready var companion_socket: Node3D = $CompanionSocket
@onready var mesh_instance: Node3D = $MeshHolder
@onready var attack_area: Area3D = $AttackArea

var _yaw: float = 0.0
var _pitch: float = -0.42
var _attack_timer: float = 0.0
var _special_timer: float = 0.0
var _heal_timer: float = 0.0
var _player_model: Node3D = null
var _companion_model: Node3D = null

# Loaded KayKit adventurer (set by loader)
var _player_mesh_loaded: bool = false

const PLAYER_MODEL_BY_TYPE: Dictionary = {
	# KayKit Adventurers (installed into res://assets/models/kaykit/adventurers/)
	"fire":      "res://assets/models/kaykit/adventurers/Characters/fbx/Barbarian.fbx",
	"water":     "res://assets/models/kaykit/adventurers/Characters/fbx/Knight.fbx",
	"grass":     "res://assets/models/kaykit/adventurers/Characters/fbx/Rogue.fbx",
	"electric":  "res://assets/models/kaykit/adventurers/Characters/fbx/Mage.fbx",
	"psychic":   "res://assets/models/kaykit/adventurers/Characters/fbx/Mage.fbx",
	"dark":      "res://assets/models/kaykit/adventurers/Characters/fbx/Barbarian.fbx",
	"wind":      "res://assets/models/kaykit/adventurers/Characters/fbx/Rogue.fbx",
}

const COMPANION_MODEL_BY_MESH_KEY: Dictionary = {
	"skeleton_warrior": "res://assets/models/kaykit/skeletons/Characters/fbx/Skeleton_Warrior.fbx",
	"skeleton_archer": "res://assets/models/kaykit/skeletons/Characters/fbx/Skeleton_Minion.fbx",
	"skeleton_rogue":  "res://assets/models/kaykit/skeletons/Characters/fbx/Skeleton_Rogue.fbx",
	"skeleton_mage":   "res://assets/models/kaykit/skeletons/Characters/fbx/Skeleton_Mage.fbx",
}


func _clear_children(root: Node) -> void:
	for c in root.get_children():
		c.queue_free()


func _instantiate_model(path: String) -> Node3D:
	var res = ResourceLoader.load(path, "PackedScene")
	if OS.get_cmdline_args().has("--demo") and res == null:
		print_debug("[KayKit] Failed to load model: " + path)
	if res is PackedScene:
		return res.instantiate() as Node3D
	# Some Godot imports might return a Node3D resource directly.
	if res is Node3D:
		return (res as Node3D).duplicate() as Node3D
	return null


func _resolve_starter_element_type() -> String:
	var t: String = GameState.starter_type
	if t.is_empty():
		return "fire"
	# DB stores element type; demo/legacy may store species id.
	if PLAYER_MODEL_BY_TYPE.has(t):
		return t
	var species := SpeciesDB.get_species(t)
	if not species.is_empty():
		return species.get("type", "fire")
	return "fire"


func _ready() -> void:
	add_to_group("player")
	# Visible cursor so HUD menu buttons work; press Esc to lock/unlock for camera.
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	camera_pivot.rotation.x = _pitch
	GameState.party_changed.connect(_refresh_companion_visual)
	GameState.character_loaded.connect(_refresh_player_visual)
	_refresh_player_visual()
	_refresh_companion_visual()


func _input(event: InputEvent) -> void:
	var hud = _get_hud()
	if hud and hud.has_method("handle_menu_input") and hud.handle_menu_input(event):
		get_viewport().set_input_as_handled()
		return

	if hud and hud.has_method("is_any_panel_open") and hud.is_any_panel_open():
		return

	if event is InputEventMouseMotion and Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
		_yaw   -= event.relative.x * cam_sensitivity
		_pitch -= event.relative.y * cam_sensitivity
		_pitch  = clamp(_pitch, -1.2, 0.1)
		camera_pivot.rotation.x = _pitch
		rotation.y = _yaw

	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			cam_distance = clampf(cam_distance - 0.5, 3.2, 12.0)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			cam_distance = clampf(cam_distance + 0.5, 3.2, 12.0)

	if event.is_action_pressed("ui_cancel"):
		if Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
			Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
		else:
			Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

	if event.is_action_pressed("ability_1"):
		do_basic_attack()
	if event.is_action_pressed("ability_2"):
		do_special_attack()
	if event.is_action_pressed("ability_3"):
		do_heal_ability()


func _physics_process(delta: float) -> void:
	var hud = _get_hud()
	var ui_open: bool = (
		hud != null
		and hud.has_method("is_any_panel_open")
		and hud.is_any_panel_open()
	)

	_attack_timer = max(0.0, _attack_timer - delta)
	_special_timer = max(0.0, _special_timer - delta)
	_heal_timer = max(0.0, _heal_timer - delta)

	if not is_on_floor():
		velocity.y -= GRAVITY * delta

	if ui_open:
		velocity.x = move_toward(velocity.x, 0, SPEED)
		velocity.z = move_toward(velocity.z, 0, SPEED)
		move_and_slide()
		return

	if is_on_floor() and Input.is_action_just_pressed("jump"):
		velocity.y = JUMP_VELOCITY

	var dir = _get_input_dir()
	var speed := SPRINT_SPEED if Input.is_action_pressed("sprint") else SPEED
	if dir.length() > 0.01:
		velocity.x = dir.x * speed
		velocity.z = dir.z * speed
	else:
		velocity.x = move_toward(velocity.x, 0, SPEED)
		velocity.z = move_toward(velocity.z, 0, SPEED)

	move_and_slide()
	camera.position = Vector3(0.0, 0.35, cam_distance)

	var moving := Vector2(velocity.x, velocity.z).length() > 0.5
	if _player_model:
		if moving:
			KayKitAnimations.play_walk(_player_model)
		else:
			KayKitAnimations.play_idle(_player_model)
	if _companion_model:
		if moving:
			KayKitAnimations.play_walk(_companion_model)
		else:
			KayKitAnimations.play_idle(_companion_model)

	_try_companion_auto_attack()

	if Input.is_action_just_pressed("attack") and _attack_timer <= 0.0:
		do_basic_attack()


func _get_hud() -> Node:
	return get_tree().get_first_node_in_group("hud")


func _get_input_dir() -> Vector3:
	var fwd  = -transform.basis.z
	var right = transform.basis.x
	var d = Vector3.ZERO
	if Input.is_action_pressed("move_forward"): d += fwd
	if Input.is_action_pressed("move_back"):    d -= fwd
	if Input.is_action_pressed("move_right"):  d += right
	if Input.is_action_pressed("move_left"):   d -= right
	return d.normalized()


func do_basic_attack() -> void:
	if _attack_timer > 0.0:
		return
	_attack_timer = ATTACK_COOLDOWN
	if _player_model:
		KayKitAnimations.play_attack(_player_model)
	_perform_attack(1.0)


func do_special_attack() -> void:
	if _special_timer > 0.0:
		return
	_special_timer = SPECIAL_COOLDOWN
	if _player_model:
		KayKitAnimations.play_attack(_player_model)
	_perform_attack(1.45)


func _nearest_wild(max_range: float) -> Node:
	var best: Node = null
	var best_d: float = max_range
	for node in get_tree().get_nodes_in_group("wild_monster"):
		if not is_instance_valid(node) or not (node is Node3D):
			continue
		var d: float = global_position.distance_to((node as Node3D).global_position)
		if d < best_d:
			best_d = d
			best = node
	return best


func _perform_attack(damage_mult: float) -> void:
	var active = GameState.get_active_monster()
	if active.is_empty():
		return
	var target: Node = _nearest_wild(ATTACK_RANGE + 1.2)
	if target == null:
		for body in attack_area.get_overlapping_bodies():
			if body.is_in_group("wild_monster"):
				target = body
				break
	if target == null:
		return
	if target.has_method("receive_attack"):
		target.receive_attack(active, damage_mult)
	if _companion_model:
		KayKitAnimations.play_attack(_companion_model)
	Sfx.play_attack()


func _try_companion_auto_attack() -> void:
	if _attack_timer > 0.0:
		return
	var active = GameState.get_active_monster()
	if active.is_empty():
		return
	var target: Node = _nearest_wild(4.2)
	if target == null:
		return
	if not target.has_method("is_aggro") or not target.is_aggro():
		return
	target.receive_attack(active, 1.0)
	_attack_timer = ATTACK_COOLDOWN
	if _companion_model:
		KayKitAnimations.play_attack(_companion_model)


func do_heal_ability() -> void:
	if _heal_timer > 0.0:
		return
	var active = GameState.get_active_monster()
	if active.is_empty():
		return
	_heal_timer = HEAL_COOLDOWN
	active["hp"] = mini(active.get("max_hp", 1), active.get("hp", 0) + HEAL_AMOUNT)
	GameState.party_changed.emit()
	GameState.sync_active_hp()
	Sfx.play_heal()


func get_ability_cooldowns() -> Dictionary:
	return {
		"attack": _attack_timer,
		"special": _special_timer,
		"heal": _heal_timer,
	}


func _refresh_player_visual() -> void:
	var starter_type: String = _resolve_starter_element_type()
	var type_color: Color = SpeciesDB.get_type_color(starter_type)

	_clear_children(mesh_instance)
	var player_path: String = PLAYER_MODEL_BY_TYPE.get(
		starter_type,
		PLAYER_MODEL_BY_TYPE["fire"]
	)
	var player_model := _instantiate_model(player_path)
	if player_model != null:
		player_model.name = "KayKitPlayer"
		mesh_instance.add_child(player_model)
		_player_model = player_model
		KayKitVisuals.decorate_model(player_model, type_color, false)
	else:
		_player_model = null
		var placeholder := MeshInstance3D.new()
		var mesh := CapsuleMesh.new()
		mesh.radius = 0.35
		mesh.height = 1.2
		placeholder.mesh = mesh
		mesh_instance.add_child(placeholder)
		KayKitVisuals.decorate_model(placeholder, type_color, true)


func _refresh_companion_visual() -> void:
	if _companion_model:
		_companion_model.queue_free()
	_companion_model = null

	var active = GameState.get_active_monster()
	if active.is_empty():
		return

	var type_name: String = active.get("type", "fire")
	var type_color: Color = SpeciesDB.get_type_color(type_name)

	_clear_children(companion_socket)
	var mesh_key: String = active.get("mesh_key", "skeleton_warrior")
	var companion_path: String = COMPANION_MODEL_BY_MESH_KEY.get(mesh_key, COMPANION_MODEL_BY_MESH_KEY["skeleton_warrior"])
	var companion_model := _instantiate_model(companion_path)
	if companion_model != null:
		companion_model.name = "KayKitCompanion"
		companion_socket.add_child(companion_model)
		KayKitVisuals.decorate_model(companion_model, type_color, false)
		_companion_model = companion_model
	else:
		var placeholder := MeshInstance3D.new()
		var mesh := CapsuleMesh.new()
		mesh.radius = 0.25
		mesh.height = 0.9
		placeholder.mesh = mesh
		companion_socket.add_child(placeholder)
		KayKitVisuals.decorate_model(placeholder, type_color, true)
		_companion_model = placeholder
