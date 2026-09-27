import { type EtatImprimante, type ResultatImpression } from './etat.ts';
/**
 * Le pont direct : la page est ouverte DANS l'application Sunmi Print, qui
 * l'affiche dans sa WebView et lui injecte `window.SunmiImpression`. Ses
 * réponses, asynchrones, reviennent par `window.__sunmiPrint.retour`.
 */
/** Version du protocole entre la page et l'application. */
export declare const VERSION_PONT = "1";
/** Vrai si la page est ouverte dans l'application Sunmi Print. */
export declare function pontDisponible(): boolean;
/** Version du protocole annoncée par l'application, ou `null` hors application. */
export declare function versionPont(): string | null;
/** L'état de l'imprimante par le pont — synchrone, c'est un appel direct. */
export declare function etatPont(): EtatImprimante;
/**
 * Envoie une image PNG (base64, sans le préfixe `data:`) par le pont. Se
 * résout quand le reçu est SORTI — l'application imprime en mode transaction
 * et attend le verdict de l'imprimante.
 */
export declare function envoyerParPont(pngBase64: string, options?: {
    avance?: number;
    delai?: number;
}): Promise<ResultatImpression>;
