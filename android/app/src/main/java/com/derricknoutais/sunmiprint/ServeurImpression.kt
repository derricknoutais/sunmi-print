package com.derricknoutais.sunmiprint

import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import org.json.JSONException
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread

/**
 * Le service d'impression local : un serveur HTTP minuscule sur 127.0.0.1,
 * pour les pages ouvertes dans le NAVIGATEUR du terminal — src/serveur.ts du
 * paquet sunmi-print.
 *
 *   GET  /etat      → l'état de l'imprimante
 *   POST /imprimer  → {"image": "<PNG en base64>", "avance": 3} ; répond quand le reçu est sorti
 *
 * Écoute sur l'adresse de boucle seulement : injoignable depuis le réseau.
 * Ne répond qu'aux origines autorisées dans les réglages ; une requête sans
 * en-tête Origin ne vient pas d'un navigateur (curl, par adb) et passe.
 */
class ServeurImpression(
    private val imprimante: Imprimante,
    private val reglages: Reglages,
    private val dossierSimulation: File?,
    val port: Int = PORT,
) {
    private var socket: ServerSocket? = null
    private val connexions = Executors.newCachedThreadPool()

    @Volatile
    var enMarche = false
        private set

    @Volatile
    var erreur: String? = null
        private set

    fun demarrer() {
        if (enMarche) return
        val s = try {
            ServerSocket().apply {
                reuseAddress = true
                bind(InetSocketAddress(InetAddress.getByName("127.0.0.1"), port), 16)
            }
        } catch (e: IOException) {
            erreur = "Port $port indisponible : ${e.message}"
            Log.e(JOURNAL, erreur!!)
            return
        }
        socket = s
        erreur = null
        enMarche = true
        thread(name = "serveur-impression", isDaemon = true) {
            while (enMarche) {
                val client = try {
                    s.accept()
                } catch (e: IOException) {
                    break
                }
                connexions.execute { servir(client) }
            }
        }
    }

    fun arreter() {
        enMarche = false
        try {
            socket?.close()
        } catch (e: IOException) {
            Log.w(JOURNAL, "Fermeture : ${e.message}")
        }
        socket = null
    }

    private class Requete(val methode: String, val chemin: String, val entetes: Map<String, String>, val corps: ByteArray)

    private class Reponse(val statut: Int, val corps: String = "", val entetes: Map<String, String> = emptyMap())

    private fun servir(client: Socket) {
        try {
            client.use { c ->
                // Le verdict d'un long reçu peut prendre un moment : on attend.
                c.soTimeout = 90_000
                val requete = lire(BufferedInputStream(c.getInputStream())) ?: return
                ecrire(c.getOutputStream(), traiter(requete))
            }
        } catch (e: IOException) {
            Log.w(JOURNAL, "Connexion interrompue : ${e.message}")
        }
    }

    private fun traiter(r: Requete): Reponse {
        val origine = r.entetes["origin"]
        val cors = if (origine != null) mapOf("Access-Control-Allow-Origin" to origine, "Vary" to "Origin") else emptyMap()

        if (r.methode == "OPTIONS") {
            return Reponse(
                204,
                entetes = cors + mapOf(
                    "Access-Control-Allow-Methods" to "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers" to "Content-Type",
                    // Chrome récent : une page publique qui appelle le réseau local doit y être autorisée.
                    "Access-Control-Allow-Private-Network" to "true",
                    "Access-Control-Max-Age" to "600",
                ),
            )
        }

        // Le refus porte les en-têtes CORS : la page lit pourquoi, au lieu d'un échec réseau muet.
        if (origine != null && !reglages.autorisee(origine)) {
            return Reponse(
                403,
                JSONObject()
                    .put("ok", false)
                    .put("code", "refusee")
                    .put("message", "Adresse non autorisée à imprimer : ajouter $origine dans l'application Sunmi Print.")
                    .put("largeur", Imprimante.LARGEUR_58MM)
                    .toString(),
                cors,
            )
        }

        return when (r.methode + " " + r.chemin.substringBefore('?')) {
            "GET /etat" -> Reponse(200, imprimante.etat().put("version", PontImpression.VERSION).toString(), cors)
            "POST /imprimer" -> Reponse(200, imprimer(r.corps).toString(), cors)
            else -> Reponse(404, JSONObject().put("ok", false).put("code", "introuvable").put("message", "${r.methode} ${r.chemin} inconnu.").toString(), cors)
        }
    }

    private fun imprimer(corps: ByteArray): JSONObject {
        val (image, avance) = try {
            val json = JSONObject(String(corps, Charsets.UTF_8))
            val octets = Base64.decode(json.getString("image"), Base64.DEFAULT)
            BitmapFactory.decodeByteArray(octets, 0, octets.size) to json.optInt("avance", 3).coerceIn(0, 20)
        } catch (e: JSONException) {
            null to 0
        } catch (e: IllegalArgumentException) {
            null to 0
        }
        if (image == null) return echec("image", "Image du reçu illisible.")

        if (!imprimante.estSunmi) {
            // Appareil sans imprimante : le dernier reçu est gardé pour qu'on puisse le relire (adb pull).
            dossierSimulation?.let { dossier ->
                try {
                    File(dossier, "derniere-impression.png").outputStream().use { image.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
                } catch (e: IOException) {
                    Log.w(JOURNAL, "Simulation non enregistrée : ${e.message}")
                }
            }
            return JSONObject().put("ok", true).put("simulation", true)
        }

        val verdict = AtomicReference<JSONObject>()
        val fini = CountDownLatch(1)
        imprimante.imprimer(image, avance) {
            verdict.set(it)
            fini.countDown()
        }
        return if (fini.await(75, TimeUnit.SECONDS)) verdict.get() else echec("delai", "L'imprimante n'a rendu aucun verdict.")
    }

    private fun echec(code: String, message: String) = JSONObject().put("ok", false).put("code", code).put("message", message)

    /** Lit une requête HTTP/1.1 : ligne de requête, en-têtes, corps selon Content-Length. */
    private fun lire(entree: InputStream): Requete? {
        val tete = ByteArrayOutputStream()
        var fin = 0
        while (fin < 4) {
            val octet = entree.read()
            if (octet == -1) return null
            tete.write(octet)
            fin = when {
                (fin == 0 || fin == 2) && octet == '\r'.code -> fin + 1
                (fin == 1 || fin == 3) && octet == '\n'.code -> fin + 1
                octet == '\r'.code -> 1
                else -> 0
            }
            if (tete.size() > TAILLE_MAX_ENTETES) return null
        }

        val lignes = tete.toString(Charsets.ISO_8859_1.name()).split("\r\n")
        val premiere = lignes.first().split(' ')
        if (premiere.size < 2) return null

        val entetes = lignes.drop(1)
            .filter { ':' in it }
            .associate { it.substringBefore(':').trim().lowercase() to it.substringAfter(':').trim() }

        val longueur = entetes["content-length"]?.toIntOrNull() ?: 0
        if (longueur < 0 || longueur > TAILLE_MAX_CORPS) return null
        val corps = ByteArray(longueur)
        var lu = 0
        while (lu < longueur) {
            val n = entree.read(corps, lu, longueur - lu)
            if (n == -1) return null
            lu += n
        }
        return Requete(premiere[0].uppercase(), premiere[1], entetes, corps)
    }

    private fun ecrire(sortie: OutputStream, r: Reponse) {
        val corps = r.corps.toByteArray(Charsets.UTF_8)
        val tete = StringBuilder("HTTP/1.1 ${r.statut} ${raison(r.statut)}\r\n")
        if (corps.isNotEmpty()) tete.append("Content-Type: application/json; charset=utf-8\r\n")
        tete.append("Content-Length: ${corps.size}\r\n")
        tete.append("Cache-Control: no-store\r\n")
        tete.append("Connection: close\r\n")
        for ((nom, valeur) in r.entetes) tete.append("$nom: $valeur\r\n")
        tete.append("\r\n")
        sortie.write(tete.toString().toByteArray(Charsets.ISO_8859_1))
        sortie.write(corps)
        sortie.flush()
    }

    private fun raison(statut: Int) = when (statut) {
        200 -> "OK"
        204 -> "No Content"
        403 -> "Forbidden"
        404 -> "Not Found"
        else -> "Error"
    }

    companion object {
        const val PORT = 17321
        private const val JOURNAL = "SunmiPrint"
        private const val TAILLE_MAX_ENTETES = 16 * 1024
        /** Un reçu de trois mètres en PNG tient largement dedans. */
        private const val TAILLE_MAX_CORPS = 8 * 1024 * 1024
    }
}
