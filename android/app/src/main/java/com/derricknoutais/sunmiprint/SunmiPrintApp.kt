package com.derricknoutais.sunmiprint

import android.app.Application

/**
 * Une seule imprimante pour toute l'application : le service local et la
 * WebView impriment par la même file, et deux reçus ne s'entrelacent jamais.
 */
class SunmiPrintApp : Application() {

    val reglages by lazy { Reglages(this) }

    val imprimante by lazy { Imprimante(this).also { it.lier() } }
}
