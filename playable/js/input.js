(function (SA) {
  'use strict';
  var input = { held: {}, pressed: {}, mouse: { x: 0, y: 0, down: false, pressed: false } };
  function clear() { input.held = {}; input.pressed = {}; input.mouse.down = false; input.mouse.pressed = false; }
  function install(canvas, dispatch) {
    document.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      var k = e.key.toLowerCase(); input.held[k] = true; input.pressed[k] = true;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0 && document.activeElement === canvas) e.preventDefault();
      dispatch('key', k, e);
    });
    document.addEventListener('keyup', function (e) { delete input.held[e.key.toLowerCase()]; });
    canvas.addEventListener('pointermove', function (e) { var r = canvas.getBoundingClientRect(); input.mouse.x = (e.clientX - r.left) * canvas.width / r.width; input.mouse.y = (e.clientY - r.top) * canvas.height / r.height; });
    canvas.addEventListener('pointerdown', function (e) { if (e.button === 0) { input.mouse.down = true; input.mouse.pressed = true; canvas.focus(); } });
    window.addEventListener('pointerup', function () { input.mouse.down = false; });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); dispatch('cancel'); });
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', function () { if (document.hidden) clear(); });
  }
  function finishStep() { input.pressed = {}; input.mouse.pressed = false; }
  SA.Input = { state: input, install: install, clear: clear, finishStep: finishStep };
}(window.StarAbyss = window.StarAbyss || {}));
