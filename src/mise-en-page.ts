import type { Alignement, Recu } from './document.ts';
import { boiteDeLigne, policeCss, TAILLES } from './metriques.ts';
import { matriceQr } from './qr.ts';
import { couperEnLignes } from './texte.ts';

/**
 * La mise en page d'un reçu : où poser chaque texte, chaque trait, chaque
 * module de QR — en points entiers, pour que rien ne tombe entre deux points
 * de la tête d'impression.
 *
 * Séparée du dessin pour être testée sans navigateur : il suffit de lui
 * donner une fonction qui mesure un texte.
 */

export interface OptionsMiseEnPage {
    /** Largeur imprimable en points : 384 en 58 mm, 576 en 80 mm. */
    largeur: number;
    /** Blanc gardé de chaque côté, en points. */
    marge: number;
    /** Famille de police déjà chargée par l'appelant. */
    famille: string;
    mesurer: (texte: string, police: string) => number;
    /** Dimensions naturelles des images du reçu, déjà chargées. */
    dimensionsImage?: (source: string) => { largeur: number; hauteur: number } | undefined;
}

export type Operation =
    | { type: 'texte'; texte: string; x: number; ligneDeBase: number; police: string }
    | { type: 'rectangle'; x: number; y: number; largeur: number; hauteur: number }
    | { type: 'qr'; x: number; y: number; module: number; matrice: boolean[][] }
    | { type: 'image'; source: string; x: number; y: number; largeur: number; hauteur: number; tramage: 'diffusion' | 'seuil' };

export interface MiseEnPage {
    largeur: number;
    hauteur: number;
    operations: Operation[];
}

const ESPACE_PAR_DEFAUT = 16;
const QR_PAR_DEFAUT = 176;
/** Zone blanche autour d'un QR, en modules, de chaque côté. */
const ZONE_CALME = 2;
/** En deçà de 2 points par module, les lecteurs décrochent sur papier thermique. */
const MODULE_MIN = 2;

