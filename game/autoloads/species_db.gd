extends Node
## Local species database. Mirrors monster_species table seed.
## Used for offline stat calculation; always validate server-side too.

const TYPE_COLORS: Dictionary = {
	"fire":     Color(1.0,  0.25, 0.1,  1.0),
	"water":    Color(0.1,  0.45, 1.0,  1.0),
	"grass":    Color(0.15, 0.75, 0.2,  1.0),
	"electric": Color(1.0,  0.9,  0.05, 1.0),
	"psychic":  Color(0.9,  0.1,  0.85, 1.0),
	"dark":     Color(0.25, 0.05, 0.45, 1.0),
	"wind":     Color(0.75, 0.95, 1.0,  1.0),
}

const SPECIES: Dictionary = {
	"emberling": {
		"id":           "emberling",
		"name":         "Emberling",
		"type":         "fire",
		"mesh_key":     "skeleton_warrior",
		"catch_rate":   0.65,
		"base_hp":      55,
		"base_attack":  25,
		"base_defense": 12,
		"base_speed":   20,
	},
	"aquafin": {
		"id":           "aquafin",
		"name":         "Aquafin",
		"type":         "water",
		"mesh_key":     "skeleton_archer",
		"catch_rate":   0.60,
		"base_hp":      60,
		"base_attack":  18,
		"base_defense": 20,
		"base_speed":   16,
	},
	"leafkin": {
		"id":           "leafkin",
		"name":         "Leafkin",
		"type":         "grass",
		"mesh_key":     "skeleton_rogue",
		"catch_rate":   0.70,
		"base_hp":      58,
		"base_attack":  20,
		"base_defense": 18,
		"base_speed":   18,
	},
	"sparkit": {
		"id":           "sparkit",
		"name":         "Sparkit",
		"type":         "electric",
		"mesh_key":     "skeleton_mage",
		"catch_rate":   0.55,
		"base_hp":      50,
		"base_attack":  28,
		"base_defense": 10,
		"base_speed":   24,
	},
	"mindwisp": {
		"id":           "mindwisp",
		"name":         "Mindwisp",
		"type":         "psychic",
		"mesh_key":     "skeleton_mage",
		"catch_rate":   0.50,
		"base_hp":      52,
		"base_attack":  26,
		"base_defense": 14,
		"base_speed":   22,
	},
	"shadeclaw": {
		"id":           "shadeclaw",
		"name":         "Shadeclaw",
		"type":         "dark",
		"mesh_key":     "skeleton_rogue",
		"catch_rate":   0.45,
		"base_hp":      65,
		"base_attack":  22,
		"base_defense": 22,
		"base_speed":   14,
	},
	"galehart": {
		"id":           "galehart",
		"name":         "Galehart",
		"type":         "wind",
		"mesh_key":     "skeleton_archer",
		"catch_rate":   0.60,
		"base_hp":      54,
		"base_attack":  21,
		"base_defense": 16,
		"base_speed":   26,
	},
}


func get_species(id: String) -> Dictionary:
	return SPECIES.get(id, {})


func get_all() -> Array:
	return SPECIES.values()


func get_type_color(type_name: String) -> Color:
	return TYPE_COLORS.get(type_name, Color.WHITE)


func calc_stats(species_id: String, level: int) -> Dictionary:
	var s = get_species(species_id)
	if s.is_empty():
		return {}
	var f = 1.0 + 0.08 * (level - 1)
	return {
		"max_hp":   int(s["base_hp"]      * f),
		"attack":   int(s["base_attack"]  * f),
		"defense":  int(s["base_defense"] * f),
		"speed":    int(s["base_speed"]   * f),
	}
