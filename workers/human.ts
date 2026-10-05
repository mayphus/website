import contentWorker from 'mayphus-content-worker';
import routes from 'mayphus-human-routes';
export function wantsHtml(accept: string|null): boolean {
 if(!accept)return false;
 const entries=accept.toLowerCase().split(',').map(part=>{const [type,...params]=part.trim().split(';');const q=params.find(p=>p.trim().startsWith('q='));return {type,q:q?Number(q.trim().slice(2)):1};});
 const html=entries.find(e=>e.type==='text/html')?.q || 0;
 const text=entries.find(e=>e.type==='text/plain')?.q || 0;
 return html>0 && html>=text;
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
  if((request.method==='GET'||request.method==='HEAD') && target && wantsHtml(request.headers.get('accept'))) {
   const asset=new URL(target,url.origin);
   const response=await env.ASSETS.fetch(new Request(asset,{method:request.method}));
   const headers=new Headers(response.headers);
   headers.set('Content-Type','text/html; charset=utf-8');
   headers.set('Vary','Accept');
   headers.set('Cache-Control','public, max-age=300');
   headers.set('X-Content-Type-Options','nosniff');
   return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
  }
  const response=await contentWorker.fetch(request,env,ctx);
  if(target) {
   const headers=new Headers(response.headers);headers.set('Vary','Accept');
   return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
  return response;
 }
};
