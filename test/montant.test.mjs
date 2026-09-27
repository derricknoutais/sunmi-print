import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { montant } from '../dist/montant.js';

// Espace insécable partout : entre les milliers comme avant la devise.
const INSECABLE = '\u00a0';

test('milliers et devise sont séparés par des espaces insécables', () => {
    assert.equal(montant(12000), `12${INSECABLE}000${INSECABLE}FCFA`);
    assert.equal(montant(1234567), `1${INSECABLE}234${INSECABLE}567${INSECABLE}FCFA`);
    assert.equal(montant(999), `999${INSECABLE}FCFA`);
});

test('sans devise, le nombre seul', () => {
    assert.equal(montant(1500, ''), `1${INSECABLE}500`);
});

test('un négatif prend le vrai signe moins', () => {
    assert.equal(montant(-2500), `\u22122${INSECABLE}500${INSECABLE}FCFA`);
});

test('les décimales, à la française', () => {
    assert.equal(montant(99.5, '€', 2), `99,50${INSECABLE}€`);
    assert.equal(montant(1234.5, '€', 2), `1${INSECABLE}234,50${INSECABLE}€`);
});

test('arrondi au franc, et pas de « \u22120 »', () => {
    assert.equal(montant(2.5), `3${INSECABLE}FCFA`);
    assert.equal(montant(-0.4), `0${INSECABLE}FCFA`);
});

test('un montant qui n’en est pas un est refusé', () => {
    assert.throws(() => montant(NaN), /Montant invalide/);
    assert.throws(() => montant(Infinity), /Montant invalide/);
});
