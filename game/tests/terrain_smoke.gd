extends SceneTree

func _initialize() -> void:
	print("Terrain3D available: ", ClassDB.class_exists("Terrain3D"))
	quit()
