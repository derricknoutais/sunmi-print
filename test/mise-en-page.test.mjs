import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { boiteDeLigne } from '../dist/metriques.js';
import { mettreEnPage } from '../dist/mise-en-page.js';
import { couperEnLignes } from '../dist/texte.js';

/** Une police imaginaire à chasse fixe : 10 points par caractère. Assez pour vérifier la géométrie. */
const mesurer = (texte) => Array.from(texte).length * 10;
const page = (blocs, autres = {}) =>
    mettreEnPage({ blocs }, { largeur: 384, marge: 4, famille: 'Essai', mesurer, ...autres });
const textes = (p) => p.operations.filter((o) => o.type === 'texte');

test('les mots passent à la ligne entiers', () => {
    assert.deepEqual(couperEnLignes('un deux trois quatre', 130, mesurer), ['un deux trois', 'quatre']);
});

test('une référence trop longue se coupe après un tiret', () => {
    assert.deepEqual(couperEnLignes('ADK-5904-XYZ-0001', 80, mesurer), ['ADK-', '5904-', 'XYZ-0001']);
});

test('un mot sans tiret se coupe où il déborde', () => {
    assert.deepEqual(couperEnLignes('ABCDEFGHIJKLMNOPQ', 80, mesurer), ['ABCDEFGH', 'IJKLMNOP', 'Q']);
});

test('le retrait de tête est gardé, mais pas sur les lignes de continuation', () => {
    assert.deepEqual(couperEnLignes('  2 × 500 et encore', 100, mesurer), ['  2 × 500', 'et encore']);
});

test('un retour forcé et une ligne vide sont respectés', () => {
    assert.deepEqual(couperEnLignes('a\n\nb', 100, mesurer), ['a', '', 'b']);
});

test('un texte centré ou à droite est placé dans la largeur utile', () => {
    const p = page([
        { type: 'texte', texte: 'abcd', alignement: 'centre' },
        { type: 'texte', texte: 'abcd', alignement: 'droite' },
    ]);
    const [centre, droite] = textes(p);
    assert.equal(centre.x, 4 + (376 - 40) / 2);
    assert.equal(droite.x, 4 + 376 - 40);
});

test('chaque ligne avance de sa hauteur, la ligne de base au même endroit dans la boîte', () => {
    const boite = boiteDeLigne('normale');
    const p = page([{ type: 'texte', texte: 'une\ndeux' }]);
    assert.deepEqual(textes(p).map((o) => o.ligneDeBase), [boite.ligneDeBase, boite.hauteur + boite.ligneDeBase]);
    assert.equal(p.hauteur, 2 * boite.hauteur);
});

test('une ligne de ticket met le montant sur la première ligne, collé à droite', () => {
    const p = page([{ type: 'ligne', gauche: 'Brochettes de capitaine sauce moyo', droite: '9 000' }]);
    const [premier, montant, suite] = textes(p);
    assert.equal(montant.texte, '9 000');
    assert.equal(montant.x, 4 + 376 - 50);
    assert.equal(montant.ligneDeBase, premier.ligneDeBase);
    // Le libellé s'arrête avant le montant et son écart, puis continue dessous.
    assert.ok(premier.x + mesurer(premier.texte) <= montant.x - 12);
    assert.ok(suite.ligneDeBase > premier.ligneDeBase);
});

test('un gros montant se pose au bout d’un libellé court', () => {
    const p = page([{ type: 'ligne', gauche: 'Total', droite: '1 234 567 890 123 FCFA' }]);
    const [libelle, montant] = textes(p);
    assert.equal(montant.ligneDeBase, libelle.ligneDeBase);
    assert.equal(montant.x + mesurer(montant.texte), 4 + 376);
});

test('un montant qui ne tient ni en colonne ni au bout passe dessous, aligné à droite', () => {
    const p = page([{ type: 'ligne', gauche: 'Montant trop large pour tenir', droite: '1 234 567 890 123 FCFA' }]);
    const [libelle, montant] = textes(p);
    assert.equal(libelle.texte, 'Montant trop large pour tenir');
    assert.ok(montant.ligneDeBase > libelle.ligneDeBase);
    assert.equal(montant.x + mesurer(montant.texte), 4 + 376);
});

test('un long libellé prend toute la largeur quand la colonne le hacherait', () => {
    const gauche = 'Un libellé très long, qui passe à la ligne sans jamais toucher le montant';
    const p = page([{ type: 'ligne', gauche, droite: '1 250 000 FCFA' }]);
    const ops = textes(p);
    const montant = ops.find((o) => o.texte === '1 250 000 FCFA');
    const libelle = ops.filter((o) => o !== montant);
    // Deux lignes pleine largeur et le montant dessous — au lieu de quatre en colonne.
    assert.deepEqual(libelle.map((o) => o.texte), ['Un libellé très long, qui passe à la', 'ligne sans jamais toucher le montant']);
    assert.ok(montant.ligneDeBase > libelle[1].ligneDeBase);
    assert.equal(p.hauteur, 3 * boiteDeLigne('normale').hauteur);
});

test('un QR garde des modules entiers d’au moins deux points et sa zone blanche', () => {
    const p = page([{ type: 'qr', donnees: 'https://exemple.ga/r/2026-0042' }]);
    const qr = p.operations.find((o) => o.type === 'qr');
    const cote = qr.matrice.length + 4;
    assert.ok(Number.isInteger(qr.module) && qr.module >= 2);
    assert.equal(p.hauteur, qr.module * cote);
    // Centré : même blanc de chaque côté, à un point près.
    const gauche = qr.x - 2 * qr.module;
    const droite = 384 - (gauche + qr.module * cote);
    assert.ok(Math.abs(gauche - droite) <= 1);
});

test('une image est ramenée à la largeur utile, proportions gardées', () => {
    const p = page([{ type: 'image', source: 'logo.png' }], { dimensionsImage: () => ({ largeur: 752, hauteur: 200 }) });
    const image = p.operations[0];
    assert.equal(image.largeur, 376);
    assert.equal(image.hauteur, 100);
});

test('une image non chargée est une erreur, pas un trou silencieux dans le reçu', () => {
    assert.throws(() => page([{ type: 'image', source: 'absente.png' }]), /Image non chargée/);
});

test('un bloc inconnu est refusé nommément', () => {
    assert.throws(() => page([{ type: 'tableau' }]), /Bloc inconnu : "tableau"/);
});
