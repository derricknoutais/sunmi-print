import { strict as assert } from 'node:assert';
import { beforeEach, test } from 'node:test';
import { ErreurImpression } from '../dist/etat.js';
import { recuExemple } from '../dist/exemples.js';
import { etatImprimante, imprimerRecu } from '../dist/imprimer.js';
import { envoyerAuServeur, etatServeur } from '../dist/serveur.js';
import { environnementNode } from './outils.mjs';

/**
 * Le service local de l'application, simulé au niveau de `fetch` : ce que la
 * page envoie à http://127.0.0.1:17321, et ce que le service répond.
 */
function installerService(repondre) {
    const appels = [];
    globalThis.fetch = async (url, init = {}) => {
        appels.push({ url, init });
        return repondre(url, init);
    };
    return appels;
}

const reponse = (statut, corps) => ({
    status: statut,
    ok: statut < 400,
    json: async () => (typeof corps === 'string' ? JSON.parse(corps) : corps),
});

beforeEach(() => {
    globalThis.window = {};
    delete globalThis.fetch;
});

test('l’état vient du service local, marqué « serveur »', async () => {
    const appels = installerService(() => reponse(200, { code: 'prete', message: 'Prête', largeur: 384, modele: 'V2_PRO', version: '1' }));
    assert.deepEqual(await etatServeur(), { code: 'prete', message: 'Prête', largeur: 384, modele: 'V2_PRO', transport: 'serveur' });
    assert.equal(appels[0].url, 'http://127.0.0.1:17321/etat');
    assert.equal(appels[0].init.cache, 'no-store');
});

test('une adresse non autorisée apprend pourquoi, au lieu d’un simple échec réseau', async () => {
    installerService(() => reponse(403, { ok: false, code: 'refusee', message: 'Adresse non autorisée : https://autre.ga' }));
    const etat = await etatServeur();
    assert.equal(etat.code, 'refusee');
    assert.match(etat.message, /non autorisée/);
});

test('pas de service : null, que la connexion soit refusée ou qu’elle traîne', async () => {
    installerService(() => Promise.reject(new TypeError('Failed to fetch')));
    assert.equal(await etatServeur(), null);

    installerService(() => new Promise(() => {}));
    assert.equal(await etatServeur({ delaiDetection: 20 }), null);
});

test('port: false n’interroge rien ; un autre port est respecté', async () => {
    const appels = installerService(() => reponse(200, { code: 'prete', largeur: 384 }));
    assert.equal(await etatServeur({ port: false }), null);
    assert.equal(appels.length, 0);
    await etatServeur({ port: 9000 });
    assert.equal(appels[0].url, 'http://127.0.0.1:9000/etat');
});

test('l’image part en POST text/plain — pas de pré-vérification CORS — et le verdict revient', async () => {
    const appels = installerService(() => reponse(200, { ok: true }));
    assert.deepEqual(await envoyerAuServeur('iVBORw0KGgo='), { simulation: false });

    const { url, init } = appels[0];
    assert.equal(url, 'http://127.0.0.1:17321/imprimer');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['Content-Type'], 'text/plain;charset=UTF-8');
    assert.deepEqual(JSON.parse(init.body), { image: 'iVBORw0KGgo=', avance: 3 });
});

test('un échec de l’imprimante rejette avec son code', async () => {
    installerService(() => reponse(200, { ok: false, code: 'papier', message: 'Plus de papier.' }));
    await assert.rejects(envoyerAuServeur('AAAA'), (e) => e instanceof ErreurImpression && e.code === 'papier');
});

test('un service tombé en cours de route est « absente », une réponse illisible une « erreur »', async () => {
    installerService(() => Promise.reject(new TypeError('Failed to fetch')));
    await assert.rejects(envoyerAuServeur('AAAA'), (e) => e.code === 'absente');

    installerService(() => ({ status: 500, ok: false, json: async () => JSON.parse('<html>') }));
    await assert.rejects(envoyerAuServeur('AAAA'), (e) => e.code === 'erreur' && /HTTP 500/.test(e.message));
});

test('dans l’application, le pont passe avant le service', async () => {
    const appels = installerService(() => reponse(200, { code: 'prete', largeur: 384 }));
    globalThis.window.SunmiImpression = { version: () => '1', etat: () => '{"code":"prete","largeur":576}', imprimer() {} };
    const etat = await etatImprimante();
    assert.equal(etat.transport, 'pont');
    assert.equal(etat.largeur, 576);
    assert.equal(appels.length, 0);
});

test('ni pont ni service : « absente », sans transport', async () => {
    installerService(() => Promise.reject(new TypeError('Failed to fetch')));
    const etat = await etatImprimante();
    assert.equal(etat.code, 'absente');
    assert.equal(etat.transport, null);
});

test('imprimerRecu par le service envoie le PNG du reçu dessiné, à la largeur de l’imprimante', async () => {
    const appels = installerService((url) =>
        url.endsWith('/etat') ? reponse(200, { code: 'prete', largeur: 576 }) : reponse(200, { ok: true }),
    );
    await imprimerRecu(recuExemple(), { environnement: environnementNode() });

    const envoi = JSON.parse(appels[1].init.body);
    const png = Buffer.from(envoi.image, 'base64');
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    // Largeur lue dans l'en-tête IHDR du PNG.
    assert.equal(png.readUInt32BE(16), 576);
});
