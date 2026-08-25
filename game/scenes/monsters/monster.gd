extends CharacterBody3D
## Shared wild monster scene. Configured by WildSpawnManager.

signal died(monster: Node)
signal attacked_player(monster: Node)

const SPEED: float = 3.5
const AGGRO_RANGE: float = 8.0
const ATTACK_RANGE: float = 2.0
const ATTACK_COOLDOWN: float = 1.2
const GRAVITY: float = 9.8
const WANDER_INTERVAL: float = 4.0
const PLAYER_DAMAGE_BASE: int = 8

# Set by spawn manager
var species_id: String = "emberling"
var species_name: String = "Emberling"
var monster_type: String = "fire"
var mesh_key: String = "skeleton_warrior"
var wild_level: int = 1
var hp: int = 30
var max_hp: int = 30
var attack_power: int = 10
var defense: int = 5

const SKELETON_MODEL_BY_MESH_KEY: Dictionary = {
	"skeleton_warrior": "res://assets/models/kaykit/skeletons/Characters/fbx/Skeleton_Warrior.fbx",
	"skeleton_archer": "res://assets/models/kaykit/skeletons/Characters/fbx/Skeleton_Minion.fbx",
	"skeleton_rogue":  "res://assets/models/kaykit/skeletons/Characters/fbx/Skeleton_Rogue.fbx",
	"skeleton_mage":   "res://assets/models/kaykit/skeletons/Characters/fbx/Skeleton_Mage.fbx",
}

var _player: Node = null
var _state: String = "wander"   # wander | chase | attack | dead
var _wander_timer: float = 0.0
var _wander_target: Vector3 = Vector3.ZERO
var _attack_timer: float = 0.0
var _spawn_pos: Vector3 = Vector3.ZERO
var _model_root: Node3D = null

@onready var mesh_holder: Node3D = $MeshHolder
@onready var hp_bar: Node = $HPBar3D
@onready var detection_area: Area3D = $DetectionArea


func _ready() -> void:
	_spawn_pos = global_position
	_pick_wander_target()
	_player = get_tree().get_first_node_in_group("player")
	detection_area.body_entered.connect(_on_body_entered)
	detection_area.body_exited.connect(_on_body_exited)
	_apply_visuals()


func setup(data: Dictionary) -> void:
	species_id   = data.get("species_id", "emberling")
	wild_level   = data.get("level", 1)
	var species  = SpeciesDB.get_species(species_id)
	species_name = species.get("name", "Monster")
	monster_type = species.get("type", "fire")
	mesh_key     = species.get("mesh_key", "skeleton_warrior")
	var stats    = SpeciesDB.calc_stats(species_id, wild_level)
	max_hp       = stats.get("max_hp", 30)
	hp           = max_hp
	attack_power = stats.get("attack", 10)
	defense      = stats.get("defense", 5)
	add_to_group("wild_monster")
	_apply_visuals()


func _apply_visuals() -> void:
	var type_color: Color = SpeciesDB.get_type_color(monster_type)

	var model_path: String = SKELETON_MODEL_BY_MESH_KEY.get(
		mesh_key,
		SKELETON_MODEL_BY_MESH_KEY["skeleton_warrior"]
	)
	var res = ResourceLoader.load(model_path, "PackedScene")
	if OS.get_cmdline_args().has("--demo") and res == null:
		print_debug("[KayKit] Failed to load skeleton: " + model_path)
	var placeholders: Array = mesh_holder.get_children()
	var placed := false

	if res is PackedScene:
		var inst := (res as PackedScene).instantiate() as Node3D
		if inst:
			for c in placeholders:
				c.queue_free()
			mesh_holder.add_child(inst)
			_model_root = inst
			KayKitVisuals.decorate_model(inst, type_color, false)
			placed = true

	if not placed:
		for c in placeholders:
			if c is GeometryInstance3D:
				KayKitVisuals.decorate_model(c, type_color, true)
	if hp_bar:
		hp_bar.setup(hp, max_hp, species_name + " Lv." + str(wild_level))


func _physics_process(delta: float) -> void:
	if _state == "dead":
		return

	if not is_on_floor():
		velocity.y -= GRAVITY * delta

	_attack_timer = max(0.0, _attack_timer - delta)

	match _state:
		"wander":   _do_wander(delta)
		"chase":    _do_chase(delta)
		"attack":   _do_attack_state(delta)

	move_and_slide()

	var world = get_tree().get_first_node_in_group("world")
	if world and world.has_method("get_ground_height"):
		var gy: float = world.get_ground_height(global_position.x, global_position.z)
		if is_finite(gy):
			global_position.y = gy + 0.5

	if _model_root:
		var moving := Vector2(velocity.x, velocity.z).length() > 0.3
		if _state == "attack":
			KayKitAnimations.play_attack(_model_root)
		elif moving:
			KayKitAnimations.play_walk(_model_root)
		else:
			KayKitAnimations.play_idle(_model_root)


func _do_wander(delta: float) -> void:
	_wander_timer -= delta
	if _wander_timer <= 0.0:
		_pick_wander_target()

	var dir = (_wander_target - global_position)
	dir.y = 0.0
	if dir.length() > 0.5:
		velocity.x = dir.normalized().x * SPEED * 0.5
		velocity.z = dir.normalized().z * SPEED * 0.5
	else:
		velocity.x = 0.0
		velocity.z = 0.0


