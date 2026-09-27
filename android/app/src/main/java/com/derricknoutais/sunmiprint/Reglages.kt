package com.derricknoutais.sunmiprint

import android.content.Context
import android.net.Uri

/** Ce que le terminal retient entre deux lancements. */
class Reglages(contexte: Context) {
    private val preferences = contexte.getSharedPreferences("reglages", Context.MODE_PRIVATE)

    /**
     * Les adresses autorisées à imprimer, une par ligne : https://storit.stapog.com,
     * http://192.168.1.20:8000… Seule leur origine compte (schéma, hôte, port).
     */
    var adresses: String
        get() = preferences.getString("adresses", "").orEmpty()
        set(valeur) = preferences.edit().putString("adresses", valeur).apply()

    /**
     * Accepter un certificat auto-signé — seulement pour une adresse du réseau
     * local, où tourne un serveur de développement (npx sunmi-https).
     */
    var certificatLocal: Boolean
        get() = preferences.getBoolean("certificat_local", false)
        set(valeur) = preferences.edit().putBoolean("certificat_local", valeur).apply()

    /** La première adresse : celle qu'on ouvre dans l'application en mode coque. */
    val adressePrincipale: String?
        get() = adresses.lines().map { it.trim() }.firstOrNull { origine(it) != null }

    fun origines(): Set<String> = adresses.lines().mapNotNull { origine(it) }.toSet()

    fun autorisee(origineDemandee: String?): Boolean {
        val o = origineDemandee?.let { origine(it) } ?: return false
        return o in origines()
    }

    companion object {
        /** « https://Storit.stapog.com/login » → « https://storit.stapog.com » ; `null` si ce n'est pas une adresse web. */
        fun origine(texte: String): String? {
            val u = Uri.parse(texte.trim())
            val schema = u.scheme?.lowercase() ?: return null
            val hote = u.host?.lowercase()?.takeIf { it.isNotEmpty() } ?: return null
            if (schema != "http" && schema != "https") return null
            val parDefaut = if (schema == "https") 443 else 80
            return if (u.port == -1 || u.port == parDefaut) "$schema://$hote" else "$schema://$hote:${u.port}"
        }
    }
}
