#!/usr/bin/env node
/**
 * La page de test, en un seul script classique, dans les ressources de
 * l'application Android : android/app/src/main/assets/test/.
 *
 * Un script classique et pas un module : la page doit tourner telle quelle,
 * sans bundler ni résolution de `import`, dans le WebView de l'application —
 * Chrome 62 sur un Sunmi V2 Pro (Android 7.1), et non le Chromium 74 de son
 * navigateur. Les fichiers produits sont versionnés, pour que l'APK se
 * construise sans Node.
 */
import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const chemin = (relatif) => fileURLToPath(new URL(`../${relatif}`, import.meta.url));
const sortie = chemin('android/app/src/main/assets/test');

mkdirSync(sortie, { recursive: true });

await build({
    entryPoints: [chemin('demo/demo.ts')],
    outfile: `${sortie}/demo.js`,
    bundle: true,
    format: 'iife',
    // Le WebView du V2 Pro : ce qui est plus récent est réécrit.
    target: ['chrome62'],
    minify: true,
    legalComments: 'eof',
    // Ce que le bundle embarque d'autrui, et à quelles conditions.
    banner: {
        js: '/*! sunmi-print — page de test. Embarque qrcode-generator (© 2009 Kazuhiko Arase, licence MIT : '
            + 'LICENSE-qrcode-generator.txt) et Roboto (© The Roboto Project Authors, SIL Open Font License 1.1 : LICENSE-Roboto.txt). */',
    },
    logLevel: 'warning',
});
copyFileSync(chemin('demo/index.html'), `${sortie}/index.html`);
copyFileSync(chemin('polices/LICENSE-Roboto.txt'), `${sortie}/LICENSE-Roboto.txt`);
copyFileSync(chemin('licences/qrcode-generator.txt'), `${sortie}/LICENSE-qrcode-generator.txt`);

console.log('  ✓ page de test → android/app/src/main/assets/test/');
