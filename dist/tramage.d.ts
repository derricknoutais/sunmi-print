/**
 * Une tête thermique ne connaît que deux états : chauffer un point, ou pas.
 * Tout ce qui est gris doit donc devenir noir ou blanc avant l'impression —
 * par un seuil pour le texte et les aplats, par une trame pour une photo.
 */
/** Luminance 0–255 de chaque pixel RGBA, posé sur du blanc. */
export declare function niveauxDeGris(rgba: Uint8ClampedArray): Uint8ClampedArray;
/**
 * Noir ou blanc selon le seuil, sur place. Un seuil au-dessus de 128 épaissit
 * le texte : le bord lissé d'une lettre, gris clair, passe au noir. C'est ce
 * qui garde lisibles les petits corps sur papier thermique.
 */
export declare function seuillerRgba(rgba: Uint8ClampedArray, seuil: number): void;
/**
 * Diffusion d'erreur de Floyd–Steinberg : chaque pixel prend la valeur la
 * plus proche, et l'écart se reporte sur ses voisins pas encore traités. Les
 * demi-teintes deviennent une densité de points — l'œil refait le gris.
 *
 * Renvoie un point par octet : 1 pour noir.
 */
export declare function diffuser(gris: Uint8ClampedArray, largeur: number, hauteur: number): Uint8Array;
/** Seuil simple, au même format que `diffuser` : 1 pour noir. */
export declare function seuiller(gris: Uint8ClampedArray, seuil?: number): Uint8Array;
