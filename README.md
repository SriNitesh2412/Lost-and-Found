# CampusFind – Lost Something? Find It Here!
Structure: index.html, css/style.css, js/app.js, js/firebase-config.js, firestore.rules, storage.rules

## Firebase setup
1. console.firebase.google.com → Add project → Add a Web app → copy config into js/firebase-config.js
2. Build → Authentication → Sign-in method → enable Email/Password
3. Build → Firestore Database → Create (production mode) → Rules tab → paste firestore.rules → Publish
4. Build → Storage → Get started → Rules tab → paste storage.rules → Publish (Storage may need the Blaze plan; free quota is plenty for a college project)
5. Firestore may ask for composite indexes on first use: open the link shown in the browser console error and click Create.
6. First admin: register normally, then in Firestore → users → your doc → change role to "admin".

## Run locally (VS Code)
Install the "Live Server" extension → right-click index.html → Open with Live Server. (ES modules need http, not file://.)
Authentication → Settings → Authorized domains must include localhost.

## Deploy
Firebase Hosting: npm i -g firebase-tools; firebase login; firebase init hosting (public dir "."); firebase deploy.
GitHub Pages: push to GitHub → Settings → Pages → deploy from main branch; add your github.io domain to Firebase Authorized domains.
