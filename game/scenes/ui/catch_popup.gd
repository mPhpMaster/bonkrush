extends Control

@onready var message_label: Label = $Panel/VBox/Message
@onready var close_btn: Button = $Panel/VBox/CloseBtn


func _ready() -> void:
	UiTheme.apply(self)
	hide()


func show_result(wild_data: Dictionary, success: bool) -> void:
	var species_name: String = "Monster"
	if wild_data.has("species_id"):
		species_name = SpeciesDB.get_species(wild_data["species_id"]).get("name", "Monster")
	if success:
		message_label.text = "You caught " + species_name + "!\nAdded to your collection. Press [C] to view."
		message_label.modulate = Color(0.2, 1.0, 0.4)
	elif wild_data.get("already_caught", false):
		message_label.text = species_name + " was already caught.\n+10 coins and +20 XP awarded."
		message_label.modulate = Color(0.8, 0.8, 0.2)
	else:
		message_label.text = species_name + " got away…"
		message_label.modulate = Color(1.0, 0.5, 0.2)
	show()
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	get_tree().create_timer(4.0).timeout.connect(_on_close_btn_pressed)


func _on_close_btn_pressed() -> void:
	if is_queued_for_deletion():
		return
	queue_free()