func _do_chase(delta: float) -> void:
	if not is_instance_valid(_player):
		_state = "wander"
		return
	var dist = global_position.distance_to(_player.global_position)
	if dist > AGGRO_RANGE * 1.5:
		_state = "wander"
		return
	if dist <= ATTACK_RANGE:
		_state = "attack"
		return
	var dir = (_player.global_position - global_position)
	dir.y = 0.0
	if dir.length() > 0.05:
		velocity.x = dir.normalized().x * SPEED
		velocity.z = dir.normalized().z * SPEED
		var look_target: Vector3 = Vector3(_player.global_position.x, global_position.y, _player.global_position.z)
		if global_position.distance_to(look_target) > 0.05:
			look_at(look_target, Vector3.UP)
	else:
		velocity.x = 0.0
		velocity.z = 0.0


func _do_attack_state(_delta: float) -> void:
	if not is_instance_valid(_player):
		_state = "wander"
		return
	var dist = global_position.distance_to(_player.global_position)
	if dist > ATTACK_RANGE:
		_state = "chase"
		return
	if _attack_timer <= 0.0:
		_attack_timer = ATTACK_COOLDOWN
		attacked_player.emit(self)
		_deal_damage_to_player()


func _deal_damage_to_player() -> void:
	var world = get_tree().get_first_node_in_group("world")
	if world and world.has_method("is_fainting") and world.is_fainting():
		return
	var active = GameState.get_active_monster()
	if active.is_empty():
		return
	var raw = max(1, attack_power - int(active.get("defense", 0) * 0.5))
	active["hp"] = max(0, active.get("hp", 0) - raw)
	GameState.party_changed.emit()
	GameState.sync_active_hp()

	var hud = get_tree().get_first_node_in_group("hud")
	if hud and hud.has_method("flash_damage"):
		hud.flash_damage()

	if active["hp"] <= 0:
		_handle_player_faint()


func reset_aggro() -> void:
	if _state != "dead":
		_state = "wander"
		velocity = Vector3.ZERO


func _handle_player_faint() -> void:
	var world = get_tree().get_first_node_in_group("world")
	if world and world.has_method("handle_player_faint"):
		world.handle_player_faint()


func is_aggro() -> bool:
	return _state in ["chase", "attack"]


func receive_attack(attacker_monster: Dictionary, damage_mult: float = 1.0) -> void:
	if _state == "dead":
		return
	var dmg = TypeChart.calc_damage(
		attacker_monster.get("attack", 10),
		defense,
		attacker_monster.get("type", "fire"),
		monster_type
	)
	var type_mult := TypeChart.get_multiplier(
		attacker_monster.get("type", "fire"),
		monster_type
	)
	dmg = maxi(1, int(dmg * damage_mult))
	hp = max(0, hp - dmg)
	Sfx.play_hit()
	_spawn_damage_popup(dmg, type_mult)
	_show_type_feedback(type_mult)
	if hp_bar:
		hp_bar.update(hp, max_hp)
		if hp_bar.has_method("flash_red"):
			hp_bar.flash_red()
	if hp <= 0:
		_die()


func _spawn_damage_popup(dmg: int, type_mult: float) -> void:
	var lbl := Label3D.new()
	lbl.text = str(dmg)
	lbl.font_size = 42
	lbl.outline_size = 8
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	if type_mult > 1.0:
		lbl.modulate = Color(1.0, 0.85, 0.2)
		lbl.text = str(dmg) + "!"
	elif type_mult < 1.0:
		lbl.modulate = Color(0.65, 0.75, 0.95)
	else:
		lbl.modulate = Color(1.0, 0.95, 0.9)
	lbl.position = Vector3(0.0, 1.8, 0.0)
	add_child(lbl)
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(lbl, "position:y", 2.6, 0.7)
	tween.tween_property(lbl, "modulate:a", 0.0, 0.7)
	tween.chain().tween_callback(lbl.queue_free)


func _show_type_feedback(mult: float) -> void:
	if absf(mult - 1.0) < 0.01:
		return
	var hud = get_tree().get_first_node_in_group("hud")
	if hud == null or not hud.has_method("_show_status"):
		return
	if mult > 1.0:
		hud._show_status("Super effective!")
	elif mult < 1.0:
		hud._show_status("Not very effective…")


func _die() -> void:
	_state = "dead"
	died.emit(self)
	$CollisionShape3D.disabled = true
	var tween := create_tween()
	tween.set_parallel(true)
	for c in mesh_holder.get_children():
		tween.tween_property(c, "scale", Vector3(0.01, 0.01, 0.01), 0.8)
	tween.chain().tween_callback(queue_free)


func _pick_wander_target() -> void:
	_wander_timer = WANDER_INTERVAL
	var angle = randf() * TAU
	var dist  = randf_range(2.0, 10.0)
	_wander_target = _spawn_pos + Vector3(cos(angle) * dist, 0, sin(angle) * dist)


func _on_body_entered(body: Node) -> void:
	if body.is_in_group("player") and _state == "wander":
		_state = "chase"
		_player = body


func _on_body_exited(body: Node) -> void:
	if not body.is_in_group("player") or _state not in ["chase", "attack"]:
		return
	if global_position.distance_to(body.global_position) > AGGRO_RANGE * 1.5:
		_state = "wander"
