import contentWorker from 'mayphus-content-worker';
import routes from 'mayphus-human-routes';
export function wantsHtml(accept: string|null): boolean {
 if(!accept)return false;
 const entries=accept.toLowerCase().split(',').map(part=>{const [type,...params]=part.trim().split(';');const q=params.find(p=>p.trim().startsWith('q='));return {type,q:q?Number(q.trim().slice(2)):1};});
 const html=entries.find(e=>e.type==='text/html')?.q || 0;
 const text=entries.find(e=>e.type==='text/plain')?.q || 0;
 return html>0 && html>=text;
}
// Link-preview bots commonly request */*. Explicit representations remain authoritative.
export function wantsSocialHtml(accept:string|null,userAgent:string|null):boolean {
 if(!/(?:Twitterbot|facebookexternalhit|Facebot|LinkedInBot|Pinterestbot|Slackbot-LinkExpanding|Discordbot|TelegramBot|WhatsApp)/i.test(userAgent||''))return false;
 const ranges=(accept||'').toLowerCase().split(',').map(part=>part.trim()).filter(Boolean);
 return ranges.length===0 || ranges.every(part=>/^\*\/\*(?:\s*;\s*q=(?:1(?:\.0*)?|0?\.[0-9]*[1-9][0-9]*))?$/.test(part));
}
function routeFor(path:string):string {
 if(path.endsWith('/index.html'))return path.slice(0,-10);
 return path.endsWith('/')?path:path+'/';
}
export default {
 ...contentWorker,
 async fetch(request:Request,env:any,ctx:any) {
  const url=new URL(request.url);
  if(url.pathname.startsWith('/_human/'))return new Response('Not found',{status:404});
  const route=routeFor(url.pathname);
  const target=(routes as Record<string,string>)[route];
  const html=wantsHtml(request.headers.get('accept')) || wantsSocialHtml(request.headers.get('accept'),request.headers.get('user-agent'));
  const indexText=['/journal/','/work/','/archive/'].includes(route) && !html;
  if((request.method==='GET'||request.method==='HEAD') && target && (html || indexText)) {
   const asset=new URL(indexText?route+'index.txt':target,url.origin);
   const response=await env.ASSETS.fetch(new Request(asset,{method:request.method}));
   const headers=new Headers(response.headers);
   headers.set('Content-Type',indexText?'text/plain; charset=utf-8':'text/html; charset=utf-8');
   headers.set('Vary','Accept, User-Agent');
   headers.set('Cache-Control','public, max-age=300');
   headers.set('X-Content-Type-Options','nosniff');
   if(url.hostname.endsWith('.workers.dev')) {
    headers.set('Cache-Control','no-store');
    headers.set('X-Mayphus-Environment','review');
    headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
   }
   return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
  }
  const response=await contentWorker.fetch(request,env,ctx);
  if(target) {
   const headers=new Headers(response.headers);headers.set('Vary','Accept, User-Agent');
   return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
  return response;
 }
};
