plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.derricknoutais.sunmiprint"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.derricknoutais.sunmiprint"
        // Le Sunmi V2 Pro tourne sous Android 7.1 (API 25).
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Sert la page de test embarquée sous une vraie origine https.
    implementation("androidx.webkit:webkit:1.12.1")
    // Le service d'impression des terminaux Sunmi.
    implementation("com.sunmi:printerlibrary:1.0.24")
}
