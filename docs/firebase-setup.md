# Firebase setup for TimeNest

This guide walks through creating a Firebase project and connecting it to TimeNest. You do not need to know Firebase beforehand.

> **Important:** TimeNest uses the Firebase **web app configuration**. It is intended for browser apps and is visible in the built website. Never put a Firebase service-account JSON file, service-account private key, or other server credential in this project, `.env`, or GitHub Actions variables.

## 1. Create a Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com/) and sign in with your Google account.
2. Select **Add project**.
3. Enter a project name, for example `TimeNest`, and continue.
4. Google Analytics is optional for TimeNest. You can turn it off if you do not need it.
5. Select **Create project**, wait for setup to finish, and open the project.

The Firebase project is where Authentication and Firestore will be configured. Remember the project ID; it is usually shown under the project name in **Project settings → General**.

## 2. Register a web app and find the configuration

1. On the project overview page, select the **Web** icon (`</>`), sometimes labelled **Add app**.
2. Enter an app nickname such as `TimeNest Web`.
3. Do not select Firebase Hosting; TimeNest deploys to GitHub Pages.
4. Select **Register app**.
5. Firebase displays the web app configuration, usually in a `firebaseConfig` code example. It contains values similar to:

   ```js
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.firebasestorage.app",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

6. Keep the Firebase page open or copy these values temporarily. If you leave the page, find them again under **Project settings** (gear icon) → **General** → **Your apps** → select the web app → **SDK setup and configuration** → **Config**.

Use the values Firebase shows for your project. Do not copy the example values above.

## 3. Turn on email and password sign-in

1. In the Firebase Console, open **Build → Authentication**.
2. Select **Get started** if prompted.
3. Open **Sign-in method** (in some console layouts this is under the **Sign-in providers** tab).
4. Select **Email/Password**.
5. Turn on the **Email/Password** option, then select **Save**.

Email link/passwordless sign-in is a separate option; it is not required for this app.

## 4. Create the Firestore database

1. Open **Build → Firestore Database**.
2. Select **Create database**.
3. Choose **Production mode**. Do not use test mode: test-mode rules can allow unintended access to data.
4. Choose a database location near where you expect to use the app. Firebase warns that the location cannot be changed after the database is created.
5. Select **Enable** and wait for the database to be ready.

Creating the database does not by itself make it safe to store user data. Deploy the TimeNest rules in the next step before using the app.

## 5. Deploy TimeNest's Firestore rules

The repository includes restrictive rules in [`firestore.rules`](../firestore.rules). The rules only allow signed-in users to access their own user-scoped documents and validate project, preference, and task document shapes. Deploy these rules before saving personal information.

1. Open PowerShell in the TimeNest project folder.
2. Sign in to Firebase CLI:

   ```powershell
   npx firebase login
   ```

3. Replace `YOUR_FIREBASE_PROJECT_ID` below with the **Project ID** from Firebase Project settings → General:

   ```powershell
   npx firebase deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
   ```

4. Check the Firebase CLI output for a successful rules deployment. You can also view the published rules under **Firestore Database → Rules** in the Console.

The repo's `firebase.json` points the Firebase CLI to the checked-in rules. Do not replace them with a broad rule such as `allow read, write: if request.auth != null`; that would let any signed-in user access documents belonging to other users if they know the path.

## 6. Connect your local app

1. In PowerShell, from the project folder, make a local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Open `.env` in a text editor. Fill the Firebase values by matching the config fields:

   | `.env` variable | Firebase config field |
   | --- | --- |
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

   For example, if Firebase shows `projectId: "timenest-12345"`, set:

   ```dotenv
   VITE_FIREBASE_PROJECT_ID=timenest-12345
   ```

   Keep `VITE_BASE_PATH=` empty for local development. Do not add a service-account key to this file.

3. Save `.env`, then start the app:

   ```powershell
   npm run dev
   ```

4. Open the local address Vite prints in the terminal. The Firebase setup screen should be replaced with a sign-in screen.
5. Choose **Create an account** to register your email and password. Then sign in and open **Settings** to save a project or preferences.

If sign-in reports that the provider is disabled, repeat Step 3 and confirm **Email/Password** is enabled. If Firebase reports an unauthorized domain, add the hostname (without `https://` or a path) to **Authentication → Settings → Authorized domains**.

## 7. Configure the GitHub Pages deployment

Local `.env` files are not uploaded to GitHub. To let the deployed website connect to Firebase:

1. Open the GitHub repository and select **Settings → Secrets and variables → Actions → Variables**.
2. Select **New repository variable** and add each of the six `VITE_FIREBASE_*` variable names from the table in Step 6, using the matching value from Firebase.
3. Do not include surrounding quotation marks or spaces around the value.
4. In **Settings → Pages**, make sure the deployment source is **GitHub Actions**.
5. Run the **Deploy to GitHub Pages** workflow from the **Actions** tab, or push a change to the `main` or `master` branch.
6. In the Firebase Console, open **Authentication → Settings → Authorized domains** and add the GitHub Pages hostname, for example `your-github-name.github.io`. Use only the hostname, not `https://` and not `/TimeNest/`. Add your custom domain instead if you deploy using one.
7. Open the deployed site and try creating an account.

The GitHub Actions workflow uses `/TimeNest/` as the Pages base path automatically. Firebase web configuration is included in frontend code, so these values are not passwords or service credentials. Never put service-account secrets in repository variables or frontend code.

## Troubleshooting

- **“Connect Firebase” screen still appears:** Check that all six values in `.env` are filled in without the example `your-...` placeholders. Restart `npm run dev` after editing `.env`.
- **`auth/operation-not-allowed`:** Enable the Email/Password provider in the Firebase Authentication settings.
- **`auth/unauthorized-domain`:** Add the hostname serving the app to Firebase Authentication's Authorized domains.
- **Permission denied in Settings:** Make sure the Firestore database exists and the repository's rules were deployed to the same Firebase project ID used in `.env`.
- **Project IDs do not match:** Compare `VITE_FIREBASE_PROJECT_ID` in `.env` with the project used by the `firebase deploy` command.

## Firebase documentation

- [Add Firebase to a JavaScript project](https://firebase.google.com/docs/web/setup)
- [Set up email/password authentication](https://firebase.google.com/docs/auth/web/password-auth)
- [Create a Firestore database](https://firebase.google.com/docs/firestore/quickstart)
- [Get started with Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
