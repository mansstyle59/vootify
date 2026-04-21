# 🎧 Vootify

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![Capacitor](https://img.shields.io/badge/Capacitor-iOS-119EFF?style=flat-square&logo=capacitor)](https://capacitorjs.com)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa)](https://web.dev/progressive-web-apps/)

> **The next-generation music & radio streaming experience.**

**Vootify** est une plateforme moderne de **streaming musical et radio live**, conçue pour offrir une expérience fluide, rapide et immersive sur mobile et web.

---

## 📲 Installer l'application

### Sur iPhone (via Safari)

> ⚠️ **Ce lien doit être ouvert depuis Safari sur votre iPhone.**

[![Installer Vootify](https://img.shields.io/badge/📲_Installer_Vootify_sur_iPhone-blue?style=for-the-badge)](itms-services://?action=download-manifest&url=https://raw.githubusercontent.com/mansstyle59/vootify/main/manifest.plist)

> L'application doit être signée avec un certificat Enterprise ou Ad-Hoc (UDID enregistré) pour que l'installation fonctionne.

### Progressive Web App (PWA)

Vootify est également disponible en tant que PWA : rendez-vous sur le site, puis utilisez l'option **"Ajouter à l'écran d'accueil"** depuis votre navigateur mobile.

---

## 🚀 Vision

Créer une application de streaming **simple, élégante et personnalisable**, permettant à chacun d'écouter ses flux audio préférés sans friction — sur mobile comme sur desktop.

---

## ✨ Fonctionnalités

| Catégorie | Détail |
|-----------|--------|
| 🎵 Musique | Streaming audio haute qualité (MP3 / M3U8) |
| 📻 Radio | Flux live en continu |
| 🔍 Recherche | Recherche de titres, artistes, albums et genres |
| 📚 Bibliothèque | Playlists, albums, artistes, favoris |
| 👤 Profil | Compte utilisateur, préférences personnalisées |
| 🛡️ Admin | Interface d'administration du contenu |
| 🎨 UI/UX | Dark mode, animations fluides (Framer Motion) |
| 📱 Mobile-first | Interface optimisée iOS & Android via Capacitor |
| 🔌 PWA | Installation en tant qu'application web progressive |
| 🔗 Partage | Partage de playlists via lien unique |

---

## 🧱 Architecture

```
Vootify
├── Frontend        React 18 + TypeScript (Vite)
├── UI              Tailwind CSS + Radix UI + Framer Motion
├── State           Zustand + TanStack Query
├── Auth / BDD      Supabase (PostgreSQL + Auth + Storage)
├── Mobile          Capacitor (iOS)
└── PWA             Vite Plugin PWA (Workbox)
```

---

## 🛠️ Tech Stack

| Couche | Technologie |
|--------|-------------|
| Framework | [React 18](https://react.dev) + [TypeScript 5](https://www.typescriptlang.org) |
| Build | [Vite 5](https://vitejs.dev) |
| Styling | [Tailwind CSS](https://tailwindcss.com) + [Radix UI](https://www.radix-ui.com) |
| Animations | [Framer Motion](https://www.framer.com/motion/) |
| State | [Zustand](https://zustand-demo.pmnd.rs) + [TanStack Query](https://tanstack.com/query) |
| Backend | [Supabase](https://supabase.com) (Auth, BDD, Storage) |
| Routing | [React Router v6](https://reactrouter.com) |
| Mobile | [Capacitor](https://capacitorjs.com) (iOS) |
| PWA | [vite-plugin-pwa](https://vite-pwa-org.netlify.app) |
| Tests | [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) |

---

## ⚙️ Getting Started

### Prérequis

- [Node.js](https://nodejs.org) ≥ 18
- [npm](https://npmjs.com) ou [bun](https://bun.sh)
- Un projet [Supabase](https://supabase.com) configuré

### 1. Cloner le dépôt

```bash
git clone https://github.com/mansstyle59/vootify.git
cd vootify
```

### 2. Installer les dépendances

```bash
npm install
# ou
bun install
```

### 3. Configurer les variables d'environnement

Créez un fichier `.env` à la racine du projet :

```env
VITE_SUPABASE_URL=https://<votre-project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<votre-anon-key>
```

### 4. Lancer le serveur de développement

```bash
npm run dev
```

L'application est accessible sur [http://localhost:8080](http://localhost:8080).

---

## 📦 Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarre le serveur de développement |
| `npm run build` | Build de production |
| `npm run preview` | Prévisualise le build de production |
| `npm run lint` | Analyse du code avec ESLint |
| `npm run test` | Lance les tests unitaires (Vitest) |
| `npm run test:watch` | Lance les tests en mode watch |

---

## 📱 Build iOS (Capacitor)

```bash
npm run build
npx cap sync ios
npx cap open ios
```

> Ouvrez le projet dans Xcode, sélectionnez votre cible et lancez l'app sur votre appareil.

---

## 🤝 Contribuer

Les contributions sont les bienvenues !

1. Forkez le dépôt
2. Créez une branche (`git checkout -b feature/ma-fonctionnalite`)
3. Commitez vos changements (`git commit -m 'feat: ajout de ma fonctionnalité'`)
4. Poussez la branche (`git push origin feature/ma-fonctionnalite`)
5. Ouvrez une Pull Request

---

## 📄 Licence

Ce projet est sous licence [MIT](LICENSE).
