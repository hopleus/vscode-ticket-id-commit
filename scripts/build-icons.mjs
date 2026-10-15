import fs from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import svg2ttf from 'svg2ttf';
import svgpath from 'svgpath';
import ttf2woff from 'ttf2woff';

const GRID = 16;
const SCALE = 100;
const EM = GRID * SCALE;

const glyphs = [{ name: 'ticket', codepoint: 0xe001, source: 'resources/icons/ticket.svg' }];

const glyphXml = glyphs.map(({ name, codepoint, source }) => {
  const svg = fs.readFileSync(source, 'utf8');
  const d = [...svg.matchAll(/\sd="([^"]+)"/g)].map((match) => match[1]).join(' ');
  const path = svgpath(d).unarc().scale(SCALE, -SCALE).translate(0, EM).round(1).toString();
  return `<glyph glyph-name="${name}" unicode="&#x${codepoint.toString(16)};" horiz-adv-x="${EM}" d="${path}"/>`;
});

const svgFont = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"><defs><font id="ticket-id-icons" horiz-adv-x="${EM}">
<font-face font-family="ticket-id-icons" units-per-em="${EM}" ascent="${EM}" descent="0"/>
<missing-glyph horiz-adv-x="0"/>
${glyphXml.join('\n')}
</font></defs></svg>`;

const ttf = svg2ttf(svgFont, { ts: 0, version: '1.0' });
fs.writeFileSync('resources/ticket-id-icons.woff', ttf2woff(new Uint8Array(ttf.buffer)));

const png = new Resvg(fs.readFileSync('resources/icons/marketplace.svg', 'utf8'), {
  fitTo: { mode: 'width', value: 256 },
}).render().asPng();
fs.writeFileSync('resources/icon.png', png);

console.log('resources/ticket-id-icons.woff, resources/icon.png');
