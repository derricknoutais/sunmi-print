import { ROBOTO_500, ROBOTO_700 } from './police-donnees.ts';

/**
 * La police du reçu est livrée avec le paquet, jamais prise dans le système :
 * le Mac qui affiche l'aperçu et le terminal qui imprime n'ont pas les mêmes
 * polices, et l'aperçu ne serait plus ce qui sort de l'imprimante.
 *
 * Importée statiquement, pas par `import()` : l'import dynamique n'existe
 * qu'à partir de Chrome 63, et le WebView d'un Sunmi V2 Pro est en 62. Un
 * bundler ne l'embarque de toute façon que dans le code qui dessine.
 */
export const FAMILLE = 'Sunmi Print Roboto';

let chargement: Promise<string> | null = null;

/** Charge Roboto Medium et Bold une seule fois ; renvoie le nom de la famille. */
export function chargerPolice(): Promise<string> {
    if (!chargement) {
        chargement = Promise.all([ajouter(ROBOTO_500, '500'), ajouter(ROBOTO_700, '700')]).then(() => FAMILLE);
        // Un échec ne doit pas rester en cache : la prochaine impression retentera.
        chargement.catch(() => {
            chargement = null;
        });
    }
    return chargement;
}

function ajouter(base64: string, poids: string): Promise<void> {
    const binaire = atob(base64);
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);

    const face = new FontFace(FAMILLE, octets.buffer, { weight: poids, style: 'normal' });
    return face.load().then((chargee) => {
        document.fonts.add(chargee);
    });
}
