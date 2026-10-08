package com.derricknoutais.sunmiprint

import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import android.util.Log
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterException
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.InnerResultCallback
import com.sunmi.peripheral.printer.SunmiPrinterService
import com.sunmi.peripheral.printer.SystemPropertyUtil
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Le pilote de l'imprimante intégrée des terminaux Sunmi, par leur service
 * d'impression (woyou.aidlservice.jiqiservice).
 *
 * Il dit l'état de l'imprimante, imprime une image et ouvre le tiroir-caisse
 * branché sur le terminal. Il parle le vocabulaire commun aux pilotes de Tikéo — un état
 * `{code, message, largeur, modele}`, un verdict `{ok}` ou
 * `{ok: false, code, message}` —, les codes étant `prete`, `papier`,
 * `surchauffe`, `capot`, `occupee`, `erreur`, `absente`, `delai`, et
 * `non-pris-en-charge` (tiroir-caisse sur un terminal qui n'en pilote pas).
 *
 * Chaque reçu part en mode « transaction » : les commandes s'accumulent dans
 * un tampon, puis l'imprimante rend un verdict sur le reçu entier — sorti, ou
 * pourquoi il ne l'est pas.
 */
class ImprimanteSunmi(private val contexte: Context) {

    @Volatile
    private var service: SunmiPrinterService? = null

    @Volatile
    private var lie = false

    /** Un reçu à la fois — et le tiroir-caisse dans la même file : le suivant attend le verdict du précédent. */
    private val file = Executors.newSingleThreadExecutor()

    /** Le délai d'accusé du tiroir, compté hors de la file : le reçu suivant n'attend pas. */
    private val minuteur = Executors.newSingleThreadScheduledExecutor()

    private val liaison = object : InnerPrinterCallback() {
        override fun onConnected(connecte: SunmiPrinterService) {
            service = connecte
        }

        override fun onDisconnected() {
            service = null
        }
    }

    /**
     * Se lie au service d'impression Sunmi. Faux si l'appareil n'en a pas :
     * ce n'est pas un Sunmi, ou un modèle sans imprimante.
     */
    fun demarrer(): Boolean {
        lie = try {
            InnerPrinterManager.getInstance().bindService(contexte, liaison)
        } catch (e: Exception) {
            Log.i(JOURNAL, "Pas de service d'impression Sunmi : ${e.message}")
            false
        }
        return lie
    }

    fun arreter() {
        if (lie) {
            try {
                InnerPrinterManager.getInstance().unBindService(contexte, liaison)
            } catch (e: Exception) {
                Log.w(JOURNAL, "Déliaison : ${e.message}")
            }
        }
        lie = false
        service = null
    }

    fun etat(): JSONObject {
        if (!lie) return etat("absente", "Pas de service d'impression Sunmi sur cet appareil.", LARGEUR_58MM)
        val s = service ?: return etat("occupee", "Connexion à l'imprimante en cours…", LARGEUR_58MM)

        return try {
            val (code, message) = libelle(s.updatePrinterState())
            etat(code, message, largeur(s)).also { json ->
                modele(s)?.let { json.put("modele", it) }
            }
        } catch (e: Exception) {
            etat("erreur", "Imprimante injoignable : ${e.message}", LARGEUR_58MM)
        }
    }

    /** Imprime l'image, avance le papier de `avance` lignes, et appelle `fini` une seule fois avec le verdict. */
    fun imprimer(image: Bitmap, avance: Int, fini: (JSONObject) -> Unit) {
        file.execute { imprimerMaintenant(image, avance, fini) }
    }

    private fun imprimerMaintenant(image: Bitmap, avance: Int, fini: (JSONObject) -> Unit) {
        val s = service ?: return fini(echec("occupee", "Imprimante pas encore connectée : réessayer dans un instant."))

        val etatAvant = try {
            s.updatePrinterState()
        } catch (e: Exception) {
            return fini(echec("erreur", "Imprimante injoignable : ${e.message}"))
        }
        if (etatAvant != PRETE) {
            val (code, message) = libelle(etatAvant)
            return fini(echec(code, message))
        }

        val verdict = CountDownLatch(1)
        val dejaRendu = AtomicBoolean(false)
        val rendre = { resultat: JSONObject ->
            if (dejaRendu.compareAndSet(false, true)) {
                fini(resultat)
                verdict.countDown()
            }
        }

        try {
            s.enterPrinterBuffer(true)
            for (tranche in tranches(ajuster(image, largeur(s)))) s.printBitmap(tranche, null)
            s.lineWrap(avance, null)
            s.exitPrinterBufferWithCallback(true, object : InnerResultCallback() {
                override fun onRunResult(reussi: Boolean) {}

                override fun onReturnString(resultat: String?) {}

                override fun onRaiseException(code: Int, message: String?) {
                    rendre(echec("erreur", message ?: "Erreur d'impression ($code)."))
                }

                override fun onPrintResult(code: Int, message: String?) {
                    if (code == 0) {
                        rendre(JSONObject().put("ok", true))
                        return
                    }
                    // L'état dit mieux que le message pourquoi le reçu n'est pas sorti.
                    val etatApres = try {
                        s.updatePrinterState()
                    } catch (e: Exception) {
                        PRETE
                    }
                    val (cle, texte) = if (etatApres == PRETE) "erreur" to (message ?: "Impression échouée.") else libelle(etatApres)
                    rendre(echec(cle, texte))
                }
            })
        } catch (e: Exception) {
            rendre(echec("erreur", "Impression impossible : ${e.message}"))
        }

        if (!verdict.await(DELAI_VERDICT_S, TimeUnit.SECONDS)) {
            rendre(echec("delai", "L'imprimante n'a rendu aucun verdict en $DELAI_VERDICT_S s."))
        }
    }

    /**
     * Ce terminal a-t-il une prise de tiroir-caisse ? Les Sunmi de comptoir
     * (T1, T2, D2, D3…) en ont une ; les portables (V2, V2 Pro, P2, L2…), non —
     * sauf le V3 MIX, dont la base en a une : le SDK l'ouvre par une commande
     * à part, et détaché de sa base il n'en a plus. Le service Sunmi ne le dit
     * pas : on le lit dans le modèle, et `null` pour le MIX, un modèle inconnu
     * ou une autre marque qui a repris le service — l'essai tranche.
     */
    fun aUnTiroir(): Boolean? {
        if (!Build.MANUFACTURER.equals("SUNMI", ignoreCase = true)) return null
        val materiel = try {
            SystemPropertyUtil.getProperty("ro.sunmi.hardware", "")
        } catch (e: Exception) {
            ""
        }.uppercase(Locale.ENGLISH)
        val modele = Build.MODEL.trim().uppercase(Locale.ENGLISH)
        if ("MIX" in materiel || "MIX" in modele) return null
        return when (modele.firstOrNull()) {
            'V', 'P', 'L' -> false
            'T', 'D' -> true
            else -> null
        }
    }

    /**
     * Ouvre le tiroir-caisse (`openDrawer()` du service Sunmi) et appelle
     * `fini` une seule fois. Passe par la file des reçus, sans la retenir :
     * demandé juste avant un reçu, il s'ouvre d'abord, et le reçu part aussitôt
     * après — sans attendre l'accusé du service.
     */
    fun ouvrirTiroir(fini: (JSONObject) -> Unit) {
        file.execute { ouvrirTiroirMaintenant(fini) }
    }

    private fun ouvrirTiroirMaintenant(fini: (JSONObject) -> Unit) {
        if (aUnTiroir() == false) return fini(echec("non-pris-en-charge", "Ce terminal n'a pas de prise de tiroir-caisse."))
        val s = service ?: return fini(echec("occupee", "Imprimante pas encore connectée : réessayer dans un instant."))

        val dejaRendu = AtomicBoolean(false)
        val rendre = { resultat: JSONObject ->
            if (dejaRendu.compareAndSet(false, true)) fini(resultat)
        }

        try {
            s.openDrawer(object : InnerResultCallback() {
                override fun onRunResult(reussi: Boolean) {
                    rendre(if (reussi) JSONObject().put("ok", true) else echec("erreur", "Le tiroir-caisse ne s'est pas ouvert."))
                }

                override fun onReturnString(resultat: String?) {}

                override fun onRaiseException(code: Int, message: String?) {
                    rendre(echec("erreur", message ?: "Tiroir-caisse : erreur $code."))
                }

                override fun onPrintResult(code: Int, message: String?) {}
            })
        } catch (e: InnerPrinterException) {
            // Le SDK refuse avant d'envoyer quoi que ce soit : « ce modèle, ou
            // cette version, ne prend pas en charge cette méthode ».
            return rendre(echec("non-pris-en-charge", "Ce terminal ne pilote pas de tiroir-caisse : ${e.message}"))
        } catch (e: Exception) {
            return rendre(echec("erreur", "Tiroir-caisse injoignable : ${e.message}"))
        }

        // Selon les versions du service, l'ordre part sans accusé : passé ce
        // délai, on le tient pour envoyé. Compté à part, pour libérer la file.
        minuteur.schedule({
            if (!dejaRendu.get()) Log.i(JOURNAL, "tiroir : pas d'accusé du service en $DELAI_TIROIR_S s, ordre tenu pour envoyé")
            rendre(JSONObject().put("ok", true))
        }, DELAI_TIROIR_S, TimeUnit.SECONDS)
    }

    /** Une image plus large que le papier est réduite ; jamais agrandie. */
    private fun ajuster(image: Bitmap, largeur: Int): Bitmap {
        if (image.width <= largeur) return image
        val hauteur = (image.height.toLong() * largeur / image.width).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(image, largeur, hauteur, false)
    }

    /** Un long reçu part en tranches : le service Sunmi refuse les images trop hautes. */
    private fun tranches(image: Bitmap): List<Bitmap> {
        if (image.height <= HAUTEUR_TRANCHE) return listOf(image)
        return (0 until image.height step HAUTEUR_TRANCHE).map { y ->
            Bitmap.createBitmap(image, 0, y, image.width, minOf(HAUTEUR_TRANCHE, image.height - y))
        }
    }

    private fun largeur(s: SunmiPrinterService): Int = try {
        if (s.printerPaper == PAPIER_80MM) LARGEUR_80MM else LARGEUR_58MM
    } catch (e: Exception) {
        LARGEUR_58MM
    }

    /** Le V2 Pro répond « POS-V2 » suivi d'un retour à la ligne. */
    private fun modele(s: SunmiPrinterService): String? = try {
        s.printerModal?.trim()?.takeIf { it.isNotEmpty() }
    } catch (e: Exception) {
        null
    }

    private fun etat(code: String, message: String, largeur: Int) =
        JSONObject().put("code", code).put("message", message).put("largeur", largeur)

    private fun echec(code: String, message: String) =
        JSONObject().put("ok", false).put("code", code).put("message", message)

    /** Les codes de `updatePrinterState()`, tels que les documente Sunmi. */
    private fun libelle(code: Int): Pair<String, String> = when (code) {
        1 -> "prete" to "Prête"
        2 -> "occupee" to "L'imprimante se prépare…"
        3 -> "erreur" to "Communication avec l'imprimante interrompue."
        4 -> "papier" to "Plus de papier."
        5 -> "surchauffe" to "Tête d'impression trop chaude : patienter une minute."
        6 -> "capot" to "Capot de l'imprimante ouvert."
        7 -> "erreur" to "Massicot bloqué."
        8 -> "occupee" to "Massicot en cours de rétablissement."
        9 -> "papier" to "Repère noir du papier introuvable."
        505 -> "absente" to "Aucune imprimante détectée sur ce terminal."
        507 -> "erreur" to "Échec de la mise à jour de l'imprimante."
        else -> "erreur" to "État d'imprimante inconnu ($code)."
    }

    companion object {
        private const val JOURNAL = "sunmi-print"
        private const val PRETE = 1
        private const val PAPIER_80MM = 2
        const val LARGEUR_58MM = 384
        const val LARGEUR_80MM = 576
        private const val HAUTEUR_TRANCHE = 800
        private const val DELAI_VERDICT_S = 60L
        private const val DELAI_TIROIR_S = 2L
    }
}
