export function localFirebaseConfig(isDevelopment: boolean) {
  if (!isDevelopment) throw new Error("Local management testing is development-only.");
  return {
    apiKey: "local-emulator-only-api-key",
    authDomain: "demo-sgm-local-qa.firebaseapp.com",
    projectId: "demo-sgm-local-qa",
    databaseURL: "http://127.0.0.1:9000/?ns=demo-sgm-local-qa",
    appId: "1:123456789:web:localqa",
  };
}
