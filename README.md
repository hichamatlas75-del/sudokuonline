# Sudoku Online (Sudoku.com Clone)

Application Web de Sudoku gratuite en ligne inspirée de **Sudoku.com**, développée en HTML5, CSS3 et JavaScript Vanilla (sans dépendances externes).

## Fonctionnalités
- **6 niveaux de difficulté** : Facile, Moyen, Difficile, Expert, Maître, Extrême (générateur avec solution unique garantie).
- **Gameplay complet façon Sudoku.com** :
  - Surlignage intelligent (case sélectionnée, ligne, colonne, bloc 3×3 et chiffres identiques).
  - Compteur d'erreurs (`0/3`) avec option **Seconde chance**.
  - Mode **Notes (Crayon)** avec retrait automatique des notes obsolètes et bouton **✨ Notes auto**.
  - Mode **⚡ Chiffre d'abord** (saisie rapide).
  - **Indices intelligents** expliquant la technique logique (*Singleton nu*, *Singleton caché*, etc.).
  - **Annuler** (`Ctrl+Z` / `U`), **Gomme** (`Suppr`), **Chronomètre & Pause** (`P`).
- **3 Thèmes visuels** : Clair, Sépia et Sombre.
- **Sauvegarde automatique** de la partie en cours et **Statistiques détaillées** par niveau dans `localStorage`.

## Son & animations
- **Sons synthétisés** (Web Audio API, aucun fichier audio) : une note de gamme pentatonique par chiffre posé, buzz d'erreur, glissandos pour Annuler/Gomme, arpège d'indice, arpège de ligne/colonne/bloc complété, carillon quand les 9 exemplaires d'un chiffre sont placés, fanfare de victoire, descente de fin de partie, sons de pause/reprise/nouvelle partie.
- **Bouton 🔊 dans la barre** et touche **M** pour couper/activer le son ; volume réglable dans les Paramètres.
- **Animations** : rebond du chiffre posé, secousse + halo rouge sur erreur, points flottants (`+120`), apparition en diagonale de la grille, onde de victoire, confettis, trophée qui rebondit, compteur de score animé, modales en fondu/zoom.
- Réglage **Animations** (désactivable) ; respecte automatiquement `prefers-reduced-motion`.
- Nouveaux fichiers : `sound.js` (moteur audio) et `effects.js` (points flottants, compteur, confettis).

## Mobile & PWA
- **Mobile d'abord** : la partie tient sur un écran de téléphone (grille pleine largeur, bornée par la hauteur disponible), difficultés défilantes au doigt, contrôles dans l'ordre du pouce (actions → chiffres 1-9 sur une ligne → outils), modales en feuilles qui montent du bas, indice en bandeau flottant, support des encoches (`safe-area`), paysage en 2 colonnes.
- **Pause automatique** quand l'app passe en arrière-plan, **vibrations** (réglables) sur erreur / ligne complétée / victoire, couleur de la barre système synchronisée avec le thème.
- **PWA installable et 100 % hors ligne** : `manifest.webmanifest`, `sw.js` (cache de l'application), icônes dans `icons/` (dont maskable), bouton **Installer** (Android/Chrome/Edge/desktop) et astuce d'installation sur iOS.
- **Mises à jour** : un bandeau « Mettre à jour » apparaît quand une nouvelle version est prête.

### Déploiement
- Nécessite **HTTPS** (ou `localhost`) ; en ouverture directe `file://` le jeu fonctionne mais sans mode hors ligne ni installation.
- ⚠️ **À chaque déploiement modifiant un fichier, incrémentez `VERSION` dans `sw.js`** (sinon les visiteurs gardent l'ancienne version en cache).
- Le fichier `_headers` (Cloudflare Pages / Netlify) empêche la mise en cache HTTP de `sw.js` et du manifeste.
- Si vous ajoutez un fichier au jeu, ajoutez-le aussi à la liste `SHELL` de `sw.js`.

## Lancer en local
Ouvrez simplement `index.html` dans votre navigateur (ou servez le dossier, ex. `npx serve`, pour tester la PWA sur `localhost`).
