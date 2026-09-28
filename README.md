# sunmi-print

Le **pilote de l'imprimante intégrée des terminaux Sunmi** (V2 Pro, V2s, P2, T2…), pour une application Android : dire l'état de l'imprimante, imprimer une image.

C'est l'un des pilotes de [ecoprint](https://github.com/derricknoutais/ecoprint), l'application qui reconnaît le terminal et imprime les reçus des applications web. Le pilote ZCS, [zcs-print](https://github.com/derricknoutais/zcs-print), a la même forme.

> Jusqu'à la v0.1.0, ce dépôt contenait aussi la partie web (dessin du reçu, envoi à l'application) et l'application Android. Elles vivent désormais dans **ecoprint** : une page web n'a pas à savoir sur quelle marque de terminal elle tourne.

## Ce qu'il fait

```kotlin
val imprimante = ImprimanteSunmi(context)

if (imprimante.demarrer()) {                  // faux si l'appareil n'a pas le service Sunmi
    imprimante.etat()                          // {"code":"prete","message":"Prête","largeur":384,"modele":"POS-V2"}
    imprimante.imprimer(bitmap, 3) { verdict ->
        // {"ok":true}, ou {"ok":false,"code":"papier","message":"Plus de papier."}
    }
}
```

- **`demarrer()`** se lie au service d'impression Sunmi (`woyou.aidlservice.jiqiservice`, par le SDK `com.sunmi:printerlibrary`). La connexion prend un instant : l'état vaut `occupee` d'ici là.
- **`imprimer(image, avance, fini)`** imprime en **mode transaction** : les commandes s'accumulent dans un tampon, puis l'imprimante rend un verdict sur le reçu entier. `fini` est appelé une seule fois, quand le reçu est **sorti**, ou avec la raison de l'échec. Un long reçu part en tranches de 800 lignes ; une image plus large que le papier est réduite.
- Les reçus passent un par un : le suivant attend le verdict du précédent.

L'état et le verdict sont du JSON (`org.json`), dans le vocabulaire commun aux pilotes d'ecoprint :

| `code` | d'après `updatePrinterState()` |
|---|---|
| `prete` | 1 |
| `occupee` | 2 (se prépare), 8 (massicot en rétablissement), ou connexion au service en cours |
| `papier` | 4 (plus de papier), 9 (repère noir introuvable) |
| `surchauffe` | 5 |
| `capot` | 6 |
| `absente` | 505, ou pas de service Sunmi sur l'appareil |
| `erreur` | 3, 7, 507, ou un état inconnu |
| `delai` | aucun verdict en 60 s |

`largeur` vaut 384 points en 58 mm, 576 en 80 mm (`getPrinterPaper()`).

## Utiliser le pilote

Le module Android est `android/pilote` (espace de noms `com.derricknoutais.sunmiprint`). ecoprint l'inclut directement dans sa construction, depuis un clone voisin :

```kotlin
// settings.gradle.kts de l'application
include(":pilote-sunmi")
project(":pilote-sunmi").projectDir = file("../../sunmi-print/android/pilote")
```

Son manifeste déclare la visibilité du service Sunmi (`<queries>`), indispensable à partir d'Android 11 ; elle est fusionnée dans celui de l'application.

Construire le pilote seul :

```bash
cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew :pilote:assembleRelease
```

## Vérifié

Sur un Sunmi V2 Pro (Android 7.1.2, imprimante POS-V2, 58 mm), le 28 septembre 2026 : reçu et mire imprimés, verdicts rendus en 2 à 3 secondes — avec la v0.1.0, dont ce pilote reprend le code d'impression tel quel.
