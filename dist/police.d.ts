/**
 * La police du reçu est livrée avec le paquet, jamais prise dans le système :
 * le Mac qui affiche l'aperçu et le terminal qui imprime n'ont pas les mêmes
 * polices, et l'aperçu ne serait plus ce qui sort de l'imprimante.
 *
 * Importée statiquement, pas par `import()` : l'import dynamique n'existe
 * qu'à partir de Chrome 63, et le WebView d'un Sunmi V2 Pro est en 62. Un
 * bundler ne l'embarque de toute façon que dans le code qui dessine.
 */
export declare const FAMILLE = "Sunmi Print Roboto";
/** Charge Roboto Medium et Bold une seule fois ; renvoie le nom de la famille. */
export declare function chargerPolice(): Promise<string>;
