/**
 * Espace insécable, entre les milliers comme avant la devise : un montant ne
 * se coupe jamais d'une ligne à l'autre. Pas l'espace fine des typographes —
 * deux points de large à 203 dpi, « 25 000 » s'imprimait presque « 25000 ».
 */
const INSECABLE = '\u00a0';

/**
 * 12000 → « 12 000 FCFA ».
 *
 * Écrit à la main plutôt que par `Intl.NumberFormat` : le résultat de ce
 * dernier dépend des données ICU du navigateur — celles du WebView Chrome 74
 * d'un terminal ne sont pas celles d'un Chrome récent — et un reçu doit
 * sortir pareil partout.
 */
export function montant(valeur: number, devise = 'FCFA', decimales = 0): string {
    if (!isFinite(valeur)) throw new Error(`Montant invalide : ${valeur}`);

    const facteur = Math.pow(10, decimales);
    const arrondi = Math.round(Math.abs(valeur) * facteur) / facteur;
    const [entier, fraction] = arrondi.toFixed(decimales).split('.');
    const nombre = entier.replace(/\B(?=(\d{3})+(?!\d))/g, INSECABLE) + (fraction ? `,${fraction}` : '');
    // Pas de « −0 » : un montant arrondi à zéro n'a pas de signe.
    const signe = valeur < 0 && arrondi !== 0 ? '\u2212' : '';

    return signe + nombre + (devise ? INSECABLE + devise : '');
}
