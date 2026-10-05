// Local QA server for the exact deployment bundle. It never uploads or deploys.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import worker from '../.cache/worker.mjs';
const types={'.css':'text/css','.js':'text/javascript','.json':'application/json','.xml':'application/xml','.html':'text/html','.txt':'text/plain'};
const env={ASSETS:{async fetch(request){const url=new URL(typeof request==='string'?request:request.url);const path=url.pathname==='/'?'/index.html':url.pathname;const filename=resolve('dist','.'+path);if(!filename.startsWith(resolve('dist')+'/'))return new Response('missing',{status:404});try{const body=await readFile(filename);const ext=path.slice(path.lastIndexOf('.'));return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':(types[ext]||'application/octet-stream')+'; charset=utf-8'}});}catch{return new Response('missing',{status:404});}}}};
createServer(async(req,res)=>{try{const request=new Request('http://127.0.0.1:8789'+req.url,{method:req.method,headers:req.headers});const response=await worker.fetch(request,env,{waitUntil(){}});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(error){res.writeHead(500);res.end(String(error));}}).listen(8789,'127.0.0.1',()=>console.log('Exact worker preview at http://127.0.0.1:8789'));
