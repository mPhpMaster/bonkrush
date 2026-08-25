extends RefCounted
class_name IslandHeightmap
## Shared island height function used by fallback mesh and Terrain3D import.

const TERRAIN_SIZE: float = 170.0
const TERRAIN_AMP: float = 8.0
const SHRINE_BUMP: float = 3.5

static var _noise_a: FastNoiseLite
static var _noise_b: FastNoiseLite
static var _noise_c: FastNoiseLite


static func _ensure_noise() -> void:
	if _noise_a != null:
		return
	_noise_a = FastNoiseLite.new()
	_noise_a.noise_type = FastNoiseLite.TYPE_SIMPLEX
	_noise_a.fractal_type = FastNoiseLite.FRACTAL_FBM
	_noise_a.fractal_octaves = 5
	_noise_a.frequency = 0.018
	_noise_a.seed = 1337

	_noise_b = FastNoiseLite.new()
	_noise_b.noise_type = FastNoiseLite.TYPE_SIMPLEX
	_noise_b.fractal_type = FastNoiseLite.FRACTAL_FBM
	_noise_b.fractal_octaves = 3
	_noise_b.frequency = 0.06
	_noise_b.seed = 4242

	_noise_c = FastNoiseLite.new()
	_noise_c.noise_type = FastNoiseLite.TYPE_SIMPLEX
	_noise_c.fractal_octaves = 2
	_noise_c.frequency = 0.12
	_noise_c.seed = 9001


static func sample(x: float, z: float) -> float:
	_ensure_noise()
	var h := _noise_a.get_noise_2d(x, z) * TERRAIN_AMP
	h += _noise_b.get_noise_2d(x, z) * (TERRAIN_AMP * 0.35)
	h += _noise_c.get_noise_2d(x, z) * 1.2

	# Central shrine hill
	var shrine_dist := Vector2(x, z).length()
	h += SHRINE_BUMP * exp(-shrine_dist * shrine_dist / 900.0)

	# Island mask — playable center, beach ring, ocean drop-off
	var dist := Vector2(x, z).length() / (TERRAIN_SIZE * 0.42)
	var mask := clampf(1.0 - dist, 0.0, 1.0)
	mask = mask * mask * (3.0 - 2.0 * mask) # smoothstep
	var beach := smoothstep(0.55, 0.85, dist)
	return h * mask + beach * 0.6 - 2.2 * (1.0 - mask)


static func biome_color(x: float, z: float, height: float) -> Color:
	var dist := Vector2(x, z).length() / (TERRAIN_SIZE * 0.42)
	if dist > 0.88:
		return Color(0.62, 0.72, 0.42) # distant grass
	if height > 5.5:
		return Color(0.38, 0.36, 0.34) # rock
	if height < 0.8:
		return Color(0.78, 0.68, 0.42) # beach
	return Color(0.18, 0.48, 0.16).lerp(Color(0.32, 0.58, 0.20), clampf(height / 6.0, 0.0, 1.0))


static func build_height_image(size: int) -> Image:
	_ensure_noise()
	var img := Image.create(size, size, false, Image.FORMAT_RF)
	var half := TERRAIN_SIZE * 0.5
	for y in size:
		for x in size:
			var wx: float = lerp(-half, half, float(x) / float(size - 1))
			var wz: float = lerp(-half, half, float(y) / float(size - 1))
			var h: float = sample(wx, wz)
			img.set_pixel(x, y, Color(h, 0.0, 0.0, 1.0))
	return img
