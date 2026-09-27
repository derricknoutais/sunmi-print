import { niveauxDeGris } from "./tramage.js";
const ESC = 0x1b;
const GS = 0x1d;
/** Lignes par commande GS v 0 : les imprimantes d'entrée de gamme saturent au-delà. */
const BANDE = 255;
/**
 * Le reçu dessiné, en commandes ESC/POS « image tramée » (GS v 0), pour une
 * imprimante thermique autre que celle du Sunmi : réseau, Bluetooth, USB.
 *
 * Toutes comprennent cette commande, et l'image contourne leurs pages de
 * codes : les accents et « FCFA » sortent exactement comme à l'aperçu, ce que
 * du texte envoyé en UTF-8 ne garantit sur aucune.
 */
export function versEscPos(toile, options = {}) {
    const ctx = toile.getContext('2d');
    if (!ctx)
        throw new Error('Canvas 2D indisponible.');
    const gris = niveauxDeGris(ctx.getImageData(0, 0, toile.width, toile.height).data);
    return rasterEscPos((x, y) => gris[y * toile.width + x] < 128, toile.width, toile.height, options);
}
/** Les mêmes commandes, à partir de n'importe quelle source de points. */
export function rasterEscPos(estNoir, largeur, hauteur, options = {}) {
    const octetsParLigne = Math.ceil(largeur / 8);
    const sortie = [];
    if (options.initialiser !== false)
        sortie.push(ESC, 0x40);
    for (let debut = 0; debut < hauteur; debut += BANDE) {
        const lignes = Math.min(BANDE, hauteur - debut);
        // GS v 0 m xL xH yL yH : largeur en octets, hauteur en lignes.
        sortie.push(GS, 0x76, 0x30, 0x00, octetsParLigne & 0xff, octetsParLigne >> 8, lignes & 0xff, lignes >> 8);
        for (let y = debut; y < debut + lignes; y++) {
            for (let o = 0; o < octetsParLigne; o++) {
                let octet = 0;
                for (let bit = 0; bit < 8; bit++) {
                    const x = o * 8 + bit;
                    // Bit de poids fort = point le plus à gauche ; 1 = chauffer.
                    if (x < largeur && estNoir(x, y))
                        octet |= 0x80 >> bit;
                }
                sortie.push(octet);
            }
        }
    }
    // ESC d n : imprimer et avancer de n lignes, pour détacher le reçu.
    const avance = options.avance === undefined ? 4 : Math.max(0, Math.min(255, Math.round(options.avance)));
    if (avance > 0)
        sortie.push(ESC, 0x64, avance);
    return Uint8Array.from(sortie);
}
