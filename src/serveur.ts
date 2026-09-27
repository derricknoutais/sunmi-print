import { ErreurImpression, lireEtat, lireVerdict, type EtatImprimante, type ResultatImpression } from './etat.ts';

/**
 * Le service local : la page est ouverte dans le NAVIGATEUR du terminal, et
 * l'application Sunmi Print, en service de fond, écoute sur 127.0.0.1.
 *
 * C'est le mode à préférer sur un Sunmi V2 Pro : son navigateur est un
 * Chromium 74, mais les applications Android y affichent leurs pages avec le
 * WebView système, resté en version 62 — où une application Vite ne démarre
 * pas. La page reste donc dans le navigateur, et seule l'image du reçu passe
 * par l'application.
 *
 * Une requête d'une page https vers http://127.0.0.1 n'est pas du contenu
 * mixte : l'adresse de boucle locale est tenue pour sûre. L'application ne
 * répond qu'aux origines qu'on lui a autorisées.
 */

export const PORT_PAR_DEFAUT = 17321;

export interface OptionsServeur {
    /** Port du service ; 17321 par défaut. `false` : ne pas chercher le service. */
    port?: number | false;
    /** Attente maximale de la détection, en ms ; 1 500 par défaut. */
    delaiDetection?: number;
}

function adresse(port: number, chemin: string): string {
    return `http://127.0.0.1:${port}${chemin}`;
}

/**
 * L'état de l'imprimante par le service, ou `null` s'il ne répond pas :
 * pas de service, ou page ouverte ailleurs que sur un terminal.
 */
export async function etatServeur(options: OptionsServeur = {}): Promise<EtatImprimante | null> {
    if (options.port === false) return null;
    const port = options.port || PORT_PAR_DEFAUT;

    try {
        const reponse = await avecDelai(fetch(adresse(port, '/etat'), { cache: 'no-store' }), options.delaiDetection || 1500);
        // Un refus (403) arrive avec les en-têtes CORS : la page peut dire pourquoi.
        return lireEtat(await reponse.json(), 'serveur');
    } catch {
        return null;
    }
}

/**
 * Envoie l'image PNG (base64) au service. Se résout quand le reçu est sorti,
 * se rejette avec une `ErreurImpression` sinon.
 */
export async function envoyerAuServeur(
    pngBase64: string,
    options: { port?: number | false; avance?: number; delai?: number } = {},
): Promise<ResultatImpression> {
    if (options.port === false) throw new ErreurImpression('absente', 'Service d’impression désactivé.');
    const port = options.port || PORT_PAR_DEFAUT;
    const delai = options.delai || 65000;

    let reponse: Response;
    try {
        reponse = await avecDelai(
            fetch(adresse(port, '/imprimer'), {
                method: 'POST',
                // text/plain : une requête « simple », sans pré-vérification CORS
                // — un aller-retour de moins. Le service lit le JSON quand même.
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                body: JSON.stringify({ image: pngBase64, avance: options.avance === undefined ? 3 : options.avance }),
            }),
            delai,
        );
    } catch (e) {
        if (e instanceof ErreurImpression) throw e;
        throw new ErreurImpression('absente', "Le service d'impression ne répond plus : l'application Sunmi Print est-elle ouverte ?");
    }

    let corps: unknown;
    try {
        corps = await reponse.json();
    } catch {
        throw new ErreurImpression('erreur', `Réponse illisible du service d'impression (HTTP ${reponse.status}).`);
    }
    return lireVerdict(corps);
}

/**
 * Une promesse bornée dans le temps. Pas d'AbortController : il n'existe qu'à
 * partir de Chrome 66, et le WebView des terminaux est plus ancien.
 */
function avecDelai<T>(promesse: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resoudre, rejeter) => {
        const minuteur = setTimeout(
            () => rejeter(new ErreurImpression('delai', `Le service d'impression n'a pas répondu en ${Math.round(ms / 1000)} s.`)),
            ms,
        );
        promesse.then(
            (valeur) => {
                clearTimeout(minuteur);
                resoudre(valeur);
            },
            (erreur) => {
                clearTimeout(minuteur);
                rejeter(erreur);
            },
        );
    });
}
