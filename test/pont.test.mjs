import { strict as assert } from 'node:assert';
import { beforeEach, test } from 'node:test';
import { ErreurImpression, MESSAGE_ABSENTE } from '../dist/etat.js';
import { imprimerRecu } from '../dist/imprimer.js';
import { envoyerParPont, etatPont, pontDisponible, versionPont } from '../dist/pont.js';

/**
 * L'application Android simulée : ce qu'elle injecte dans la page
 * (`window.SunmiImpression`), et la façon dont elle répond (en appelant
 * `window.__sunmiPrint.retour`).
 */
function installerApplication({ etat = { code: 'prete', message: '', largeur: 384 }, imprimer } = {}) {
    const appels = [];
    globalThis.window.SunmiImpression = {
        version: () => '1',
        etat: () => (typeof etat === 'string' ? etat : JSON.stringify(etat)),
        imprimer(id, png, options) {
            appels.push({ id, png, options: JSON.parse(options) });
            if (imprimer) imprimer(id);
        },
    };
    return appels;
}

const repondre = (id, resultat) => globalThis.window.__sunmiPrint.retour(id, JSON.stringify(resultat));

beforeEach(() => {
    globalThis.window = {};
});

test('hors application, pas de pont et une imprimante « absente » en 58 mm', async () => {
    assert.equal(pontDisponible(), false);
    assert.equal(versionPont(), null);
    assert.deepEqual(etatPont(), { code: 'absente', message: MESSAGE_ABSENTE, largeur: 384, transport: null });
    await assert.rejects(envoyerParPont('AAAA'), (e) => e instanceof ErreurImpression && e.code === 'absente');
});

test('l’état et la largeur viennent de l’application', () => {
    installerApplication({ etat: { code: 'prete', message: 'Prête', largeur: 576, modele: 'T2' } });
    assert.equal(pontDisponible(), true);
    assert.equal(versionPont(), '1');
    assert.deepEqual(etatPont(), { code: 'prete', message: 'Prête', largeur: 576, modele: 'T2', transport: 'pont' });
});

test('un état illisible est une erreur, pas une imprimante prête', () => {
    installerApplication({ etat: 'pas du JSON' });
    assert.equal(etatPont().code, 'erreur');
});

test('l’impression se résout quand l’application annonce le reçu sorti', async () => {
    const appels = installerApplication({ imprimer: (id) => setTimeout(() => repondre(id, { ok: true }), 5) });
    const resultat = await envoyerParPont('iVBORw0KGgo=');
    assert.deepEqual(resultat, { simulation: false });
    assert.equal(appels.length, 1);
    assert.equal(appels[0].png, 'iVBORw0KGgo=');
    assert.deepEqual(appels[0].options, { avance: 3 });
});

test('un échec de l’imprimante rejette avec son code et son message', async () => {
    installerApplication({ imprimer: (id) => repondre(id, { ok: false, code: 'papier', message: 'Plus de papier.' }) });
    await assert.rejects(envoyerParPont('AAAA'), (e) => e instanceof ErreurImpression && e.code === 'papier' && e.message === 'Plus de papier.');
});

test('sans réponse, la promesse se rejette au délai — et une réponse tardive est ignorée', async () => {
    let idPerdu;
    installerApplication({ imprimer: (id) => (idPerdu = id) });
    await assert.rejects(envoyerParPont('AAAA', { delai: 20 }), (e) => e.code === 'delai');
    assert.doesNotThrow(() => repondre(idPerdu, { ok: true }));
});

test('une exception de l’application rejette au lieu de laisser la promesse en suspens', async () => {
    installerApplication();
    globalThis.window.SunmiImpression.imprimer = () => {
        throw new Error('Java exception');
    };
    await assert.rejects(envoyerParPont('AAAA'), (e) => e.code === 'erreur' && /Java exception/.test(e.message));
});

test('sans papier, imprimerRecu refuse avant même de dessiner', async () => {
    installerApplication({ etat: { code: 'papier', message: 'Plus de papier.', largeur: 384 } });
    // Hors navigateur et sans environnement, dessiner échouerait : le refus doit venir avant.
    await assert.rejects(imprimerRecu({ blocs: [] }), (e) => e.code === 'papier');
});
