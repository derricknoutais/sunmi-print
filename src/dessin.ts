import type { Recu } from './document.ts';
import { LARGEUR_58MM } from './metriques.ts';
import { mettreEnPage, type Operation } from './mise-en-page.ts';
import { chargerPolice } from './police.ts';
import { diffuser, niveauxDeGris, seuiller, seuillerRgba } from './tramage.ts';

/**
 * Le dessin d'un reçu en image noir et blanc, à un pixel par point
 * d'imprimante. Ce que montre l'aperçu est exactement ce qui s'imprime :
 * mêmes pixels, même police.
 */

/** Ce dont le dessin a besoin d'un canvas — celui du navigateur, ou celui de Node en test. */
export interface Toile {
    width: number;
    height: number;
    getContext(type: '2d'): CanvasRenderingContext2D | null;
    toDataURL(type?: string): string;
}

export type ImageChargee = CanvasImageSource & { width: number; height: number };

export interface Environnement {
    creerToile(largeur: number, hauteur: number): Toile;
    chargerImage(source: string): Promise<ImageChargee>;
    /** Charge la police et renvoie le nom de sa famille. */
    famille(): Promise<string>;
}

export interface OptionsDessin {
    /** En points ; 384 (58 mm) par défaut. */
    largeur?: number;
    /** Blanc de chaque côté, en points ; 4 par défaut. */
    marge?: number;
    /**
     * Seuil noir/blanc du texte, 0–255 ; 160 par défaut. Plus haut, les
     * lettres s'épaississent ; plus bas, elles s'affinent.
     */
    seuil?: number;
}

export function environnementNavigateur(): Environnement {
    return {
        creerToile(largeur, hauteur) {
            const toile = document.createElement('canvas');
            toile.width = largeur;
            toile.height = hauteur;
            return toile;
        },
        chargerImage(source) {
            return new Promise((resoudre, rejeter) => {
                const image = new Image();
                // En mode CORS : une image d'une autre origine sans autorisation
                // échoue ici, clairement, au lieu de rendre la toile illisible.
                if (!/^data:/i.test(source)) image.crossOrigin = 'anonymous';
                image.onload = () => resoudre(image);
                image.onerror = () => rejeter(new Error(`Image illisible : ${source.slice(0, 80)}`));
                image.src = source;
            });
        },
        famille: chargerPolice,
    };
}

export async function dessinerRecu(recu: Recu, options: OptionsDessin = {}, env: Environnement = environnementNavigateur()): Promise<Toile> {
    const largeur = options.largeur || LARGEUR_58MM;
    const marge = options.marge === undefined ? 4 : options.marge;
    const seuil = options.seuil === undefined ? 160 : options.seuil;

    const famille = await env.famille();

    const sources = recu.blocs.filter((b) => b.type === 'image').map((b) => (b as { source: string }).source);
    const images = new Map<string, ImageChargee>();
    await Promise.all(sources.map((source) => env.chargerImage(source).then((image) => {
        images.set(source, image);
    })));

    const mesure = contexte(env.creerToile(1, 1));
    const page = mettreEnPage(recu, {
        largeur,
        marge,
        famille,
        mesurer(texte, police) {
            mesure.font = police;
            return mesure.measureText(texte).width;
        },
        dimensionsImage(source) {
            const image = images.get(source);
            return image ? { largeur: image.width, hauteur: image.height } : undefined;
        },
    });

    const toile = env.creerToile(page.largeur, page.hauteur);
    const ctx = contexte(toile);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, page.largeur, page.hauteur);
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'alphabetic';

    for (const op of page.operations) dessiner(ctx, op, images, env);

    // Tout ce qui est gris — les bords lissés des lettres — devient noir ou
    // blanc. Les images, déjà tramées, n'ont plus de gris : elles n'en sortent
    // pas changées.
    const pixels = ctx.getImageData(0, 0, page.largeur, page.hauteur);
    seuillerRgba(pixels.data, seuil);
    ctx.putImageData(pixels, 0, 0);

    return toile;
}

function dessiner(ctx: CanvasRenderingContext2D, op: Operation, images: Map<string, ImageChargee>, env: Environnement): void {
    switch (op.type) {
        case 'texte':
            ctx.font = op.police;
            ctx.fillText(op.texte, op.x, op.ligneDeBase);
            return;

        case 'rectangle':
            ctx.fillRect(op.x, op.y, op.largeur, op.hauteur);
            return;

        case 'qr':
            op.matrice.forEach((rangee, ligne) => {
                rangee.forEach((noir, colonne) => {
                    if (noir) ctx.fillRect(op.x + colonne * op.module, op.y + ligne * op.module, op.module, op.module);
                });
            });
            return;

        case 'image': {
            const image = images.get(op.source);
            if (!image) return;

            // Redimensionnée avec lissage, puis réduite à du noir et blanc
            // point par point : la trame doit se faire à la taille finale.
            const tampon = env.creerToile(op.largeur, op.hauteur);
            const t = contexte(tampon);
            t.fillStyle = '#fff';
            t.fillRect(0, 0, op.largeur, op.hauteur);
            t.drawImage(image, 0, 0, op.largeur, op.hauteur);
            const gris = niveauxDeGris(t.getImageData(0, 0, op.largeur, op.hauteur).data);
            const noirs = op.tramage === 'seuil' ? seuiller(gris) : diffuser(gris, op.largeur, op.hauteur);

            const sortie = ctx.createImageData(op.largeur, op.hauteur);
            for (let i = 0; i < noirs.length; i++) {
                const v = noirs[i] ? 0 : 255;
                sortie.data[4 * i] = v;
                sortie.data[4 * i + 1] = v;
                sortie.data[4 * i + 2] = v;
                sortie.data[4 * i + 3] = 255;
            }
            ctx.putImageData(sortie, op.x, op.y);
            return;
        }
    }
}

function contexte(toile: Toile): CanvasRenderingContext2D {
    const ctx = toile.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible.');
    return ctx;
}
