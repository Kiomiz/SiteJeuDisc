# Quiz Night — Roadmap

## ✅ Fait

- [x] Schéma Convex : `players`, `weeks`, `scores`
- [x] Convex functions : `players.ts`, `weeks.ts`, `scores.ts`
- [x] Composants : `PlayerGrid`, `CreatePlayerModal`, `WeekNav`
- [x] Page Home (`/`) : sélection joueur + semaine → route `/week/[weekId]`
- [x] Page Leaderboard (`/leaderboard`) : classement général all-time
- [x] Setup Convex (`providers.tsx`)

---

## 🔲 À faire

### Étape 1 — Schéma Convex ✅
- [x] Ajouter table `questions` : `weekId`, `number` (1-100), `text`, `answer`, `category?`
- [x] Ajouter table `answers` : `playerId`, `weekId`, `questionNumber`, `text`, `points?`
- [x] Ajouter champs `gameState` dans `weeks` : `phase` (`waiting` | `question` | `correction` | `finished`), `currentQuestionIndex`, `shuffledOrder` (tableau JSON)

### Étape 2 — Convex functions ✅
- [x] `questions.ts` : `listByWeek`, `create`, `seed` (import 100 questions)
- [x] `answers.ts` : `submit`, `listByQuestion`, `attributePoints`
- [x] Mettre à jour `weeks.ts` : `get`, `startGame`, `nextQuestion`, `startCorrection`, `resumeGame`, `finishGame`

### Étape 3 — Panel Admin (`/admin`) ✅
- [x] Créer une semaine (numéro, titre, type de jeu)
- [x] Importer les questions (coller le .txt, parse `N-->Question`, clearAndSeed)
- [x] Bouton "Lancer la partie" → passe la semaine en phase `question`

### Étape 4 — Page Joueur (`/week/[weekId]`) ✅
- [x] Afficher la question courante (numéro original + texte)
- [x] Champ de saisie de réponse (bloqué côté serveur si question changée)
- [x] Afficher son score en direct
- [x] Afficher la phase actuelle (`waiting`, `correction`, `finished`)

### Étape 5 — Page Host (`/week/[weekId]/host`) ✅
- [x] Voir toutes les réponses des joueurs en temps réel
- [x] Voir qui n'a pas encore répondu
- [x] Bouton "Question suivante"
- [x] Bouton "Passer en correction" (suggestion auto toutes les 20 questions)
- [x] Scores en direct (sidebar)
- [x] Bouton "Terminer la partie" avec confirmation

### Étape 6 — Mode Correction ✅
- [x] Host voit : question + réponse joueur par joueur
- [x] Boutons rapides 0/1/2/3 pts + champ libre
- [x] Valider → joueur suivant → question suivante automatiquement
- [x] Retour en mode `question` après correction (`finishCorrection`)

### Étape 7 — Fin de partie ✅
- [x] Podium complet : top 3 avec médailles + reste en liste, joueur courant surligné
- [x] Bouton "Relancer" (host page + admin) → reshuffle + repart de zéro

---

## Stack
- **Frontend** : Next.js + React + TailwindCSS
- **Backend temps réel** : Convex
- **State local** : Zustand (installé, pas encore utilisé)
- **Animations** : Framer Motion (installé, pas encore utilisé)
