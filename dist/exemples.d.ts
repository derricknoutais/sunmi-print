import type { Recu } from './document.ts';
/**
 * Deux reçus prêts à imprimer : un ticket réaliste, et une mire qui éprouve
 * tout ce qu'une imprimante doit rendre. À imprimer depuis n'importe quel
 * projet pour diagnostiquer un terminal.
 */
/** Un ticket de bar-restaurant : articles, TVA 18 %, règlement, rendu, QR. */
export declare function recuExemple(): Recu;
/**
 * La mire : tailles, graisses, accents, montants, passages à la ligne,
 * séparateurs, QR — et une image en demi-teintes si on en fournit une (un
 * dégradé, pour juger la trame).
 */
export declare function mire(options?: {
    image?: string;
    largeur?: number;
}): Recu;
