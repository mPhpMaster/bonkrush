extends Node
## Procedural SFX — no external audio files required.

var _player: AudioStreamPlayer


func _ready() -> void:
	_player = AudioStreamPlayer.new()
	add_child(_player)


func play_attack() -> void:
	_play_tone(440.0, 0.08, -8.0)


func play_hit() -> void:
	_play_tone(220.0, 0.12, -10.0)


func play_catch(success: bool) -> void:
	if success:
		_play_tone(660.0, 0.15, -6.0)
	else:
		_play_tone(180.0, 0.25, -12.0)


func play_heal() -> void:
	_play_tone(523.0, 0.1, -8.0)


func play_coin() -> void:
	_play_tone(987.0, 0.06, -10.0)


func play_ui() -> void:
	_play_tone(350.0, 0.05, -14.0)


func _play_tone(freq: float, duration: float, db: float = -8.0) -> void:
	var sample_rate := 22050
	var sample_count := int(sample_rate * duration)
	var data := PackedVector2Array()
	data.resize(sample_count)
	for i in sample_count:
		var t := float(i) / float(sample_rate)
		var env := 1.0 - (float(i) / float(sample_count))
		var s := sin(TAU * freq * t) * env
		data[i] = Vector2(s, s)

	var stream := AudioStreamGenerator.new()
	stream.mix_rate = sample_rate
	stream.buffer_length = duration + 0.05

	_player.stream = stream
	_player.volume_db = db
	_player.play()

	var playback: AudioStreamGeneratorPlayback = _player.get_stream_playback()
	if playback:
		playback.push_buffer(data)
