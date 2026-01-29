# Guide de l'Application Mobile BarberPro

Félicitations ! Votre application web a été convertie avec succès en projet mobile hybride avec Capacitor.

## 🚀 Générer l'APK Android (Windows)

Vous pouvez générer l'APK directement sur votre ordinateur actuel.

### Prérequis
Vous devez avoir **Android Studio** installé. Si ce n'est pas le cas, téléchargez-le ici : [https://developer.android.com/studio](https://developer.android.com/studio).

### Étapes pour générer l'APK

1.  **Ouvrez Android Studio**.
2.  Cliquez sur **"Open"** (Ouvrir).
3.  Naviguez vers le dossier de votre projet et sélectionnez le dossier **`android`** :
    `d:\barberpro_version_finale_test_mobile\android`
4.  Attendez que Android Studio indexe le projet et installe les dépendances (Gradle sync). Cela peut prendre quelques minutes la première fois.
5.  Dans le menu du haut, cliquez sur **build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
6.  Une fois terminé, une notification apparaîtra en bas à droite ("APK(s) generated successfully"). Cliquez sur **"locate"** pour ouvrir le dossier contenant le fichier `.apk`.
7.  Vous pouvez transférer ce fichier sur votre téléphone (par USB, email, WhatsApp) et l'installer.

### Mouvements futurs (Mises à jour)

Si vous modifiez votre code web (React), voici comment mettre à jour l'app mobile :

1.  Ouvrez un terminal dans le dossier du projet.
2.  Lancez la commande magique qui reconstruit tout :
    ```bash
    npm run build:mobile
    npx cap sync
    ```
3.  Rouvrez Android Studio et lancez une nouvelle build (bouton "Play" ou Build APK).

---

## 🍎 Pour la version iOS (iPhone)

Le dossier `ios` a été créé, mais **Apple oblige à utiliser un Mac** pour compiler l'application finale.

1.  Copiez tout le dossier du projet `barberpro_version_finale_test_mobile` sur un Mac.
2.  Sur le Mac, ouvrez le terminal dans le dossier et lancez :
    ```bash
    npx cap sync ios
    npx cap open ios
    ```
3.  Cela ouvrira **Xcode**. De là, vous pourrez compiler pour l'iPhone ou l'App Store.

## ⚠️ Important : Production

L'application mobile est configurée pour "parler" directement à votre site en production :
**`https://barberpro.fr/api`**

Toute action faite sur l'application mobile (réservation, modification client) sera immédiatement visible sur votre site réel.
