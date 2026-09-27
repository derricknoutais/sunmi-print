import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { dessinerRecu } from '../dist/dessin.js';
import { mire, recuExemple } from '../dist/exemples.js';
import { diffuser } from '../dist/tramage.js';
import { degrade, environnementNode, garderApercu, gris } from './outils.mjs';

const env = environnementNode();

// ZXing, le lecteur de sunmi-scan : un QR imprimé doit se relire par le même
// chemin qu'au scanner. Selon le chargeur, le module arrive nommé ou sous `default`.
const module = await import('@zxing/library');
const z = module.QRCodeReader ? module : module.default;

function lireQr(toile) {
    const source = new z.RGBLuminanceSource(gris(toile), toile.width, toile.height);
    const indices = new Map([[z.DecodeHintType.TRY_HARDER, true]]);
    return new z.QRCodeReader().decode(new z.BinaryBitmap(new z.HybridBinarizer(source)), indices).getText();
}

function densite(toile) {
    const g = gris(toile);
    let noirs = 0;
    for (const v of g) if (v === 0) noirs++;
    return noirs / g.length;
}

test('le reçu d’exemple est une image de 384 points de large, en noir et blanc pur', async () => {
    const toile = await dessinerRecu(recuExemple(), {}, env);
    garderApercu('recu-exemple', toile);

    assert.equal(toile.width, 384);
    const g = gris(toile);
    const grisRestants = g.filter((v) => v !== 0 && v !== 255).length;
    assert.equal(grisRestants, 0, 'la tête thermique ne sait pas imprimer du gris');
    const d = densite(toile);
    assert.ok(d > 0.03 && d < 0.3, `densité de noir inattendue : ${d.toFixed(3)}`);
});

test('en 80 mm, le même reçu prend 576 points de large', async () => {
    const toile = await dessinerRecu(recuExemple(), { largeur: 576 }, env);
    garderApercu('recu-exemple-80mm', toile);
    assert.equal(toile.width, 576);
});

test('le QR se relit tel qu’imprimé', async () => {
    const toile = await dessinerRecu({ blocs: [{ type: 'qr', donnees: 'https://exemple.ga/r/2026-0042' }] }, {}, env);
    assert.equal(lireQr(toile), 'https://exemple.ga/r/2026-0042');
});

test('un QR aux données accentuées se relit en UTF-8, pas en Latin-1', async () => {
    const toile = await dessinerRecu({ blocs: [{ type: 'qr', donnees: 'https://exemple.ga/mire?reçu=é' }] }, {}, env);
    assert.equal(lireQr(toile), 'https://exemple.ga/mire?reçu=é');
});

test('le QR se relit au milieu du reçu complet, texte autour', async () => {
    const toile = await dessinerRecu(recuExemple(), {}, env);
    assert.equal(lireQr(toile), 'https://exemple.ga/r/2026-0042');
});

test('un seuil plus haut épaissit le texte', async () => {
    const recu = { blocs: [{ type: 'texte', texte: 'Épaisseur du trait — 12 000 FCFA' }] };
    const fin = densite(await dessinerRecu(recu, { seuil: 80 }, env));
    const epais = densite(await dessinerRecu(recu, { seuil: 220 }, env));
    assert.ok(epais > fin * 1.2, `seuil 80 : ${fin.toFixed(3)}, seuil 220 : ${epais.toFixed(3)}`);
});

test('la trame rend un dégradé par une densité de points qui suit le gris', () => {
    const largeur = 256;
    const hauteur = 32;
    const g = new Uint8ClampedArray(largeur * hauteur);
    for (let y = 0; y < hauteur; y++) for (let x = 0; x < largeur; x++) g[y * largeur + x] = x;

    const noirs = diffuser(g, largeur, hauteur);
    for (let debut = 0; debut < largeur; debut += 32) {
        let n = 0;
        for (let y = 0; y < hauteur; y++) for (let x = debut; x < debut + 32; x++) n += noirs[y * largeur + x];
        const obtenue = n / (32 * hauteur);
        const attendue = 1 - (debut + 15.5) / 255;
        assert.ok(Math.abs(obtenue - attendue) < 0.08, `colonnes ${debut}–${debut + 31} : ${obtenue.toFixed(2)} au lieu de ${attendue.toFixed(2)}`);
    }
});

test('la mire se dessine entière, image tramée comprise', async () => {
    const toile = await dessinerRecu(mire({ image: degrade() }), {}, env);
    garderApercu('mire', toile);
    assert.equal(toile.width, 384);
    assert.equal(gris(toile).filter((v) => v !== 0 && v !== 255).length, 0);
});
