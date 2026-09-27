import { ErreurImpression, etatAbsente, lireEtat, lireVerdict, type EtatImprimante, type ResultatImpression } from './etat.ts';

/**
 * Le pont direct : la page est ouverte DANS l'application Sunmi Print, qui
 * l'affiche dans sa WebView et lui injecte `window.SunmiImpression`. Ses
 * réponses, asynchrones, reviennent par `window.__sunmiPrint.retour`.
 */

/** Version du protocole entre la page et l'application. */
export const VERSION_PONT = '1';

interface PontNatif {
    version(): string;
    etat(): string;
    imprimer(id: string, pngBase64: string, options: string): void;
}

interface Attente {
    resoudre: (resultat: ResultatImpression) => void;
    rejeter: (erreur: Error) => void;
    minuteur: ReturnType<typeof setTimeout>;
}

/**
 * Les attentes vivent sur `window`, pas dans ce module : si deux copies du
 * paquet cohabitent dans une page (deux bundles), une réponse doit retrouver
 * la promesse de l'une comme de l'autre.
 */
interface Retours {
    attentes: Map<string, Attente>;
    retour(id: string, resultat: string): void;
}

type FenetreAvecPont = Window & { SunmiImpression?: PontNatif; __sunmiPrint?: Retours };

function fenetre(): FenetreAvecPont | null {
    return typeof window === 'undefined' ? null : (window as FenetreAvecPont);
}

function pont(): PontNatif | null {
    const f = fenetre();
    return f && f.SunmiImpression ? f.SunmiImpression : null;
}

/** Vrai si la page est ouverte dans l'application Sunmi Print. */
export function pontDisponible(): boolean {
    return pont() !== null;
}

/** Version du protocole annoncée par l'application, ou `null` hors application. */
export function versionPont(): string | null {
    const p = pont();
    return p ? String(p.version()) : null;
}

/** L'état de l'imprimante par le pont — synchrone, c'est un appel direct. */
export function etatPont(): EtatImprimante {
    const p = pont();
    if (!p) return etatAbsente();
    try {
        return lireEtat(JSON.parse(p.etat()), 'pont');
    } catch (e) {
        return lireEtat({ code: 'erreur', message: `Réponse illisible de l'application : ${String(e)}` }, 'pont');
    }
}

let compteur = 0;

/**
 * Envoie une image PNG (base64, sans le préfixe `data:`) par le pont. Se
 * résout quand le reçu est SORTI — l'application imprime en mode transaction
 * et attend le verdict de l'imprimante.
 */
export function envoyerParPont(pngBase64: string, options: { avance?: number; delai?: number } = {}): Promise<ResultatImpression> {
    const f = fenetre();
    const p = pont();
    if (!f || !p) return Promise.reject(new ErreurImpression('absente', etatAbsente().message));

    const retours = installerRetours(f);
    const id = `i${Date.now().toString(36)}-${++compteur}`;
    const delai = options.delai || 60000;

    return new Promise<ResultatImpression>((resoudre, rejeter) => {
        const minuteur = setTimeout(() => {
            retours.attentes.delete(id);
            rejeter(new ErreurImpression('delai', `L'imprimante n'a pas répondu en ${Math.round(delai / 1000)} s.`));
        }, delai);
        retours.attentes.set(id, { resoudre, rejeter, minuteur });

        try {
            p.imprimer(id, pngBase64, JSON.stringify({ avance: options.avance === undefined ? 3 : options.avance }));
        } catch (e) {
            clearTimeout(minuteur);
            retours.attentes.delete(id);
            rejeter(new ErreurImpression('erreur', `L'application a refusé l'impression : ${e instanceof Error ? e.message : String(e)}`));
        }
    });
}

function installerRetours(f: FenetreAvecPont): Retours {
    if (!f.__sunmiPrint) {
        const attentes = new Map<string, Attente>();
        f.__sunmiPrint = {
            attentes,
            retour(id, resultat) {
                const attente = attentes.get(id);
                // Réponse arrivée après le délai : la promesse est déjà rejetée.
                if (!attente) return;
                attentes.delete(id);
                clearTimeout(attente.minuteur);

                try {
                    attente.resoudre(lireVerdict(JSON.parse(resultat)));
                } catch (e) {
                    attente.rejeter(e instanceof ErreurImpression ? e : new ErreurImpression('erreur', "Réponse illisible de l'application."));
                }
            },
        };
    }
    return f.__sunmiPrint;
}
