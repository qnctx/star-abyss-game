import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlightHUD} from '../src/flight-hud.mjs';

class Classes {
  values = new Set();
  toggle(name, force) {
    if (force === undefined ? !this.values.has(name) : force) this.values.add(name);
    else this.values.delete(name);
  }
  contains(name) { return this.values.has(name); }
}

class Element {
  children = [];
  attributes = new Map();
  listeners = new Map();
  classList = new Classes();
  hidden = false;
  textContent = '';
  constructor(tagName) { this.tagName = tagName; }
  append(...children) { for (const child of children) { this.children.push(child); child.parent = this; } }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  removeEventListener(name) { this.listeners.delete(name); }
  click() { this.listeners.get('click')?.({stopPropagation() {}}); }
  querySelector(selector) { return selector === '.objective' ? this.objective : null; }
}

function fakeDocument() {
  const head = new Element('head');
  const body = new Element('body');
  const hud = new Element('section');
  const objective = new Element('aside');
  const mobility = new Element('div');
  hud.objective = objective;
  hud.append(objective, mobility);
  return {
    head, body, hud, objective, mobility,
    createElement: tag => new Element(tag),
    getElementById(id) {
      if (id === 'hud') return hud;
      if (id === 'mobility-status') return mobility;
      if (id === 'flight-hud-style') return head.children.find(child => child.id === id);
      return null;
    },
  };
}

test('flight HUD uses live planet fields, expands task details, and restores ground UI', () => {
  const doc = fakeDocument();
  const flight = createFlightHUD(doc);
  const {toggle, readout, altitude, speed, energy, controls} = flight.elements;
  assert.equal(doc.head.children.length, 1);
  assert.equal(doc.head.children[0].href, './css/flight-hud.css');
  assert.equal(toggle.hidden, true);
  assert.equal(readout.hidden, true);

  flight.update({active:true, agl:1999.8, maxAgl:2000, speed:173.4, energy:62.6, verticalSpeed:0});
  assert.equal(doc.body.classList.contains('flight-active'), true);
  assert.equal(toggle.hidden, false);
  assert.equal(readout.hidden, false);
  assert.match(altitude.textContent, /2,000 \/ 2,000 米/);
  assert.equal(speed.textContent, '常规航速 173 米/秒');
  assert.equal(energy.textContent, '灵息 63% · 悬停');
  assert.match(controls.textContent, /C 降.*V 视角/);
  toggle.click();
  assert.equal(doc.body.classList.contains('flight-objective-expanded'), true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');

  flight.update({active:true, agl:120, maxAgl:2000, speed:48.3, energy:44.2, verticalSpeed:-2,boosting:true});
  assert.equal(speed.textContent, '加速航速 48 米/秒');
  assert.equal(energy.textContent, '灵息 44% · 下降');
  flight.update({active:false});
  assert.equal(doc.body.classList.contains('flight-active'), false);
  assert.equal(doc.body.classList.contains('flight-objective-expanded'), false);
  assert.equal(toggle.hidden, true);
  assert.equal(readout.hidden, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  flight.destroy();
  assert.equal(doc.objective.children.includes(toggle), false);
  assert.equal(doc.mobility.children.includes(readout), false);
});

test('HUD visibility gates flight mode and unavailable data is not invented', () => {
  const doc = fakeDocument();
  const flight = createFlightHUD(doc);
  doc.hud.hidden = true;
  flight.update({active:true, agl:150, maxAgl:2000, speed:50, energy:60});
  assert.equal(doc.body.classList.contains('flight-active'), false);
  doc.hud.hidden = false;
  flight.update({active:true});
  assert.equal(flight.elements.speed.textContent, '常规航速 — 米/秒');
  assert.equal(flight.elements.altitude.textContent, '离地 — / — 米');
  assert.equal(flight.elements.energy.textContent, '灵息 —% · 状态未知');
});
