extends Node3D
## BasePod — Escape pod that serves as the player's spawn point and home base.
## Features an orange blinking light to indicate a safe zone.

@onready var flicker_light: OmniLight3D = $FlickerLight

var _blink_timer: float = 0.0
var _blink_interval: float = 1.5  # Seconds between blinks
var _blink_duration: float = 0.3  # How long light is on during blink
var _is_blinking: bool = false

func _ready() -> void:
	# Start with light off
	if flicker_light:
		flicker_light.light_energy = 0.0


func _process(delta: float) -> void:
	if not flicker_light:
		return
	
	_blink_timer += delta
	
	if _is_blinking:
		# Currently in blink - check if it should end
		if _blink_timer >= _blink_duration:
			flicker_light.light_energy = 0.0
			_is_blinking = false
			_blink_timer = 0.0
	else:
		# Waiting for next blink
		if _blink_timer >= _blink_interval:
			# Start blink
			flicker_light.light_energy = 1.2
			_is_blinking = true
			_blink_timer = 0.0
