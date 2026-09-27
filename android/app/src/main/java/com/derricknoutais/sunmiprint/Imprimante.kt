package com.derricknoutais.sunmiprint

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.InnerResultCallback
import com.sunmi.peripheral.printer.SunmiPrinterService
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * L'imprimante intégrée, par le service d'impression Sunmi.
 *
 * Chaque reçu part en mode « transaction » : les commandes s'accumulent dans
 * un tampon, puis l'imprimante rend un verdict sur le reçu entier. La page
 * apprend ainsi qu'il est réellement SORTI — pas seulement que la commande a
 * été acceptée — ou pourquoi il ne l'est pas : papier, capot, surchauffe.
 */
class Imprimante(private val contexte: Context) {

    @Volatile
    private var service: SunmiPrinterService? = null

    /** Faux sur un appareil sans service Sunmi : téléphone, émulateur. */
    @Volatile
    var estSunmi = false
        private set

    /** Un reçu à la fois : le suivant attend le verdict du précédent. */
    private val file = Executors.newSingleThreadExecutor()

    private val liaison = object : InnerPrinterCallback() {
        override fun onConnected(connecte: SunmiPrinterService) {
            service = connecte
        }

        override fun onDisconnected() {
            service = null
        }
    }

    fun lier() {
        estSunmi = try {
            InnerPrinterManager.getInstance().bindService(contexte, liaison)
        } catch (e: Exception) {
            Log.i(JOURNAL, "Pas de service d'impression Sunmi : ${e.message}")
            false
        }
    }

    fun delier() {
        if (estSunmi) {
            try {
                InnerPrinterManager.getInstance().unBindService(contexte, liaison)
            } catch (e: Exception) {
                Log.w(JOURNAL, "Déliaison : ${e.message}")
            }
        }
        service = null
    }

    fun etat(): JSONObject {
        if (!estSunmi) {
            return etat("simulation", "Pas d'imprimante Sunmi sur cet appareil : simulation, rien ne sera imprimé.", LARGEUR_58MM)
        }
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

    /** Imprime l'image et appelle `fini` une seule fois, avec le verdict. */
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

    private fun modele(s: SunmiPrinterService): String? = try {
        s.printerModal
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
        private const val JOURNAL = "SunmiPrint"
        private const val PRETE = 1
        private const val PAPIER_80MM = 2
        const val LARGEUR_58MM = 384
        const val LARGEUR_80MM = 576
        private const val HAUTEUR_TRANCHE = 800
        private const val DELAI_VERDICT_S = 60L
    }
}
