import type { Taille } from './document.ts';
/** Largeurs imprimables, en points : 48 mm sur un rouleau de 58 mm, 72 mm sur 80 mm. */
export declare const LARGEUR_58MM = 384;
export declare const LARGEUR_80MM = 576;
/**
 * Corps de chaque taille, en points. Le texte « normale » (24 points, 3 mm)
 * a la hauteur de la police native des imprimantes thermiques ; en dessous
 * de 20, les jambages fins se perdent à la chauffe.
 */
export declare const TAILLES: Record<Taille, number>;
/**
 * Medium plutôt que Regular : sur papier thermique, un trait d'un seul point
 * sort gris et s'efface ; le Medium tient ses traits à deux points dès le
 * corps 24.
 */
export declare const POIDS_NORMAL = 500;
export declare const POIDS_GRAS = 700;
export declare const INTERLIGNE = 1.25;
/**
 * Métriques verticales de Roboto (table hhea : 1900 et 500 sur 2048), en em.
 * La ligne de base est placée par le calcul, pas par le moteur de rendu :
 * l'aperçu du bureau et le terminal posent ainsi chaque ligne au même point.
 */
export declare const ASCENDANTE = 0.9277;
export declare const DESCENDANTE = 0.2441;
export declare function policeCss(taille: Taille, gras: boolean, famille: string): string;
/** Hauteur d'une ligne de texte et position de sa ligne de base, en points. */
export declare function boiteDeLigne(taille: Taille): {
    hauteur: number;
    ligneDeBase: number;
};
