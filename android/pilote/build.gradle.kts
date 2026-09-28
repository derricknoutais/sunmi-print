// Sans numéros de version : ils viennent de la construction qui inclut ce module
// (android/build.gradle.kts ici, ou celle de l'application ecoprint).
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.derricknoutais.sunmiprint"
    compileSdk = 35

    defaultConfig {
        // Le Sunmi V2 Pro tourne sous Android 7.1 (API 25).
        minSdk = 24
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
    // Le service d'impression des terminaux Sunmi.
    implementation("com.sunmi:printerlibrary:1.0.24")
}
