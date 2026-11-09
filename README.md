# 🎓 EnglishQuiz — Révision d'anglais multijoueur

Jeu de révision d'anglais en temps réel pour jouer entre amis à distance, sur PC et smartphone. Basé sur Node.js, Express et Socket.io.

---

## 🎮 Fonctionnalités

- **Multijoueur en temps réel** — jusqu'à 8 joueurs par salon
- **Code de salon** à 4 caractères (ex: `AB3K`)
- **4 catégories** : Verbes irréguliers, Vocabulaire, Grammaire (Present Perfect), Pièges d'examen
- **Génération automatique** de questions depuis la base de données
- **Chronomètre** avec bonus de rapidité
- **Tableau de bord hôte** — validation manuelle des réponses
- **Podium final** + récapitulatif des notions difficiles
- **Fiches de révision** intégrées (anti-sèche consultable à tout moment)
- **100% responsive** — optimisé mobile

---

## 🖥️ Installation locale (pour tester sur ton PC)

### Prérequis
- [Node.js v18+](https://nodejs.org/) installé
- [Git](https://git-scm.com/) installé

### Étapes

```bash
# 1. Clone ou ouvre le dossier du projet
cd d:\Projet\revision

# 2. Installe les dépendances
npm install

# 3. Lance le serveur
npm start
```

Ouvre ensuite **http://localhost:3000** dans ton navigateur.

Pour tester le multijoueur en local, ouvre plusieurs onglets sur `http://localhost:3000`.

---

## ☁️ Déploiement sur Render.com (accès 24h/24, PC éteint)

### Étape 1 — Créer un dépôt GitHub

1. Va sur [github.com](https://github.com) et connecte-toi
2. Clique sur **"New repository"** (bouton vert en haut à droite)
3. Nomme-le `english-quiz` (ou ce que tu veux)
4. Laisse-le **Public** (obligatoire pour le déploiement gratuit)
5. Ne coche rien (ni README, ni .gitignore) — on a déjà tout
6. Clique **"Create repository"**
7. GitHub te donne une URL comme : `https://github.com/TON-PSEUDO/english-quiz.git`

### Étape 2 — Pousser le code sur GitHub

Ouvre un terminal (PowerShell ou CMD) **dans le dossier du projet** :

```bash
cd d:\Projet\revision

# Initialise Git
git init

# Ajoute tous les fichiers
git add .

# Premier commit
git commit -m "🎓 Initial commit — EnglishQuiz multijoueur"

# Relie à ton dépôt GitHub (remplace l'URL par la tienne)
git remote add origin https://github.com/TON-PSEUDO/english-quiz.git

# Renomme la branche principale en "main"
git branch -M main

# Pousse le code
git push -u origin main
```

> 💡 Si Git te demande tes identifiants GitHub, entre ton nom d'utilisateur et un **Personal Access Token** (pas ton mot de passe). Crée-en un sur [github.com/settings/tokens](https://github.com/settings/tokens) avec le scope `repo`.

### Étape 3 — Déployer sur Render.com

1. Va sur [render.com](https://render.com) et crée un compte gratuit (tu peux te connecter avec GitHub)
2. Clique sur **"New +"** → **"Web Service"**
3. Clique sur **"Connect a repository"** et autorise Render à accéder à ton GitHub
4. Sélectionne ton dépôt `english-quiz`
5. Configure le service :
   - **Name** : `english-quiz` (ou ce que tu veux)
   - **Region** : Frankfurt (EU) — le plus proche de la France
   - **Branch** : `main`
   - **Runtime** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Plan** : **Free**
6. Clique **"Create Web Service"**
7. Attends 2-3 minutes que le déploiement se fasse
8. Render te donne une URL publique : `https://english-quiz-xxxx.onrender.com`

**C'est tout !** Partage cette URL avec tes amis pour jouer depuis n'importe où 🎉

### Étape 4 — Mise à jour du code (après modifications)

```bash
cd d:\Projet\revision
git add .
git commit -m "✨ Mes modifications"
git push
```

Render redéploie automatiquement dès que tu pousses sur `main`.

---

## ⚠️ Note sur le plan gratuit Render

Le plan gratuit met le serveur en **veille après 15 minutes d'inactivité** (redémarrage en ~30 secondes lors de la première visite).

### Solution : UptimeRobot (keepalive gratuit)

Pour maintenir le serveur actif 24h/24 :

1. Va sur [uptimerobot.com](https://uptimerobot.com) et crée un compte gratuit
2. Clique **"Add New Monitor"**
3. Configure :
   - **Monitor Type** : HTTP(s)
   - **Friendly Name** : `EnglishQuiz`
   - **URL** : `https://english-quiz-xxxx.onrender.com/health`
   - **Monitoring Interval** : **5 minutes**
4. Clique **"Create Monitor"**

UptimeRobot pingue ton serveur toutes les 5 minutes, l'empêchant de se mettre en veille. ✅

---

## 🚂 Alternative : Railway (500h/mois gratuites)

Si tu préfères Railway :

1. Va sur [railway.app](https://railway.app) et connecte-toi avec GitHub
2. Clique **"New Project"** → **"Deploy from GitHub repo"**
3. Sélectionne `english-quiz`
4. Railway détecte automatiquement Node.js et déploie
5. Va dans **Settings** → **Networking** → **Generate Domain** pour obtenir ton URL publique

Railway ne met pas en veille les services actifs, mais limite à 500h/mois sur le plan gratuit (suffisant pour un usage personnel/scolaire).

---

## 📁 Structure du projet

```
revision/
├── server.js                  # Serveur Node.js + Socket.io
├── package.json               # Configuration npm
├── .gitignore
├── README.md
├── data/
│   ├── irregular_verbs.json   # 86 verbes irréguliers
│   ├── vocabulary.json        # 80+ mots de vocabulaire thématique
│   ├── grammar.json           # Règles Present Perfect + 10 exercices
│   └── traps.json             # 15 pièges d'examen à corriger
└── public/
    ├── index.html             # SPA — interface complète
    ├── style.css              # CSS responsive mobile-first
    └── client.js              # Logique client Socket.io
```

---

## 🃏 Comment jouer

### L'hôte (celui qui crée la partie)

1. Va sur le site → **"Créer une partie"**
2. Entre ton pseudo et clique → un **code à 4 lettres** s'affiche
3. Partage ce code à tes amis
4. Configure la catégorie et la durée, puis clique **"Lancer la partie"**
5. Rédige une question (ou clique **"Générer une question"**) et envoie-la
6. Regarde les réponses arriver en direct, puis **valide ou refuse** chaque réponse
7. Les scores s'affichent, passe à la question suivante ou termine la partie

### Les joueurs

1. Va sur le site → **"Rejoindre"**
2. Entre ton pseudo et le code du salon
3. Attends que l'hôte lance la partie
4. Quand la question apparaît, **tape ta réponse** dans le champ et envoie avant la fin du chrono
5. Attends que l'hôte corrige → les scores s'affichent
6. Consulte les **📖 Fiches** depuis la barre de navigation pour réviser !

---

## 🏆 Système de points

| Situation | Points |
|---|---|
| Réponse correcte | +10 pts |
| Bonus si correct en ≤ 5 secondes | +3 pts |
| Bonus si correct en ≤ 10 secondes | +2 pts |
| Bonus si correct avant la fin | +1 pt |
| Réponse incorrecte | 0 pt |

---

## 🛠️ Technologies

- **Backend** : Node.js + Express + Socket.io
- **Frontend** : HTML5 + CSS3 + JavaScript vanilla
- **Déploiement** : Render.com / Railway
