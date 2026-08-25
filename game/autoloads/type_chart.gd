extends Node
## Type effectiveness chart.
## strong = 1.5x, weak = 0.7x, neutral = 1.0x

# Format: { attacker_type: { defender_type: multiplier } }
const CHART: Dictionary = {
	"fire": {
		"grass": 1.5, "wind": 1.5,
		"water": 0.7, "dark": 0.7,
	},
	"water": {
		"fire": 1.5, "dark": 1.5,
		"grass": 0.7, "electric": 0.7,
	},
	"grass": {
		"water": 1.5, "electric": 1.5,
		"fire": 0.7, "wind": 0.7,
	},
	"electric": {
		"water": 1.5, "wind": 1.5,
		"grass": 0.7, "psychic": 0.7,
	},
	"psychic": {
		"electric": 1.5, "dark": 1.5,
		"wind": 0.7,
	},
	"dark": {
		"psychic": 1.5, "grass": 1.5,
		"water": 0.7, "fire": 0.7,
	},
	"wind": {
		"grass": 1.5, "psychic": 1.5,
		"electric": 0.7, "fire": 0.7,
	},
}


func get_multiplier(attacker_type: String, defender_type: String) -> float:
	if CHART.has(attacker_type) and CHART[attacker_type].has(defender_type):
		return CHART[attacker_type][defender_type]
	return 1.0


func calc_damage(base_atk: int, base_def: int,
		attacker_type: String, defender_type: String) -> int:
	var mult = get_multiplier(attacker_type, defender_type)
	var raw = max(1, base_atk - int(base_def * 0.5))
	return int(raw * mult)
