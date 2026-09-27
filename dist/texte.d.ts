/** Largeur d'un texte en points, dans la police du moment. */
export type Mesure = (texte: string) => number;
/**
 * Coupe un texte en lignes qui tiennent dans `largeurMax`.
 *
 * Les mots vont à la ligne entiers ; un mot plus long que la ligne — une
 * référence, une URL — est coupé où il déborde, plutôt que de sortir du
 * papier. Les espaces de tête d'un paragraphe sont gardés (« ␣␣2 × 500 »
 * reste en retrait), mais une ligne de continuation ne commence jamais par
 * une espace.
 */
export declare function couperEnLignes(texte: string, largeurMax: number, mesurer: Mesure): string[];
