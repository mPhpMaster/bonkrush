extends Node
## Plays KayKit animations when available on loaded model roots.

const IDLE_KEYS: Array[String] = ["idle", "wait", "stand"]
const WALK_KEYS: Array[String] = ["walk", "run", "jog", "move"]
const ATTACK_KEYS: Array[String] = ["attack", "slash", "hit", "swing", "punch"]


func find_player(root: Node) -> AnimationPlayer:
	if root == null:
		return null
	if root is AnimationPlayer:
		return root
	for n in root.find_children("*", "AnimationPlayer", true, false):
		return n as AnimationPlayer
	return null


func play_idle(root: Node3D) -> void:
	_play_match(root, IDLE_KEYS, true)


func play_walk(root: Node3D) -> void:
	_play_match(root, WALK_KEYS, false)


func play_attack(root: Node3D) -> void:
	_play_match(root, ATTACK_KEYS, false)


func _play_match(root: Node, keys: Array, loop_idle: bool) -> void:
	var player := find_player(root)
	if player == null:
		return
	var chosen := _pick(player, keys)
	if chosen == "":
		var all: PackedStringArray = player.get_animation_list()
		if all.is_empty():
			return
		chosen = all[0]
	if player.current_animation == chosen:
		return
	player.play(chosen)
	var anim := player.get_animation(chosen)
	if anim:
		anim.loop_mode = (
			Animation.LOOP_LINEAR if loop_idle or _name_has(chosen, WALK_KEYS)
			else Animation.LOOP_NONE
		)


func _pick(player: AnimationPlayer, keys: Array) -> String:
	for anim_name in player.get_animation_list():
		var lower: String = String(anim_name).to_lower()
		for key in keys:
			if lower.contains(String(key)):
				return String(anim_name)
	return ""


func _name_has(anim_name: String, keys: Array) -> bool:
	var lower := anim_name.to_lower()
	for key in keys:
		if lower.contains(String(key)):
			return true
	return false
