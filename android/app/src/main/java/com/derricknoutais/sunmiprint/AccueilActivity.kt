package com.derricknoutais.sunmiprint

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * L'écran d'accueil : l'état de l'imprimante et du service, les adresses
 * autorisées à imprimer, et la page de test. Construit en code, sans fichier
 * de mise en page : il n'a que quelques éléments.
 */
class AccueilActivity : Activity() {

    private val app get() = application as SunmiPrintApp
    private lateinit var etat: TextView

    override fun onCreate(etatSauve: Bundle?) {
        super.onCreate(etatSauve)
        // Le service démarre avec l'application, puis au démarrage du terminal.
        ServiceImpression.demarrer(this)
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 0)

        val colonne = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(24))
        }

        colonne.addView(TextView(this).apply {
            text = getString(R.string.nom)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 24f)
            setTypeface(typeface, Typeface.BOLD)
        })

        etat = TextView(this).apply {
            setPadding(0, dp(8), 0, dp(16))
            setLineSpacing(0f, 1.2f)
        }
        colonne.addView(etat)

        colonne.addView(titre("Adresses autorisées à imprimer"))
        colonne.addView(TextView(this).apply {
            text = "Une par ligne. Les pages de ces adresses, ouvertes dans le navigateur du terminal, impriment par le service local."
            setPadding(0, 0, 0, dp(8))
        })
        val adresses = EditText(this).apply {
            hint = "https://storit.stapog.com"
            setText(app.reglages.adresses)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            minLines = 2
            gravity = Gravity.TOP or Gravity.START
        }
        colonne.addView(adresses, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        val certificat = CheckBox(this).apply {
            text = "Mode coque : accepter un certificat auto-signé sur le réseau local (serveur de développement)"
            isChecked = app.reglages.certificatLocal
            setPadding(dp(4), dp(12), 0, dp(12))
        }
        colonne.addView(certificat)

        val enregistrer = {
            app.reglages.adresses = adresses.text.lines().map { it.trim() }.filter { it.isNotEmpty() }.joinToString("\n")
            app.reglages.certificatLocal = certificat.isChecked
            adresses.setText(app.reglages.adresses)
            actualiser()
        }

        colonne.addView(bouton("Enregistrer") { enregistrer() })
        colonne.addView(bouton("Tester l'imprimante") {
            startActivity(Intent(this, MainActivity::class.java).putExtra(MainActivity.EXTRA_ADRESSE, MainActivity.PAGE_DE_TEST))
        })
        colonne.addView(bouton("Ouvrir la première adresse ici (mode coque)") {
            enregistrer()
            val adresse = app.reglages.adressePrincipale
            if (adresse != null) startActivity(Intent(this, MainActivity::class.java).putExtra(MainActivity.EXTRA_ADRESSE, adresse))
        })

        colonne.addView(TextView(this).apply {
            text = "Mode coque : la page s'ouvre dans cette application, avec le WebView du système " +
                "(Chrome 62 sur un V2 Pro) — une application web moderne peut ne pas y démarrer. " +
                "Préférer le navigateur du terminal : il imprime par le service local.\n\n" +
                "Version ${BuildConfig.VERSION_NAME} — protocole ${PontImpression.VERSION} — port ${ServeurImpression.PORT}"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            setPadding(0, dp(24), 0, 0)
        })

        setContentView(ScrollView(this).apply { addView(colonne) })
    }

    override fun onResume() {
        super.onResume()
        actualiser()
        // La liaison au service Sunmi et le démarrage du serveur prennent un instant.
        etat.postDelayed({ actualiser() }, 1500)
    }

    private fun actualiser() {
        val imprimante = app.imprimante.etat()
        val serveur = ServiceImpression.actif
        val service = when {
            serveur == null -> "Service local : démarrage…"
            !serveur.enMarche -> "Service local : ARRÊTÉ — ${serveur.erreur ?: "raison inconnue"}"
            else -> "Service local : en écoute sur 127.0.0.1:${serveur.port}"
        }
        val origines = app.reglages.origines()
        etat.text = listOf(
            "Imprimante : ${imprimante.optString("message")}" + (imprimante.optString("modele").takeIf { it.isNotEmpty() }?.let { " ($it)" } ?: ""),
            "Papier : ${imprimante.optInt("largeur")} points (${if (imprimante.optInt("largeur") >= 576) "80" else "58"} mm)",
            service,
            if (origines.isEmpty()) "Aucune adresse autorisée : aucune page ne peut imprimer." else "Autorisées : ${origines.joinToString(", ")}",
        ).joinToString("\n")
    }

    private fun titre(texte: String) = TextView(this).apply {
        text = texte
        setTypeface(typeface, Typeface.BOLD)
        setPadding(0, dp(8), 0, dp(4))
    }

    private fun bouton(texte: String, action: () -> Unit) = Button(this).apply {
        text = texte
        setOnClickListener { action() }
        layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) }
    }

    private fun dp(valeur: Int): Int = (valeur * resources.displayMetrics.density).toInt()
}
