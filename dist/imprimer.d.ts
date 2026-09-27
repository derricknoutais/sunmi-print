import type { Recu } from './document.ts';
import { type Environnement, type OptionsDessin, type Toile } from './dessin.ts';
import { type EtatImprimante, type ResultatImpression } from './etat.ts';
import { type OptionsServeur } from './serveur.ts';
export interface OptionsImpression extends OptionsDessin, OptionsServeur {
    /** Lignes de papier avancées après le reçu, pour le détacher à la barre ; 3 par défaut. */
    avance?: number;
    /** Attente maximale du verdict de l'imprimante, en ms ; 60 000 par défaut. */
    delai?: number;
    /** Où dessiner, hors navigateur : les tests passent celui de Node. */
    environnement?: Environnement;
}
/**
 * L'état de l'imprimante, par le chemin disponible : le pont si la page est
 * ouverte dans l'application, sinon le service local, sinon « absente ».
 */
export declare function etatImprimante(options?: OptionsServeur): Promise<EtatImprimante>;
/**
 * Dessine le reçu et l'imprime. Se résout quand il est sorti ; se rejette avec
 * une `ErreurImpression` dont le `code` dit quoi faire : `papier`, `capot`,
 * `surchauffe`, `refusee` (adresse à autoriser dans l'application), `absente`…
 */
export declare function imprimerRecu(recu: Recu, options?: OptionsImpression): Promise<ResultatImpression>;
/**
 * Le reçu tel qu'il sortira, en canvas noir et blanc. Sans recherche de
 * l'imprimante : à la largeur du pont s'il y en a un, en 58 mm sinon — un
 * aperçu ne doit pas attendre le réseau.
 */
export declare function apercuRecu(recu: Recu, options?: OptionsDessin, env?: Environnement): Promise<Toile>;
