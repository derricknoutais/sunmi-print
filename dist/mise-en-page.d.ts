import type { Recu } from './document.ts';
/**
 * La mise en page d'un reçu : où poser chaque texte, chaque trait, chaque
 * module de QR — en points entiers, pour que rien ne tombe entre deux points
 * de la tête d'impression.
 *
 * Séparée du dessin pour être testée sans navigateur : il suffit de lui
 * donner une fonction qui mesure un texte.
 */
export interface OptionsMiseEnPage {
    /** Largeur imprimable en points : 384 en 58 mm, 576 en 80 mm. */
    largeur: number;
    /** Blanc gardé de chaque côté, en points. */
    marge: number;
    /** Famille de police déjà chargée par l'appelant. */
    famille: string;
    mesurer: (texte: string, police: string) => number;
    /** Dimensions naturelles des images du reçu, déjà chargées. */
    dimensionsImage?: (source: string) => {
        largeur: number;
        hauteur: number;
    } | undefined;
}
export type Operation = {
    type: 'texte';
    texte: string;
    x: number;
    ligneDeBase: number;
    police: string;
} | {
    type: 'rectangle';
    x: number;
    y: number;
    largeur: number;
    hauteur: number;
} | {
    type: 'qr';
    x: number;
    y: number;
    module: number;
    matrice: boolean[][];
} | {
    type: 'image';
    source: string;
    x: number;
    y: number;
    largeur: number;
    hauteur: number;
    tramage: 'diffusion' | 'seuil';
};
export interface MiseEnPage {
    largeur: number;
    hauteur: number;
    operations: Operation[];
}
export declare function mettreEnPage(recu: Recu, o: OptionsMiseEnPage): MiseEnPage;
