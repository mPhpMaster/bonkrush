extends Node
## Shared RPG theme: dark panels, gold accents, readable HUD.

var theme: Theme


func _ready() -> void:
	theme = _build_theme()


func apply(root: Node) -> void:
	if not theme:
		return
	if root is Control:
		(root as Control).theme = theme


func make_hud_card() -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.05, 0.07, 0.12, 0.82)
	box.border_color = Color(0.85, 0.68, 0.28, 0.85)
	box.set_border_width_all(1)
	box.set_corner_radius_all(10)
	box.content_margin_left = 12
	box.content_margin_right = 12
	box.content_margin_top = 10
	box.content_margin_bottom = 10
	box.shadow_color = Color(0, 0, 0, 0.45)
	box.shadow_size = 6
	return box


func _build_theme() -> Theme:
	var t := Theme.new()

	var panel := StyleBoxFlat.new()
	panel.bg_color = Color(0.07, 0.08, 0.14, 0.96)
	panel.border_color = Color(0.82, 0.64, 0.26, 1.0)
	panel.set_border_width_all(2)
	panel.set_corner_radius_all(12)
	panel.content_margin_left = 16
	panel.content_margin_right = 16
	panel.content_margin_top = 16
	panel.content_margin_bottom = 16
	panel.shadow_color = Color(0, 0, 0, 0.5)
	panel.shadow_size = 10
	t.set_stylebox("panel", "PanelContainer", panel)

	var btn_normal := StyleBoxFlat.new()
	btn_normal.bg_color = Color(0.16, 0.2, 0.32, 1.0)
	btn_normal.border_color = Color(0.78, 0.62, 0.28, 0.9)
	btn_normal.set_border_width_all(1)
	btn_normal.set_corner_radius_all(8)
	btn_normal.content_margin_left = 14
	btn_normal.content_margin_right = 14
	btn_normal.content_margin_top = 8
	btn_normal.content_margin_bottom = 8

	var btn_hover := btn_normal.duplicate()
	btn_hover.bg_color = Color(0.24, 0.3, 0.46, 1.0)
	btn_hover.border_color = Color(0.95, 0.82, 0.4, 1.0)

	var btn_pressed := btn_normal.duplicate()
	btn_pressed.bg_color = Color(0.12, 0.16, 0.26, 1.0)

	var btn_disabled := btn_normal.duplicate()
	btn_disabled.bg_color = Color(0.1, 0.11, 0.16, 1.0)
	btn_disabled.border_color = Color(0.35, 0.35, 0.4, 1.0)

	t.set_stylebox("normal", "Button", btn_normal)
	t.set_stylebox("hover", "Button", btn_hover)
	t.set_stylebox("pressed", "Button", btn_pressed)
	t.set_stylebox("focus", "Button", btn_hover)
	t.set_stylebox("disabled", "Button", btn_disabled)
	t.set_color("font_color", "Button", Color(0.96, 0.94, 0.88, 1.0))
	t.set_color("font_hover_color", "Button", Color(1.0, 0.96, 0.78, 1.0))
	t.set_color("font_disabled_color", "Button", Color(0.55, 0.55, 0.6, 1.0))
	t.set_font_size("font_size", "Button", 14)

	var line_edit := StyleBoxFlat.new()
	line_edit.bg_color = Color(0.04, 0.05, 0.09, 1.0)
	line_edit.border_color = Color(0.55, 0.48, 0.28, 1.0)
	line_edit.set_border_width_all(1)
	line_edit.set_corner_radius_all(8)
	line_edit.content_margin_left = 12
	line_edit.content_margin_right = 12
	line_edit.content_margin_top = 10
	line_edit.content_margin_bottom = 10
	t.set_stylebox("normal", "LineEdit", line_edit)
	t.set_stylebox("focus", "LineEdit", line_edit)
	t.set_color("font_color", "LineEdit", Color(0.95, 0.96, 1.0))
	t.set_color("font_placeholder_color", "LineEdit", Color(0.55, 0.58, 0.7))
	t.set_font_size("font_size", "LineEdit", 15)

	t.set_color("font_color", "Label", Color(0.93, 0.93, 0.9))
	t.set_font_size("font_size", "Label", 14)

	var progress := StyleBoxFlat.new()
	progress.bg_color = Color(0.08, 0.09, 0.14, 1.0)
	progress.set_corner_radius_all(5)
	t.set_stylebox("background", "ProgressBar", progress)
	var progress_fill := StyleBoxFlat.new()
	progress_fill.bg_color = Color(0.86, 0.68, 0.22, 1.0)
	progress_fill.set_corner_radius_all(5)
	t.set_stylebox("fill", "ProgressBar", progress_fill)
	t.set_color("font_color", "ProgressBar", Color(0.1, 0.1, 0.12, 1.0))

	var sep := StyleBoxLine.new()
	sep.color = Color(0.72, 0.58, 0.24, 0.55)
	sep.thickness = 1
	t.set_stylebox("separator", "HSeparator", sep)

	return t
