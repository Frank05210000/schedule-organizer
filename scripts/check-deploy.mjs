import {readFile} from 'node:fs/promises';
const config=JSON.parse(await readFile('public/firebase-config.json','utf8'));
if(!process.env.GCLOUD_PROJECT || config.projectId!==process.env.GCLOUD_PROJECT)throw Error('Hosting target must match public/firebase-config.json projectId.');
if(config.projectId.startsWith('demo-') || !config.apiKey || !config.appId || config.authDomain!==`${config.projectId}.firebaseapp.com`)throw Error('Set a real Firebase Web App configuration before publishing.');
const html=await readFile('public/index.html','utf8');
if(/pin: '\d+'|示範 PIN|Demo PIN|meetslot-overrides-v1/.test(html))throw Error('Demo credentials or old local persistence found in deployment HTML.');
console.log('Hosting configuration matches the explicit deployment target.');
