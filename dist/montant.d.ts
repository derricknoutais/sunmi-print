/**
 * 12000 → « 12 000 FCFA ».
 *
 * Écrit à la main plutôt que par `Intl.NumberFormat` : le résultat de ce
 * dernier dépend des données ICU du navigateur — celles du WebView Chrome 74
 * d'un terminal ne sont pas celles d'un Chrome récent — et un reçu doit
 * sortir pareil partout.
 */
export declare function montant(valeur: number, devise?: string, decimales?: number): string;
