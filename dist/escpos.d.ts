import type { Toile } from './dessin.ts';
/**
 * Le reçu dessiné, en commandes ESC/POS « image tramée » (GS v 0), pour une
 * imprimante thermique autre que celle du Sunmi : réseau, Bluetooth, USB.
 *
 * Toutes comprennent cette commande, et l'image contourne leurs pages de
 * codes : les accents et « FCFA » sortent exactement comme à l'aperçu, ce que
 * du texte envoyé en UTF-8 ne garantit sur aucune.
 */
export declare function versEscPos(toile: Toile, options?: {
    avance?: number;
    initialiser?: boolean;
}): Uint8Array;
/** Les mêmes commandes, à partir de n'importe quelle source de points. */
export declare function rasterEscPos(estNoir: (x: number, y: number) => boolean, largeur: number, hauteur: number, options?: {
    avance?: number;
    initialiser?: boolean;
}): Uint8Array;
