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

## Lancer en local
Ouvrez simplement `index.html` dans votre navigateur.
