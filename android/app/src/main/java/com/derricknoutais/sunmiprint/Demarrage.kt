package com.derricknoutais.sunmiprint

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Relance le service d'impression au démarrage du terminal, sans qu'on ait à ouvrir l'application. */
class Demarrage : BroadcastReceiver() {
    override fun onReceive(contexte: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) ServiceImpression.demarrer(contexte)
    }
}
