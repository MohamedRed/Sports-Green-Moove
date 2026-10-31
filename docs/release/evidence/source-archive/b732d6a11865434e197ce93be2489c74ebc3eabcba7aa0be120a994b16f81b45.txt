import {createHash} from 'node:crypto';

const script = `document.querySelector('form').addEventListener('submit',async event=>{
event.preventDefault();const input=document.querySelector('input'),button=document.querySelector('button');
let accessKey=input.value;input.value='';button.disabled=true;
try{const response=await fetch('/handoff',{method:'POST',headers:{'Content-Type':'application/json','X-SGM-QA-Input':'1'},
body:JSON.stringify({accessKey}),cache:'no-store',redirect:'error'});accessKey='';
document.querySelector('[role=status]').textContent=response.ok?'Saisie terminée.':'Connexion non préparée.';
}catch{accessKey='';document.querySelector('[role=status]').textContent='Connexion non préparée.';}
});`;

export const credentialFormCsp = "default-src 'none'; script-src 'sha256-" + createHash('sha256').update(script).digest('base64') +
  "'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'";

export const privateCredentialFormPage = `<!doctype html><html lang="fr"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Connexion du téléphone de test</title>
<style>*{box-sizing:border-box}body{margin:0;padding:40px 20px;font:16px system-ui,sans-serif;color:#173327;background:#fff}
main{max-width:420px;margin:auto}h1{font-size:24px;margin:0 0 32px}label{display:block;margin-bottom:8px}
input,button{font:inherit;width:100%;min-height:44px;border-radius:6px}input{padding:10px;border:1px solid #66736c}
button{margin-top:20px;border:0;background:#1c693f;color:#fff;cursor:pointer}button:disabled{opacity:.6}
[role=status]{margin-top:20px;overflow-wrap:anywhere}</style><main><h1>Connexion du téléphone de test</h1>
<form autocomplete="off"><label for="access-key">Clé d’accès</label>
<input id="access-key" type="password" autocomplete="off" spellcheck="false" autocapitalize="none" required maxlength="256">
<button type="submit">Connecter</button></form><p role="status" aria-live="polite"></p></main>
<script>${script}</script></html>`;
