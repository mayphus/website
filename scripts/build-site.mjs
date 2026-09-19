import {execFileSync} from 'node:child_process';
import {cp, mkdir, rm, readFile, writeFile, readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {contentSource} from './content-source.mjs';
import {render} from './render.mjs';
export async function buildSite({checkContent=false}={}) {
 const {source,commit} = await contentSource();
 execFileSync('npm',['run',checkContent ? 'check' : 'build'],{cwd:source,stdio:'inherit'});
 await rm('dist',{recursive:true,force:true});
 await cp(resolve(source,'dist'),'dist',{recursive:true});
 const content = JSON.parse(await readFile('dist/homepage.json','utf8'));
 for (const file of await readdir('public')) {
  // A renderer may not silently replace content assets or data.
  try { await readFile(resolve('dist',file)); throw new Error(`Renderer collides with content: ${file}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
 }
 await cp('public','dist',{recursive:true});
 await writeFile('dist/index.html',render(await readFile('public/index.html','utf8'),content));
 await mkdir('.cache',{recursive:true});
 await build({entryPoints:[resolve(source,'workers/worker.ts')],outfile:'.cache/worker.mjs',bundle:true,format:'esm',platform:'neutral',target:'es2022'});
 await writeFile('.cache/build.json',JSON.stringify({contentCommit:commit})+'\n');
 console.log(`Website built with content ${commit}.`);
 return {source,commit};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildSite();
