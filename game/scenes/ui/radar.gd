extends Control
## Mini radar: player center, shrine gold, wild monsters red.

const RANGE: float = 45.0


func _ready() -> void:
	custom_minimum_size = Vector2(132, 132)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	var rect := Rect2(Vector2.ZERO, size)
	draw_rect(rect, Color(0.04, 0.06, 0.1, 0.72), true)
	draw_rect(rect, Color(0.82, 0.64, 0.26, 0.7), false, 1.5)
	var center: Vector2 = size * 0.5
	draw_circle(center, 3.5, Color(0.95, 0.92, 0.7))
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if player == null:
		return
	var yaw: float = player.rotation.y
	var shrine := get_tree().get_first_node_in_group("world")
	if shrine and shrine.has_node("Shrine"):
		var sp: Node3D = shrine.get_node("Shrine") as Node3D
		if sp:
			_draw_rel(player, sp.global_position, Color(0.35, 0.85, 1.0), 3.5, yaw)
	for node in get_tree().get_nodes_in_group("wild_monster"):
		if node is Node3D:
			_draw_rel(player, (node as Node3D).global_position, Color(0.95, 0.28, 0.28), 2.6, yaw)


func _draw_rel(player: Node3D, world_pos: Vector3, color: Color, radius: float, yaw: float) -> void:
	var offset: Vector3 = world_pos - player.global_position
	var local := Vector2(offset.x, offset.z).rotated(-yaw)
	var scale_px: float = (size.x * 0.5 - 8.0) / RANGE
	var p: Vector2 = size * 0.5 + local * scale_px
	p.x = clampf(p.x, 4.0, size.x - 4.0)
	p.y = clampf(p.y, 4.0, size.y - 4.0)
	draw_circle(p, radius, color)


func _process(_delta: float) -> void:
	queue_redraw()
