package com.derricknoutais.sunmiprint

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Garde le service d'impression local en vie pendant que le navigateur est
 * au premier plan : un service « de premier plan », signalé par une
 * notification permanente, qu'Android ne tue pas pour faire de la place.
 */
class ServiceImpression : Service() {

    private var serveur: ServeurImpression? = null

    override fun onCreate() {
        super.onCreate()
        passerAuPremierPlan()
        val app = application as SunmiPrintApp
        serveur = ServeurImpression(app.imprimante, app.reglages, getExternalFilesDir(null)).also {
            it.demarrer()
            actif = it
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        serveur?.arreter()
        actif = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun passerAuPremierPlan() {
        val gestionnaire = getSystemService(NotificationManager::class.java)
        val constructeur = if (Build.VERSION.SDK_INT >= 26) {
            gestionnaire.createNotificationChannel(
                NotificationChannel(CANAL, "Service d'impression", NotificationManager.IMPORTANCE_MIN),
            )
            Notification.Builder(this, CANAL)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this).setPriority(Notification.PRIORITY_MIN)
        }

        val notification = constructeur
            .setSmallIcon(R.drawable.notification)
            .setContentTitle(getString(R.string.nom))
            .setContentText("Prête à imprimer pour les adresses autorisées")
            .setContentIntent(
                PendingIntent.getActivity(this, 0, Intent(this, AccueilActivity::class.java), PendingIntent.FLAG_IMMUTABLE),
            )
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION, notification)
        }
    }

    companion object {
        private const val CANAL = "impression"
        private const val NOTIFICATION = 1

        /** Le serveur en marche, pour l'écran d'accueil ; `null` si le service est arrêté. */
        @Volatile
        var actif: ServeurImpression? = null
            private set

        fun demarrer(contexte: Context) {
            val intent = Intent(contexte, ServiceImpression::class.java)
            if (Build.VERSION.SDK_INT >= 26) contexte.startForegroundService(intent) else contexte.startService(intent)
        }
    }
}
