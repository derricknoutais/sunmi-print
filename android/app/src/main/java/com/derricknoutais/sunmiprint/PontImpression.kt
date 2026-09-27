package com.derricknoutais.sunmiprint

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.webkit.JavascriptInterface
import org.json.JSONException
import org.json.JSONObject

/**
 * Ce que la page voit sous le nom `window.SunmiImpression` — le protocole que
 * parle src/pont.ts du paquet sunmi-print.
 *
 * Les méthodes tournent sur le fil du pont JavaScript, pas sur celui de
 * l'interface : les réponses repassent par `runOnUiThread`.
 *
 * Android injecte cet objet dans TOUTES les pages et tous les cadres de la
 * WebView ; chaque appel vérifie donc que la page affichée est bien
 * une adresse autorisée, ou la page de test embarquée.
 */
class PontImpression(private val activite: MainActivity, private val imprimante: Imprimante) {

    @JavascriptInterface
    fun version(): String = VERSION

    @JavascriptInterface
    fun etat(): String {
        if (!activite.pageDeConfiance()) return refus().put("largeur", Imprimante.LARGEUR_58MM).toString()
        return imprimante.etat().toString()
    }

    @JavascriptInterface
    fun imprimer(id: String, pngBase64: String, options: String) {
        if (!activite.pageDeConfiance()) return repondre(id, refus().put("ok", false))

        val avance = try {
            JSONObject(options).optInt("avance", 3)
        } catch (e: JSONException) {
            3
        }.coerceIn(0, 20)

        val image: Bitmap = try {
            val octets = Base64.decode(pngBase64, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(octets, 0, octets.size)
        } catch (e: IllegalArgumentException) {
            null
        } ?: return repondre(id, JSONObject().put("ok", false).put("code", "image").put("message", "Image du reçu illisible."))

        if (!imprimante.estSunmi) {
            // Téléphone ou émulateur : on montre le reçu au lieu de l'imprimer.
            activite.runOnUiThread { activite.montrerSimulation(image) }
            return repondre(id, JSONObject().put("ok", true).put("simulation", true))
        }

        imprimante.imprimer(image, avance) { resultat -> repondre(id, resultat) }
    }

    private fun repondre(id: String, resultat: JSONObject) {
        val script = "window.__sunmiPrint&&window.__sunmiPrint.retour(${JSONObject.quote(id)},${JSONObject.quote(resultat.toString())})"
        activite.runOnUiThread { activite.executer(script) }
    }

    private fun refus() = JSONObject()
        .put("code", "refusee")
        .put("message", "Cette page n'est pas autorisée à imprimer : seules les adresses autorisées dans Sunmi Print le sont.")

    companion object {
        /** Doit rester égale à VERSION_PONT dans src/pont.ts. */
        const val VERSION = "1"
    }
}
