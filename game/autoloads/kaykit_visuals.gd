extends Node
## Shared KayKit model presentation — preserve imported textures, tint placeholders only.

const TYPE_TINT_STRENGTH: float = 0.18


func decorate_model(root: Node3D, type_color: Color, is_placeholder: bool = false) -> void:
	if root == null:
		return
	fit_to_height(root, 1.65 if not is_placeholder else 1.35)
	if is_placeholder:
		_apply_placeholder_material(root, type_color)
	else:
		KayKitAnimations.play_idle(root)


func fit_to_height(root: Node3D, target: float) -> void:
	if root == null or target <= 0.0:
		return
	var tallest: float = _world_height(root)
	if tallest < 0.01:
		tallest = _local_height(root)
	if tallest < 0.01:
		return
	var s: float = target / tallest
	if not is_finite(s) or s <= 0.0:
		return
	s = clampf(s, 0.003, 12.0)
	root.scale *= Vector3(s, s, s)


func _world_height(root: Node3D) -> float:
	if not root.is_inside_tree():
		return 0.0
	var aabb := AABB()
	var any := false
	if root is VisualInstance3D:
		aabb = root.global_transform * (root as VisualInstance3D).get_aabb()
		any = true
	for n in root.find_children("*", "VisualInstance3D", true, false):
		var vi := n as VisualInstance3D
		if vi == null:
			continue
		var box: AABB = vi.global_transform * vi.get_aabb()
		if any:
			aabb = aabb.merge(box)
		else:
			aabb = box
			any = true
	return aabb.size.y if any else 0.0


func _local_height(root: Node3D) -> float:
	var tallest: float = 0.0
	if root is VisualInstance3D:
		tallest = maxf(tallest, (root as VisualInstance3D).get_aabb().size.y)
	for n in root.find_children("*", "VisualInstance3D", true, false):
		var vi := n as VisualInstance3D
		if vi:
			tallest = maxf(tallest, vi.get_aabb().size.y)
	return tallest


func _apply_type_tint(root: Node, type_color: Color) -> void:
	if root is GeometryInstance3D:
		_tint_geometry(root as GeometryInstance3D, type_color)
	for n in root.find_children("*", "GeometryInstance3D", true, false):
		if n is GeometryInstance3D:
			_tint_geometry(n as GeometryInstance3D, type_color)


func _tint_geometry(gi: GeometryInstance3D, type_color: Color) -> void:
	var mat: Material = gi.material_override
	if mat == null and gi.mesh != null and gi.mesh.get_surface_count() > 0:
		mat = gi.mesh.surface_get_material(0)
	if mat == null:
		return
	var tinted := mat.duplicate()
	if tinted is StandardMaterial3D:
		var sm := tinted as StandardMaterial3D
		sm.albedo_color = sm.albedo_color.lerp(type_color, TYPE_TINT_STRENGTH)
		gi.material_override = tinted
	elif tinted is BaseMaterial3D:
		var bm := tinted as BaseMaterial3D
		bm.albedo_color = bm.albedo_color.lerp(type_color, TYPE_TINT_STRENGTH)
		gi.material_override = tinted


func _apply_placeholder_material(root: Node, type_color: Color) -> void:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = type_color
	mat.emission_enabled = true
	mat.emission = type_color * 0.25

	if root is GeometryInstance3D:
		(root as GeometryInstance3D).material_override = mat

	for n in root.find_children("*", "GeometryInstance3D", true):
		var gi := n as GeometryInstance3D
		if gi:
			gi.material_override = mat