export function mettreEnPage(recu: Recu, o: OptionsMiseEnPage): MiseEnPage {
    const utile = o.largeur - 2 * o.marge;
    if (utile <= 0) throw new Error(`Largeur utile nulle : largeur ${o.largeur}, marge ${o.marge}.`);

    const operations: Operation[] = [];
    let y = 0;

    const aligner = (largeur: number, alignement: Alignement): number => {
        if (alignement === 'centre') return o.marge + Math.round((utile - largeur) / 2);
        if (alignement === 'droite') return o.marge + utile - Math.ceil(largeur);
        return o.marge;
    };

    for (const bloc of recu.blocs) {
        switch (bloc.type) {
            case 'texte': {
                const taille = bloc.taille || 'normale';
                const police = policeCss(taille, !!bloc.gras, o.famille);
                const boite = boiteDeLigne(taille);
                const mesurer = (t: string) => o.mesurer(t, police);

                for (const ligne of couperEnLignes(bloc.texte, utile, mesurer)) {
                    if (ligne !== '') {
                        const x = aligner(mesurer(ligne), bloc.alignement || 'gauche');
                        operations.push({ type: 'texte', texte: ligne, x, ligneDeBase: y + boite.ligneDeBase, police });
                    }
                    y += boite.hauteur;
                }
                break;
            }

            case 'ligne': {
                const taille = bloc.taille || 'normale';
                const police = policeCss(taille, !!bloc.gras, o.famille);
                const boite = boiteDeLigne(taille);
                const mesurer = (t: string) => o.mesurer(t, police);
                const droite = bloc.droite || '';
                const largeurDroite = droite === '' ? 0 : Math.ceil(mesurer(droite));
                const ecart = droite === '' ? 0 : Math.round(TAILLES[taille] / 2);
                const poser = (texte: string, x: number) => {
                    if (texte !== '') operations.push({ type: 'texte', texte, x, ligneDeBase: y + boite.ligneDeBase, police });
                };

                // Deux dispositions, et la plus courte l'emporte :
                //  - en colonne : le montant sur la première ligne, le libellé
                //    dans la place qui reste — la lecture d'un ticket ;
                //  - en pleine largeur : le libellé sur toute la ligne, le montant
                //    au bout de sa dernière ligne, ou dessous s'il n'y tient pas.
                // Un gros montant ne hache ainsi plus un long libellé en tronçons.
                const pourLeLibelle = utile - largeurDroite - ecart;
                const enColonne = droite !== '' && pourLeLibelle >= utile * 0.4 ? couperEnLignes(bloc.gauche, pourLeLibelle, mesurer) : null;
                const pleineLargeur = couperEnLignes(bloc.gauche, utile, mesurer);
                const derniere = pleineLargeur[pleineLargeur.length - 1] || '';
                const auBout = droite === '' || mesurer(derniere) + ecart + largeurDroite <= utile;
                const lignesDuMontant = auBout ? [] : couperEnLignes(droite, utile, mesurer);

                if (enColonne && enColonne.length <= pleineLargeur.length + lignesDuMontant.length) {
                    enColonne.forEach((ligne, i) => {
                        poser(ligne, o.marge);
                        if (i === 0) poser(droite, o.marge + utile - largeurDroite);
                        y += boite.hauteur;
                    });
                    break;
                }

                pleineLargeur.forEach((ligne, i) => {
                    poser(ligne, o.marge);
                    if (auBout && i === pleineLargeur.length - 1) poser(droite, o.marge + utile - largeurDroite);
                    y += boite.hauteur;
                });
                for (const ligne of lignesDuMontant) {
                    poser(ligne, aligner(mesurer(ligne), 'droite'));
                    y += boite.hauteur;
                }
                break;
            }

            case 'separateur': {
                const hauteur = 16;
                const epaisseur = 2;
                const style = bloc.style || 'tirets';

                if (style === 'plein') {
                    operations.push({ type: 'rectangle', x: o.marge, y: y + 7, largeur: utile, hauteur: epaisseur });
                } else if (style === 'double') {
                    operations.push({ type: 'rectangle', x: o.marge, y: y + 5, largeur: utile, hauteur: epaisseur });
                    operations.push({ type: 'rectangle', x: o.marge, y: y + 9, largeur: utile, hauteur: epaisseur });
                } else {
                    for (let x = 0; x < utile; x += 12) {
                        operations.push({ type: 'rectangle', x: o.marge + x, y: y + 7, largeur: Math.min(8, utile - x), hauteur: epaisseur });
                    }
                }
                y += hauteur;
                break;
            }

            case 'espace':
                y += Math.max(0, Math.round(bloc.hauteur === undefined ? ESPACE_PAR_DEFAUT : bloc.hauteur));
                break;

            case 'qr': {
                const matrice = matriceQr(bloc.donnees, bloc.correction || 'M');
                const cote = matrice.length + 2 * ZONE_CALME;
                const cible = Math.min(bloc.taille || QR_PAR_DEFAUT, utile);
                // Des modules entiers, jamais moins de deux points — quitte à
                // dépasser la taille visée plutôt que de rendre le code illisible.
                let module = Math.max(MODULE_MIN, Math.floor(cible / cote));
                if (module * cote > utile) module = Math.max(1, Math.floor(utile / cote));

                const x = aligner(module * cote, bloc.alignement || 'centre');
                operations.push({ type: 'qr', x: x + ZONE_CALME * module, y: y + ZONE_CALME * module, module, matrice });
                y += module * cote;
                break;
            }

            case 'image': {
                const dimensions = o.dimensionsImage ? o.dimensionsImage(bloc.source) : undefined;
                if (!dimensions || dimensions.largeur <= 0 || dimensions.hauteur <= 0) {
                    throw new Error(`Image non chargée : ${bloc.source.slice(0, 80)}`);
                }
                const largeur = Math.min(Math.round(bloc.largeur || dimensions.largeur), utile);
                const hauteur = Math.max(1, Math.round((dimensions.hauteur * largeur) / dimensions.largeur));
                const x = aligner(largeur, bloc.alignement || 'centre');
                operations.push({ type: 'image', source: bloc.source, x, y, largeur, hauteur, tramage: bloc.tramage || 'diffusion' });
                y += hauteur;
                break;
            }

            default:
                throw new Error(`Bloc inconnu : ${JSON.stringify((bloc as { type?: unknown }).type)}`);
        }
    }

    return { largeur: o.largeur, hauteur: Math.max(1, y), operations };
}
