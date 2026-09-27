import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAMILLE } from '../dist/police.js';

/**
 * Le dessin sous Node : le canvas de Skia (@napi-rs/canvas) à la place de
 * celui du navigateur — le même moteur que Chrome —, et la police du paquet
 * enregistrée depuis ses fichiers au lieu de FontFace.
 */
let policeEnregistree = false;

export function environnementNode() {
    return {
        creerToile: (largeur, hauteur) => createCanvas(largeur, hauteur),
        chargerImage: (source) => loadImage(source),
        async famille() {
            if (!policeEnregistree) {
                for (const poids of ['500', '700']) {
                    const fichier = fileURLToPath(new URL(`../polices/roboto-latin-${poids}-normal.woff2`, import.meta.url));
                    if (!GlobalFonts.registerFromPath(fichier, FAMILLE)) throw new Error(`Police non chargée : ${fichier}`);
                }
                policeEnregistree = true;
            }
            return FAMILLE;
        },
    };
}

/** Un dégradé horizontal noir → blanc, en URL data:, pour éprouver la trame. */
export function degrade(largeur = 300, hauteur = 60) {
    const toile = createCanvas(largeur, hauteur);
    const ctx = toile.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, largeur, 0);
    g.addColorStop(0, '#000');
    g.addColorStop(1, '#fff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, largeur, hauteur);
    return toile.toDataURL('image/png');
}

/** Pixels d'une toile en niveaux de gris (canal rouge : l'image est noir et blanc). */
export function gris(toile) {
    const { data } = toile.getContext('2d').getImageData(0, 0, toile.width, toile.height);
    const g = new Uint8ClampedArray(toile.width * toile.height);
    for (let i = 0; i < g.length; i++) g[i] = data[4 * i];
    return g;
}

/**
 * Enregistre un aperçu PNG si SUNMI_PRINT_APERCUS désigne un dossier — pour
 * regarder de ses yeux ce que les tests dessinent. Rien n'est écrit sinon.
 */
export function garderApercu(nom, toile) {
    const dossier = process.env.SUNMI_PRINT_APERCUS;
    if (!dossier) return;
    mkdirSync(dossier, { recursive: true });
    writeFileSync(join(dossier, `${nom}.png`), toile.toBuffer('image/png'));
}
