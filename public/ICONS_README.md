# Création des icônes PWA pour BarberPro

Les icônes suivantes sont nécessaires pour que votre PWA fonctionne correctement sur Play Store et les navigateurs mobiles :

## Icônes requises

1. **icon-192.png** (192x192 pixels)
   - Icône carrée avec logo BarberPro
   - Format : PNG avec transparence

2. **icon-192-maskable.png** (192x192 pixels)
   - Version "maskable" pour les icônes adaptatives Android
   - Le logo doit être centré avec marges appropriées

3. **icon-512.png** (512x512 pixels)
   - Icône haute résolution
   - Format : PNG avec transparence

4. **icon-512-maskable.png** (512x512 pixels)
   - Version "maskable" 512x512

5. **screenshot-540.png** (540x720 pixels)
   - Screenshot pour téléphone (narrow)
   - Interface BarberPro en mode portrait

6. **screenshot-1280.png** (1280x720 pixels)
   - Screenshot pour tablette/desktop (wide)
   - Interface BarberPro en mode paysage

## Options pour créer les icônes

### Option 1 : Avec un outil en ligne (Gratuit)
- https://www.pwabuilder.com/imageGenerator
- Uploadez votre logo et générez automatiquement toutes les icônes

### Option 2 : Avec Figma (Gratuit)
1. Créez un design 512x512 avec votre logo
2. Exportez en PNG pour chaque taille (192, 512)
3. Pour les versions "maskable", ajoutez des marges autour du logo

### Option 3 : Avec ImageMagick (Gratuit - CLI)
```bash
# Créer une icône 192x192 à partir d'une source plus grande
convert logo-original.png -resize 192x192 icon-192.png
convert logo-original.png -resize 512x512 icon-512.png
```

### Option 4 : En ligne de commande avec Node (Gratuit)
Installez `pwa-asset-generator`:
```bash
npm install -g pwa-asset-generator
pwa-asset-generator your-logo.png ./public --background "#000000"
```

## Conseil

Pour maintenant, vous pouvez utiliser un placeholder simple. Une fois votre branding établi, remplacez les icônes avec votre vrai logo.

## Validation

Après avoir ajouté les icônes, testez votre PWA :
1. Ouvrez votre app en production
2. Sur Chrome, appuyez sur le menu (⋮)
3. Sélectionnez "Installer BarberPro" ou "Installer l'app"
