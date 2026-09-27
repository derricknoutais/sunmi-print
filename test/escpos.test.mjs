import { createCanvas } from '@napi-rs/canvas';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { rasterEscPos, versEscPos } from '../dist/escpos.js';

const octets = (tableau) => Array.from(tableau);

test('une image de 10 × 3 points devient ESC @, GS v 0 puis ESC d', () => {
    // Diagonale : (0,0), (1,1), et le 10e point de la 3e ligne.
    const noirs = new Set(['0,0', '1,1', '9,2']);
    const commandes = rasterEscPos((x, y) => noirs.has(`${x},${y}`), 10, 3);

    assert.deepEqual(octets(commandes), [
        0x1b, 0x40, // ESC @ : initialiser
        0x1d, 0x76, 0x30, 0x00, 0x02, 0x00, 0x03, 0x00, // GS v 0 : 2 octets par ligne, 3 lignes
        0x80, 0x00, // ligne 0 : point 0
        0x40, 0x00, // ligne 1 : point 1
        0x00, 0x40, // ligne 2 : point 9 = 2e bit du 2e octet
        0x1b, 0x64, 0x04, // ESC d 4 : avancer de 4 lignes
    ]);
});

test('une grande image est envoyée par bandes de 255 lignes au plus', () => {
    const commandes = octets(rasterEscPos(() => false, 384, 600, { initialiser: false, avance: 0 }));
    const entetes = [];
    for (let i = 0; i < commandes.length; ) {
        assert.deepEqual(commandes.slice(i, i + 4), [0x1d, 0x76, 0x30, 0x00]);
        const largeur = commandes[i + 4] + 256 * commandes[i + 5];
        const lignes = commandes[i + 6] + 256 * commandes[i + 7];
        entetes.push([largeur, lignes]);
        i += 8 + largeur * lignes;
    }
    assert.deepEqual(entetes, [[48, 255], [48, 255], [48, 90]]);
});

test('versEscPos lit les pixels d’une toile', () => {
    const toile = createCanvas(16, 1);
    const ctx = toile.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillRect(15, 0, 1, 1);

    const commandes = octets(versEscPos(toile, { initialiser: false, avance: 0 }));
    assert.deepEqual(commandes, [0x1d, 0x76, 0x30, 0x00, 0x02, 0x00, 0x01, 0x00, 0x80, 0x01]);
});
