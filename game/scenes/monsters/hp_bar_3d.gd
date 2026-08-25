extends Node3D
## Billboarded HP bar above monsters.

var _label: Label3D
var _bar_bg: MeshInstance3D
var _bar_fg: MeshInstance3D
var _max_hp: int = 1
var _current_hp: int = 1


func _ready() -> void:
	_build_bar()


func _build_bar() -> void:
	# Background
	_bar_bg = MeshInstance3D.new()
	var bg_mesh = QuadMesh.new()
	bg_mesh.size = Vector2(1.2, 0.15)
	_bar_bg.mesh = bg_mesh
	var bg_mat = StandardMaterial3D.new()
	bg_mat.albedo_color = Color(0.1, 0.1, 0.1, 0.8)
	bg_mat.flags_unshaded = true
	bg_mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	_bar_bg.material_override = bg_mat
	add_child(_bar_bg)

	# Foreground
	_bar_fg = MeshInstance3D.new()
	var fg_mesh = QuadMesh.new()
	fg_mesh.size = Vector2(1.2, 0.15)
	_bar_fg.mesh = fg_mesh
	var fg_mat = StandardMaterial3D.new()
	fg_mat.albedo_color = Color(0.1, 0.85, 0.2, 1.0)
	fg_mat.flags_unshaded = true
	fg_mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	_bar_fg.material_override = fg_mat
	_bar_fg.position.z = 0.001
	add_child(_bar_fg)

	# Label
	_label = Label3D.new()
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.font_size = 18
	_label.outline_size = 4
	_label.position.y = 0.2
	add_child(_label)


func setup(current: int, maximum: int, label_text: String) -> void:
	_max_hp = maximum
	_current_hp = current
	if _label:
		_label.text = label_text
	_update_bar()


func update(current: int, maximum: int) -> void:
	_current_hp = current
	_max_hp = maximum
	_update_bar()


func flash_red() -> void:
	if not _bar_fg:
		return
	var mat = _bar_fg.material_override as StandardMaterial3D
	if mat:
		mat.albedo_color = Color(1.0, 0.1, 0.1)
		await get_tree().create_timer(0.15).timeout
		_update_bar()


func _update_bar() -> void:
	var pct = float(_current_hp) / float(max(1, _max_hp))
	if _bar_fg:
		_bar_fg.scale.x = pct
		_bar_fg.position.x = -(1.0 - pct) * 0.6
		var mat = _bar_fg.material_override as StandardMaterial3D
		if mat:
			if pct > 0.5:
				mat.albedo_color = Color(0.1, 0.85, 0.2)
			elif pct > 0.25:
				mat.albedo_color = Color(1.0, 0.7, 0.0)
			else:
				mat.albedo_color = Color(0.9, 0.1, 0.1)
