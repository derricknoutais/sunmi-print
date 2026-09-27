#!/usr/bin/env node
/**
 * Embarque la police dans le code : src/police-donnees.ts, en base64.
 *
 *   npm run police
 *
 * Pourquoi dans le JavaScript plutôt qu'en fichier .woff2 à côté : un fichier
 * d'un paquet de node_modules, chaque bundler le copie à sa façon (ou pas),
 * alors qu'un module JavaScript, tous savent le découper et le charger à la
 * demande. Le module n'est importé qu'au premier reçu dessiné : une page qui
 * n'imprime pas ne télécharge rien.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const racine = new URL('..', import.meta.url);
const lire = (nom) => readFileSync(new URL(`polices/${nom}`, racine)).toString('base64');

const contenu = `// Généré par scripts/generer-police.mjs — ne pas modifier à la main.
// Roboto, jeu latin (Unicode 0000–00FF, 2000–206F, €…), © The Roboto Project
// Authors, SIL Open Font License 1.1 : voir polices/LICENSE-Roboto.txt.

export const ROBOTO_500 = '${lire('roboto-latin-500-normal.woff2')}';

export const ROBOTO_700 = '${lire('roboto-latin-700-normal.woff2')}';
`;

writeFileSync(new URL('src/police-donnees.ts', racine), contenu);
console.log(`src/police-donnees.ts : ${Math.round(contenu.length / 1024)} Ko`);
