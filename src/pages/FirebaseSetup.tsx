import { missingFirebaseConfig } from '../services/firebase';

function FirebaseSetup() {
  return (
    <section className="auth-card" aria-labelledby="setup-title">
      <div className="settings-heading">
        <span className="page-placeholder__icon" aria-hidden="true">
          <i className="bi bi-cloud-slash" />
        </span>
        <div>
          <h1 id="setup-title" className="h3 mb-1">Connect Firebase</h1>
          <p className="text-secondary mb-0">Firebase configuration is needed to sign in and save your data.</p>
        </div>
      </div>
      <ol className="setup-steps">
        <li>Create a Firebase project and register a web app.</li>
        <li>Enable Email/Password in Authentication and create a Firestore database.</li>
        <li>Copy <code>.env.example</code> to <code>.env</code> and fill in the web app configuration.</li>
        <li>Deploy the included Firestore rules before adding personal data.</li>
      </ol>
      <p className="small text-secondary mb-2">Missing or placeholder variables:</p>
      <ul className="config-list">
        {missingFirebaseConfig.map((key) => <li key={key}><code>{key}</code></li>)}
      </ul>
      <p className="small text-secondary mb-0">
        Firebase web app configuration is client-visible. Never put service-account credentials or private keys here.
      </p>
    </section>
  );
}

export default FirebaseSetup;
