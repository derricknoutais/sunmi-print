/** Largeurs imprimables, en points : 48 mm sur un rouleau de 58 mm, 72 mm sur 80 mm. */
export const LARGEUR_58MM = 384;
export const LARGEUR_80MM = 576;
/**
 * Corps de chaque taille, en points. Le texte « normale » (24 points, 3 mm)
 * a la hauteur de la police native des imprimantes thermiques ; en dessous
 * de 20, les jambages fins se perdent à la chauffe.
 */
export const TAILLES = {
    petite: 20,
    normale: 24,
    grande: 32,
    titre: 40,
};
/**
 * Medium plutôt que Regular : sur papier thermique, un trait d'un seul point
 * sort gris et s'efface ; le Medium tient ses traits à deux points dès le
 * corps 24.
 */
export const POIDS_NORMAL = 500;
export const POIDS_GRAS = 700;
export const INTERLIGNE = 1.25;
/**
 * Métriques verticales de Roboto (table hhea : 1900 et 500 sur 2048), en em.
 * La ligne de base est placée par le calcul, pas par le moteur de rendu :
 * l'aperçu du bureau et le terminal posent ainsi chaque ligne au même point.
 */
export const ASCENDANTE = 0.9277;
export const DESCENDANTE = 0.2441;
export function policeCss(taille, gras, famille) {
    return `${gras ? POIDS_GRAS : POIDS_NORMAL} ${TAILLES[taille]}px "${famille}"`;
}
/** Hauteur d'une ligne de texte et position de sa ligne de base, en points. */
export function boiteDeLigne(taille) {
    const corps = TAILLES[taille];
    const hauteur = Math.round(corps * INTERLIGNE);
    const ligneDeBase = Math.round((hauteur - (ASCENDANTE + DESCENDANTE) * corps) / 2 + ASCENDANTE * corps);
    return { hauteur, ligneDeBase };
}
