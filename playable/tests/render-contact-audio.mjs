// Optional listening QA: node playable/tests/render-contact-audio.mjs
// Four 4-second sections: outdoor dust, gravel, rock, then indoor metal. Each
// section has two walking contacts, two running contacts, then one landing.
// No production assets are generated or required by the game.
import fs from 'node:fs';
import path from 'node:path';
import { synthesizeFootstep } from '../src/footstep-audio.mjs';

const sampleRate = 48000, samples = new Float32Array(sampleRate * 16);
const surfaces = ['dust', 'gravel', 'rock', 'metal'];
for (let section = 0; section < surfaces.length; section++) {
  for (let step = 0; step < 5; step++) {
    const sound = synthesizeFootstep({
      type: step === 4 ? 'land' : 'step', foot: step % 2 ? 1 : -1, surface: surfaces[section], indoor: section === 3,
      speed: step < 2 ? 4.7 : 8.6, intensity: step < 2 ? .55 : step === 4 ? 1.4 : 1.1, stanceId: section * 10 + step,
    }, { sampleRate });
    const offset = Math.floor((section * 4 + [.15, .8, 1.6, 1.94, 2.8][step]) * sampleRate);
    for (let i = 0; i < sound.samples.length; i++) samples[offset + i] += sound.samples[i] * .64;
  }
}
const output = path.resolve('playable/test-artifacts/contact-materials.wav');
const buffer = Buffer.alloc(44 + samples.length * 2);
buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
buffer.write('data', 36); buffer.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++) buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, buffer);
console.log(`Listening QA: ${output}\n0s dust; 4s gravel; 8s rock; 12s indoor metal. Not a physical acoustic simulation or a listening-quality assertion.`);
