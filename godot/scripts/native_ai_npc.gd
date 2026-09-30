extends RefCounted
class_name NativeAINpc

# A small authored camp routine. The clock is local gameplay time in seconds.
const ROUTINE_SECONDS := 240.0
const ALARM_SECONDS := 35.0

var talks := 0
var surveyed := false
var witnessed_combat := false
var alarm_until := -1000.0
var last_talk_at := -1000.0
var last_combat_at := -1000.0

func purpose(now: float) -> String:
	if now < alarm_until:
		return "avoid"
	var phase := fposmod(now, ROUTINE_SECONDS)
	if phase < 110.0:
		return "repair"
	if phase < 170.0:
		return "inspect"
	return "rest"

func observe_event(kind: String, now: float, visible: bool) -> bool:
	if not visible or not is_finite(now):
		return false
	match kind:
		"combat":
			if now - last_combat_at < 5.0:
				return false
			last_combat_at = now
			witnessed_combat = true
			alarm_until = maxf(alarm_until, now + ALARM_SECONDS)
		"survey":
			surveyed = true
		_:
			return false
	return true

func interact(now: float, visible: bool, distance: float) -> Dictionary:
	if not visible or distance > 3.2 or distance < 0.0 or not is_finite(distance):
		return {"handled": false}
	talks = mini(talks + 1, 1000)
	last_talk_at = now
	var line := "我在检修工作台。返回信标在前方，先调查它。"
	if purpose(now) == "inspect":
		line = "我正在检查返回信标，留意它的记录。"
	elif purpose(now) == "rest":
		line = "我在医务站前短暂休整，之后继续巡检。"
	if now < alarm_until:
		line = "刚才的战斗我看到了。先让我确认营地安全。"
	elif surveyed and witnessed_combat:
		line = "信标已记录。之前的战斗我也看到了，我会继续巡检营地。"
	elif surveyed:
		line = "信标记录收到了。我会继续检查工作台和供电。"
	elif witnessed_combat:
		line = "之前的战斗我看到了。请留意营地周围的情况。"
	elif talks > 1:
		line = "又见面了。我的巡检路线是工作台、信标和医务站。"
	return {"handled": true, "text": "营地技师：" + line, "purpose": purpose(now)}

func snapshot() -> Dictionary:
	return {"talks": talks, "surveyed": surveyed, "witnessed_combat": witnessed_combat}

func restore(data: Dictionary) -> void:
	talks = clampi(int(data.get("talks", 0)), 0, 1000)
	surveyed = bool(data.get("surveyed", false))
	witnessed_combat = bool(data.get("witnessed_combat", false))
	alarm_until = -1000.0
	last_talk_at = -1000.0
	last_combat_at = -1000.0
