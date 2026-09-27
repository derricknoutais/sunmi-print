# sunmi-print

Imprimer des reçus sur l'imprimante intégrée des terminaux Sunmi depuis une application web — Laravel, Vue, ou rien du tout.

La page dessine le reçu en image noir et blanc, avec la police livrée par le paquet ; l'application Android **Sunmi Print** l'envoie à l'imprimante. L'aperçu à l'écran est donc exactement ce qui sort : accents, « FCFA », QR compris.

| | |
|---|---|
| `@derricknoutais/sunmi-print` | le cœur, **sans framework** : décrire un reçu, le dessiner, l'imprimer, l'aperçu, ESC/POS |
| `@derricknoutais/sunmi-print/vue` | `useImprimante()` et le composant `<ApercuRecu>` |
| `android/` | l'application **Sunmi Print**, à installer sur chaque terminal |

---

## Ce que les terminaux imposent

- **Une page web ne peut pas parler à l'imprimante.** Le service d'impression Sunmi n'est ouvert qu'aux applications Android : il faut l'application Sunmi Print sur le terminal.
- **Un Sunmi V2 Pro a deux moteurs web.** Son navigateur est un Chromium **74** — c'est là que tournent vos applications. Mais les applications Android affichent leurs pages avec le WebView du système, resté en version **62** : une application Vite n'y démarre même pas (l'import dynamique date de Chrome 63). Relevé sur un V2 Pro sous Android 7.1.2 : `org.chromium.chrome` 74.0.3710, `com.google.android.webview` 62.0.3202.
- D'où le mode à préférer : **l'application web reste dans le navigateur**, et Sunmi Print, en service de fond, reçoit les reçus sur `http://127.0.0.1:17321`. Une requête d'une page https vers l'adresse de boucle locale n'est pas du contenu mixte — vérifié dans le Chromium 74 du V2 Pro.
- **Attention au navigateur par défaut** : sur ce V2 Pro, un lien https s'ouvre dans un vieux Chrome **56** (`com.android.chrome`), où une application Vite ne démarre pas. Ouvrir les applications depuis **Chromium** (raccourci sur l'écran d'accueil, ou Chromium comme navigateur par défaut).
- **58 mm = 384 points** à 203 dpi (80 mm = 576). Pas de massicot sur un V2 Pro : le papier avance de quelques lignes pour se détacher à la barre.
- **Du texte envoyé tel quel à une imprimante thermique dépend de sa page de codes** : « PAYÉ » peut sortir « PAYÃ‰ ». Une image, jamais.

## Comment ça marche

```
page ── dessinerRecu() ─► canvas 384 points, Roboto embarquée, noir et blanc ─► PNG
     │
     ├─ dans le navigateur du terminal ─► http://127.0.0.1:17321/imprimer ─┐
     └─ dans l'application (mode coque) ─► window.SunmiImpression ─────────┤
                                                                            ▼
                                        Sunmi Print ─► service d'impression Sunmi, en transaction
                                                                            │
     la promesse se résout quand le reçu est SORTI ◄── verdict de l'imprimante
```

Le mode « transaction » du SDK Sunmi rend un verdict sur le reçu entier : la page sait qu'il est sorti, ou pourquoi il ne l'est pas — plus de papier, capot ouvert, tête trop chaude.

## Installation

### JavaScript

```bash
npm install github:derricknoutais/sunmi-print#v0.1.0
```

En développement, à côté du projet : `npm install ../sunmi-print`.

### L'application Android, sur chaque terminal

Construire l'APK (Android Studio installé ; son Java suffit) :

```bash
cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
```

L'installer sur un terminal branché en USB, débogage USB activé :

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Puis, sur le terminal : ouvrir **Sunmi Print**, saisir les **adresses autorisées à imprimer** (une par ligne : `https://storit.stapog.com`…), **Enregistrer**. Le service démarre aussitôt, et à chaque démarrage du terminal. **Tester l'imprimante** ouvre la page de test embarquée : reçu d'exemple, mire, état de l'imprimante.

## Décrire un reçu

Un reçu est une liste de blocs — de simples objets JSON, que la page peut composer aussi bien qu'un contrôleur Laravel.

| Bloc | Champs | |
|---|---|---|
| `texte` | `texte`, `alignement`, `taille`, `gras` | passe à la ligne tout seul ; `\n` force un retour |
| `ligne` | `gauche`, `droite`, `taille`, `gras` | libellé à gauche, montant à droite, jamais coupé |
| `separateur` | `style` : `tirets`, `plein`, `double` | |
| `espace` | `hauteur` (points, 16 par défaut) | |
| `qr` | `donnees`, `taille`, `alignement`, `correction` | modules entiers, zone blanche, UTF-8 |
| `image` | `source`, `largeur`, `alignement`, `tramage` | logo en `seuil`, photo en `diffusion` |

`taille` : `petite` (20 points), `normale` (24), `grande` (32), `titre` (40). `alignement` : `gauche`, `centre`, `droite`.

```ts
import { montant, type Recu } from '@derricknoutais/sunmi-print';

const recu: Recu = {
    blocs: [
        { type: 'texte', texte: 'LE PALMIER', taille: 'titre', gras: true, alignement: 'centre' },
        { type: 'separateur' },
        { type: 'ligne', gauche: 'Poulet braisé', droite: montant(6500, '') },
        { type: 'ligne', gauche: 'TOTAL TTC', droite: montant(20000), taille: 'grande', gras: true },
        { type: 'qr', donnees: 'https://exemple.ga/r/2026-0042' },
    ],
};
```

Ou côté serveur, passé en prop Inertia :

```php
return Inertia::render('Ventes/Recu', ['recu' => ['blocs' => [
    ['type' => 'texte', 'texte' => $vente->boutique, 'taille' => 'titre', 'gras' => true, 'alignement' => 'centre'],
    ...$vente->lignes->map(fn ($l) => ['type' => 'ligne', 'gauche' => $l->libelle, 'droite' => number_format($l->total, 0, ',', ' ')]),
]]]);
```

Deux choix de mise en page méritent d'être connus :

- **Une ligne de ticket essaie deux dispositions** et garde la plus courte : le montant sur la première ligne, le libellé dans la place restante ; ou le libellé sur toute la largeur, le montant au bout de sa dernière ligne. Un gros montant ne hache plus un long libellé en tronçons.
- **Une référence trop longue se coupe après un tiret** (`ADK-` / `5904`) plutôt qu'au milieu d'un nombre.

`montant(12000)` donne « 12 000 FCFA », avec des espaces insécables : un montant ne se coupe jamais d'une ligne à l'autre. Écrit à la main plutôt que par `Intl` : les données ICU du WebView d'un terminal ne sont pas celles d'un Chrome récent.

## Imprimer

```ts
import { ErreurImpression, imprimerRecu } from '@derricknoutais/sunmi-print';

try {
    await imprimerRecu(recu); // se résout quand le reçu est sorti
} catch (e) {
    if (e instanceof ErreurImpression && e.code === 'papier') {
        // « Plus de papier. »
    }
}
```

| `code` | |
|---|---|
| `papier`, `capot`, `surchauffe` | l'imprimante le dit ; `message` est prêt à afficher |
| `occupee` | l'imprimante se prépare, ou la connexion au service Sunmi n'est pas encore faite |
| `refusee` | l'adresse de la page n'est pas autorisée dans Sunmi Print |
| `absente` | ni application ni service : navigateur de bureau, ou Sunmi Print pas installée |
| `delai` | aucun verdict dans le temps imparti |

`etatImprimante()` donne l'état sans imprimer, et la largeur du papier : le reçu est dessiné à la largeur de l'imprimante trouvée.

## Vue 3

```vue
<script setup lang="ts">
import { ApercuRecu, useImprimante } from '@derricknoutais/sunmi-print/vue';

const { imprimer, enCours, erreur } = useImprimante();
</script>

<template>
    <ApercuRecu :recu="recu" />
    <button :disabled="enCours" @click="imprimer(recu)">Imprimer</button>
    <p v-if="erreur" role="alert">{{ erreur }}</p>
</template>
```

`useImprimante` ne cherche pas l'imprimante au montage : sur un Chrome de bureau récent, interroger `127.0.0.1` depuis un site public déclenche une demande d'accès au réseau local. Elle cherche quand on imprime, ou quand on appelle `detecter()` (`{ detecterAuMontage: true }` pour un écran réservé aux terminaux).

## Autres imprimantes : ESC/POS

```ts
import { dessinerRecu, versEscPos } from '@derricknoutais/sunmi-print';

const octets = versEscPos(await dessinerRecu(recu)); // à envoyer par Bluetooth, réseau, USB
```

Le reçu part en image tramée (`GS v 0`), que toutes les imprimantes thermiques comprennent : les accents sortent comme à l'aperçu, quelle que soit leur page de codes.

## Sécurité

- Le service n'écoute que sur `127.0.0.1` : injoignable depuis le réseau. Il ne répond qu'aux **origines autorisées** ; un refus arrive avec les en-têtes CORS, pour que la page puisse dire pourquoi. Une requête sans en-tête `Origin` ne vient pas d'un navigateur (un `curl` par `adb`) : elle passe, pour le diagnostic.
- Android injecte le pont dans toutes les pages de la WebView : chaque appel vérifie que la page affichée est autorisée. Une page d'une autre origine reçoit `refusee`.
- Mode coque : un certificat auto-signé n'est accepté que sur le réseau local (`10/8`, `172.16/12`, `192.168/16`), et seulement si la case est cochée.

## Compatibilité

- `dist/` et la page de test tournent dans **Chrome 62** : `test/compatibilite.test.mjs` refuse toute syntaxe ou API plus récente (`catch {}`, `flatMap`, `import()`, `import.meta`, `finally`…). Pas d'import dynamique : la police est importée statiquement, un bundler ne l'embarque que dans le code qui dessine.
- Aucune dépendance d'exécution n'exclut **Node 20** (`test/engines.test.mjs`) : Yarn 1 sur un serveur Forge refuserait sinon d'installer le projet — ce qui est arrivé à sunmi-scan avec ZXing 0.22.
- Une application ouverte **dans le navigateur** du terminal suit les règles de sunmi-scan (Chrome 74). Ouverte **dans Sunmi Print** (mode coque), elle doit tourner en Chrome 62 : avec Vite, `@vitejs/plugin-legacy`.

## Développer le paquet

```bash
npm install
npm test          # compile, puis 69 tests : mise en page, dessin (Skia et la vraie police),
                  # QR relu par ZXing, ESC/POS, pont, service local, montants, Chrome 62, Node 20
```

- `SUNMI_PRINT_APERCUS=/un/dossier npm test` enregistre les reçus dessinés en PNG, pour les regarder.
- `npm run build` compile `dist/` **et** la page de test dans `android/app/src/main/assets/test/` (versionnée : l'APK se construit sans Node).
- `npm run police` régénère `src/police-donnees.ts` depuis `polices/` — Roboto Medium et Bold, jeu latin, SIL Open Font License.
- Sur un émulateur ou un téléphone, Sunmi Print passe en **simulation** : le pont affiche le reçu au lieu de l'imprimer, le service le garde dans `derniere-impression.png` (`adb pull /sdcard/Android/data/com.derricknoutais.sunmiprint/files/derniere-impression.png`).
- Version de développement : `chrome://inspect` depuis le poste, terminal branché en USB, pour déboguer la page ouverte dans l'application.

## Vérifié sur un vrai terminal

Sunmi V2 Pro (Android 7.1.2, imprimante POS-V2, 58 mm), le 28 septembre 2026 :

| Chemin | Moteur | Résultat |
|---|---|---|
| page de test dans Sunmi Print, pont direct | WebView 62 | reçu d'exemple imprimé (2,5 s), mire imprimée (3,1 s) |
| page **https** dans le navigateur → `http://127.0.0.1:17321` | Chromium 74 | service détecté, reçu imprimé (2,3 s) |

Les durées sont celles du verdict de l'imprimante, papier sorti.

## Limites connues

- **Jeu latin seulement** : un caractère absent de la police embarquée (chinois, arabe…) est rendu par une police du système, ou pas du tout.
- **Signature de développement** : l'APK est signé avec la clé de débogage du poste qui le construit. Une mise à jour construite ailleurs ne s'installera pas par-dessus : prévoir une clé de publication avant d'équiper plusieurs terminaux.
