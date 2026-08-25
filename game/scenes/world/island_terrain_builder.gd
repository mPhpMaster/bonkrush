extends RefCounted
class_name IslandTerrainBuilder
## Always builds a visible colored island mesh. Terrain3D is optional extra collision.


static func build(parent: Node3D) -> Dictionary:
	for c in parent.get_children():
		c.queue_free()
	return _build_fallback(parent)


static func _build_fallback(parent: Node3D) -> Dictionary:
	var grid: int = 80
	var half: float = IslandHeightmap.TERRAIN_SIZE * 0.5

	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)

	for i in grid:
		var x0: float = lerpf(-half, half, float(i) / float(grid))
		var x1: float = lerpf(-half, half, float(i + 1) / float(grid))
		for j in grid:
			var z0: float = lerpf(-half, half, float(j) / float(grid))
			var z1: float = lerpf(-half, half, float(j + 1) / float(grid))
			var p00 := Vector3(x0, IslandHeightmap.sample(x0, z0), z0)
			var p10 := Vector3(x1, IslandHeightmap.sample(x1, z0), z0)
			var p01 := Vector3(x0, IslandHeightmap.sample(x0, z1), z1)
			var p11 := Vector3(x1, IslandHeightmap.sample(x1, z1), z1)
			_add_colored_tri(st, p00, p10, p01)
			_add_colored_tri(st, p10, p11, p01)

	st.generate_normals()
	st.generate_tangents()
	var terrain_mesh: ArrayMesh = st.commit()

	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = "FallbackTerrainMesh"
	mesh_instance.mesh = terrain_mesh
	var noise := FastNoiseLite.new()
	noise.seed = 17
	noise.frequency = 0.04
	noise.fractal_octaves = 3
	var tex := NoiseTexture2D.new()
	tex.noise = noise
	tex.width = 256
	tex.height = 256
	tex.seamless = true
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.albedo_texture = tex
	mat.uv1_triplanar = true
	mat.uv1_triplanar_sharpness = 4.0
	mat.uv1_scale = Vector3(0.08, 0.08, 0.08)
	mat.roughness = 0.88
	mesh_instance.material_override = mat
	parent.add_child(mesh_instance)

	var shape: Shape3D = terrain_mesh.create_trimesh_shape()
	if shape:
		var body := StaticBody3D.new()
		body.name = "FallbackTerrainBody"
		body.collision_layer = 1
		body.collision_mask = 0
		var col := CollisionShape3D.new()
		col.name = "FallbackTerrainCollision"
		col.shape = shape
		body.add_child(col)
		parent.add_child(body)

	return {
		"terrain_node": mesh_instance,
		"used_terrain3d": false,
	}


static func _add_colored_tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
	var center: Vector3 = (a + b + c) / 3.0
	var col: Color = IslandHeightmap.biome_color(center.x, center.z, center.y)
	st.set_color(col)
	st.set_uv(Vector2(a.x, a.z) * 0.08)
	st.add_vertex(a)
	st.set_color(col)
	st.set_uv(Vector2(b.x, b.z) * 0.08)
	st.add_vertex(b)
	st.set_color(col)
	st.set_uv(Vector2(c.x, c.z) * 0.08)
	st.add_vertex(c)
