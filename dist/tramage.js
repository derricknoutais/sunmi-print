/**
 * Une tête thermique ne connaît que deux états : chauffer un point, ou pas.
 * Tout ce qui est gris doit donc devenir noir ou blanc avant l'impression —
 * par un seuil pour le texte et les aplats, par une trame pour une photo.
 */
/** Luminance 0–255 de chaque pixel RGBA, posé sur du blanc. */
export function niveauxDeGris(rgba) {
    const gris = new Uint8ClampedArray(rgba.length / 4);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
        const alpha = rgba[i + 3] / 255;
        const luminance = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
        gris[j] = luminance * alpha + 255 * (1 - alpha);
    }
    return gris;
}
/**
 * Noir ou blanc selon le seuil, sur place. Un seuil au-dessus de 128 épaissit
 * le texte : le bord lissé d'une lettre, gris clair, passe au noir. C'est ce
 * qui garde lisibles les petits corps sur papier thermique.
 */
export function seuillerRgba(rgba, seuil) {
    const gris = niveauxDeGris(rgba);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
        const v = gris[j] < seuil ? 0 : 255;
        rgba[i] = v;
        rgba[i + 1] = v;
        rgba[i + 2] = v;
        rgba[i + 3] = 255;
    }
}
/**
 * Diffusion d'erreur de Floyd–Steinberg : chaque pixel prend la valeur la
 * plus proche, et l'écart se reporte sur ses voisins pas encore traités. Les
 * demi-teintes deviennent une densité de points — l'œil refait le gris.
 *
 * Renvoie un point par octet : 1 pour noir.
 */
export function diffuser(gris, largeur, hauteur) {
    const valeurs = new Float32Array(gris);
    const noirs = new Uint8Array(largeur * hauteur);
    for (let y = 0; y < hauteur; y++) {
        for (let x = 0; x < largeur; x++) {
            const i = y * largeur + x;
            const ancienne = valeurs[i];
            const nouvelle = ancienne < 128 ? 0 : 255;
            noirs[i] = nouvelle === 0 ? 1 : 0;
            const erreur = ancienne - nouvelle;
            if (x + 1 < largeur)
                valeurs[i + 1] += (erreur * 7) / 16;
            if (y + 1 < hauteur) {
                if (x > 0)
                    valeurs[i + largeur - 1] += (erreur * 3) / 16;
                valeurs[i + largeur] += (erreur * 5) / 16;
                if (x + 1 < largeur)
                    valeurs[i + largeur + 1] += erreur / 16;
            }
        }
    }
    return noirs;
}
/** Seuil simple, au même format que `diffuser` : 1 pour noir. */
export function seuiller(gris, seuil = 128) {
    const noirs = new Uint8Array(gris.length);
    for (let i = 0; i < gris.length; i++)
        noirs[i] = gris[i] < seuil ? 1 : 0;
    return noirs;
}
