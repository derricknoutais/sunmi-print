import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * Chrome 62 : le WebView système d'un Sunmi V2 Pro (Android 7.1), celui
 * qu'utilise l'application Sunmi Print pour sa page de test et en mode coque.
 * Son navigateur est un Chromium 74, mais c'est la version la plus ancienne
 * qui fait loi : une syntaxe trop récente empêche le script entier de se
 * charger, une API trop récente casse l'écran au premier appel.
 *
 * Le vérificateur de sunmi-scan vise Chrome 74 et ignore ce qui est apparu
 * entre 63 et 74 : ces règles-ci comblent l'écart.
 */
const REGLES = [
    ['?? (coalescence)', 80, /\?\?[^=]/],
    ['?. (chaînage optionnel)', 80, /\?\.[A-Za-z_$[(]/],
    ['catch sans paramètre', 66, /catch\s*\{/],
    ['flat / flatMap', 69, /\.flat(Map)?\(/],
    ['Promise.prototype.finally', 63, /\.finally\(/],
    ['import dynamique', 63, /\bimport\(/],
    ['import.meta', 64, /import\.meta/],
    ['for await', 63, /for\s*await/],
    ['groupe de capture nommé', 64, /\(\?<(?![=!])/],
    ['Object.fromEntries', 73, /Object\.fromEntries/],
    ['globalThis', 71, /\bglobalThis\b/],
    ['matchAll', 73, /\.matchAll\(/],
    ['trimStart / trimEnd', 66, /\.trim(Start|End)\(/],
    ['AbortController', 66, /\bAbortController\b/],
    ['Promise.allSettled', 76, /\ballSettled\b/],
    ['replaceAll', 85, /\.replaceAll\(/],
    ['structuredClone', 98, /\bstructuredClone\b/],
    ['findLast', 97, /\.findLast(Index)?\(/],
];

const FICHIERS = [
    ...readdirSync(new URL('../dist/', import.meta.url))
        // La police n'est qu'une chaîne base64 : rien à exécuter.
        .filter((f) => f.endsWith('.js') && f !== 'police-donnees.js')
        .map((f) => `dist/${f}`),
    'android/app/src/main/assets/test/demo.js',
];

for (const fichier of FICHIERS) {
    test(`${fichier} tourne dans Chrome 62`, () => {
        const source = readFileSync(new URL(`../${fichier}`, import.meta.url), 'utf8')
            // Les commentaires peuvent citer ce qu'on évite : on ne juge que le code.
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

        const trouvees = REGLES.filter(([, , motif]) => motif.test(source)).map(([nom, chrome]) => {
            const i = source.search(REGLES.find(([n]) => n === nom)[2]);
            return `${nom} (Chrome ${chrome}) … ${source.slice(Math.max(0, i - 40), i + 30).replace(/\s+/g, ' ')}`;
        });
        assert.deepEqual(trouvees, []);
    });
}
