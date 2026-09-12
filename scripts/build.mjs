import {mkdir,copyFile} from 'node:fs/promises';
import { build } from 'esbuild';
await build({entryPoints:['src/firebase-app.js'],bundle:true,outfile:'public/firebase-app.js',format:'iife',target:'es2022',minify:true});
console.log('Built public/firebase-app.js');

await mkdir('public/vendor',{recursive:true});
for (const [from,to] of [['react/umd/react.production.min.js','react.js'],['react-dom/umd/react-dom.production.min.js','react-dom.js'],['@babel/standalone/babel.min.js','babel.js']]) await copyFile('node_modules/'+from,'public/vendor/'+to);
