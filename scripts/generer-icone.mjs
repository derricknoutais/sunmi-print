#!/usr/bin/env node
/**
 * L'icône de l'application Android, en PNG à chaque densité d'écran.
 *
 *   node scripts/generer-icone.mjs
 *
 * Des PNG plutôt qu'une icône vectorielle : le lanceur d'Android 7.1 des
 * Sunmi V2 Pro ne connaît pas les icônes adaptatives.
 */
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DENSITES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const res = fileURLToPath(new URL('../android/app/src/main/res/', import.meta.url));

function dessiner(taille) {
    const toile = createCanvas(taille, taille);
    const ctx = toile.getContext('2d');
    const u = taille / 48;

    // Fond : carré arrondi, la couleur d'accent des écrans de scan.
    ctx.fillStyle = '#115e6b';
    ctx.beginPath();
    ctx.roundRect(2 * u, 2 * u, 44 * u, 44 * u, 10 * u);
    ctx.fill();

    // Un ticket, bord bas en dents de scie.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(14 * u, 9 * u);
    ctx.lineTo(34 * u, 9 * u);
    ctx.lineTo(34 * u, 37 * u);
    for (let i = 0; i < 5; i++) {
        ctx.lineTo((32 - 4 * i) * u, 39 * u);
        ctx.lineTo((30 - 4 * i) * u, 37 * u);
    }
    ctx.closePath();
    ctx.fill();

    // Les lignes du ticket, et le total plus appuyé.
    ctx.fillStyle = '#115e6b';
    for (const [y, largeur, epaisseur] of [[14, 14, 2], [19, 10, 2], [24, 14, 2], [30, 14, 3]]) {
        ctx.fillRect(17 * u, y * u, largeur * u, epaisseur * u);
    }
    return toile.toBuffer('image/png');
}

for (const [densite, taille] of Object.entries(DENSITES)) {
    mkdirSync(`${res}mipmap-${densite}`, { recursive: true });
    writeFileSync(`${res}mipmap-${densite}/icone.png`, dessiner(taille));
}
console.log(`  ✓ icône → res/mipmap-*/icone.png (${Object.keys(DENSITES).join(', ')})`);
