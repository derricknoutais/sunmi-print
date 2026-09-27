var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { dessinerRecu } from "./dessin.js";
import { ErreurImpression, etatAbsente } from "./etat.js";
import { LARGEUR_58MM } from "./metriques.js";
import { envoyerParPont, etatPont, pontDisponible } from "./pont.js";
import { envoyerAuServeur, etatServeur } from "./serveur.js";
/**
 * L'état de l'imprimante, par le chemin disponible : le pont si la page est
 * ouverte dans l'application, sinon le service local, sinon « absente ».
 */
export function etatImprimante() {
    return __awaiter(this, arguments, void 0, function* (options = {}) {
        if (pontDisponible())
            return etatPont();
        return (yield etatServeur(options)) || etatAbsente();
    });
}
/**
 * Dessine le reçu et l'imprime. Se résout quand il est sorti ; se rejette avec
 * une `ErreurImpression` dont le `code` dit quoi faire : `papier`, `capot`,
 * `surchauffe`, `refusee` (adresse à autoriser dans l'application), `absente`…
 */
export function imprimerRecu(recu_1) {
    return __awaiter(this, arguments, void 0, function* (recu, options = {}) {
        // Vérifié AVANT de dessiner : inutile de faire attendre le caissier pour
        // lui dire ensuite qu'il n'y a plus de papier.
        const etat = yield etatImprimante(options);
        if (!etat.transport || (etat.code !== 'prete' && etat.code !== 'simulation')) {
            throw new ErreurImpression(etat.code, etat.message);
        }
        const toile = yield dessinerRecu(recu, Object.assign(Object.assign({}, options), { largeur: options.largeur || etat.largeur }), options.environnement);
        const png = toile.toDataURL('image/png');
        const donnees = png.slice(png.indexOf(',') + 1);
        return etat.transport === 'pont'
            ? envoyerParPont(donnees, { avance: options.avance, delai: options.delai })
            : envoyerAuServeur(donnees, { port: options.port, avance: options.avance, delai: options.delai });
    });
}
/**
 * Le reçu tel qu'il sortira, en canvas noir et blanc. Sans recherche de
 * l'imprimante : à la largeur du pont s'il y en a un, en 58 mm sinon — un
 * aperçu ne doit pas attendre le réseau.
 */
export function apercuRecu(recu, options = {}, env) {
    const largeur = options.largeur || (pontDisponible() ? etatPont().largeur : LARGEUR_58MM);
    return dessinerRecu(recu, Object.assign(Object.assign({}, options), { largeur }), env);
}
