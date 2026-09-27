/**
 * Un reçu, décrit comme une suite de blocs.
 *
 * Rien que des objets simples, sérialisables en JSON : le serveur peut
 * composer le reçu (un contrôleur Laravel qui le passe en prop Inertia) aussi
 * bien que la page. Les dimensions s'expriment en POINTS d'imprimante : à
 * 203 dpi, 1 point = 1/8 mm, et une imprimante 58 mm en compte 384 de large.
 */
export type Alignement = 'gauche' | 'centre' | 'droite';
/** 20, 24, 32 et 40 points de corps : de 2,5 à 5 mm. */
export type Taille = 'petite' | 'normale' | 'grande' | 'titre';
export interface BlocTexte {
    type: 'texte';
    /** Passe à la ligne tout seul ; `\n` force un retour. */
    texte: string;
    alignement?: Alignement;
    taille?: Taille;
    gras?: boolean;
}
/**
 * Une ligne de ticket : le libellé à gauche, qui passe à la ligne s'il est
 * trop long ; le montant à droite, jamais coupé.
 */
export interface BlocLigne {
    type: 'ligne';
    gauche: string;
    droite?: string;
    taille?: Taille;
    gras?: boolean;
}
export interface BlocSeparateur {
    type: 'separateur';
    style?: 'tirets' | 'plein' | 'double';
}
export interface BlocEspace {
    type: 'espace';
    /** En points ; 16 (2 mm) par défaut. */
    hauteur?: number;
}
export interface BlocQr {
    type: 'qr';
    donnees: string;
    /** Largeur visée en points, zone blanche comprise ; 176 (22 mm) par défaut. */
    taille?: number;
    alignement?: Alignement;
    /** Redondance : L 7 %, M 15 % (défaut), Q 25 %, H 30 %. */
    correction?: 'L' | 'M' | 'Q' | 'H';
}
export interface BlocImage {
    type: 'image';
    /**
     * Une URL de même origine, ou une URL `data:`. Une image d'une autre
     * origine sans en-têtes CORS rendrait le dessin illisible : le navigateur
     * interdit alors de relire ses pixels.
     */
    source: string;
    /** En points ; par défaut la largeur de l'image, bornée à la largeur utile. */
    largeur?: number;
    alignement?: Alignement;
    /**
     * `diffusion` (défaut) rend les demi-teintes d'une photo par une trame de
     * points ; `seuil` garde nets les aplats d'un logo.
     */
    tramage?: 'diffusion' | 'seuil';
}
export type Bloc = BlocTexte | BlocLigne | BlocSeparateur | BlocEspace | BlocQr | BlocImage;
export interface Recu {
    blocs: Bloc[];
}
