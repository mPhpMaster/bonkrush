extends Control
## First-run tutorial + pause help for the playable prototype.

const STEPS: Array[String] = [
	"Move with WASD. Press Esc to lock the mouse, then look around. Mouse wheel zooms.",
	"Walk toward a wild skeleton near the blue shrine. Press 1 to attack. Your companion fights with you.",
	"Win for XP, coins, and a catch chance. Press C to add catches to your party, P to switch the active fighter.",
	"Stand on the shrine and press E to shop potions. Friends: same website account + leaderboard.",
]


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	UiTheme.apply(self)
	_build()


func _build() -> void:
	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.02, 0.06, 0.72)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.gui_input.connect(_on_dim)
	add_child(dim)

	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.custom_minimum_size = Vector2(560, 420)
	panel.position = Vector2(0, 0)
	add_child(panel)
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	panel.offset_left = -280.0
	panel.offset_right = 280.0
	panel.offset_top = -220.0
	panel.offset_bottom = 220.0

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	panel.add_child(vbox)

	var title := Label.new()
	title.text = "How to play — prototype"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 22)
	vbox.add_child(title)

	for i in STEPS.size():
		var row := Label.new()
		row.text = str(i + 1) + ".  " + STEPS[i]
		row.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		row.custom_minimum_size = Vector2(520, 0)
		vbox.add_child(row)

	var hint := Label.new()
	hint.text = "web-pi-lilac-20.vercel.app/leaderboard"
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.modulate = Color(0.85, 0.78, 0.45)
	vbox.add_child(hint)

	var btn := Button.new()
	btn.text = "Let's go"
	btn.custom_minimum_size = Vector2(180, 42)
	btn.pressed.connect(_close)
	vbox.add_child(btn)


func _on_dim(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		_close()


func _close() -> void:
	GameState.tutorial_done = true
	DemoSave.save_now()
	queue_free()
