import type { Recu } from './document.ts';
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
export type ImageChargee = CanvasImageSource & {
    width: number;
    height: number;
};
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
export declare function environnementNavigateur(): Environnement;
export declare function dessinerRecu(recu: Recu, options?: OptionsDessin, env?: Environnement): Promise<Toile>;
