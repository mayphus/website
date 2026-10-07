import MarkdownIt from 'markdown-it';
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
export const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const markdown = new MarkdownIt({html:false,linkify:true});
markdown.validateLink = value => /^(?:https?:|mailto:|#|\/)/i.test(value) || !/^[a-z][a-z0-9+.-]*:/i.test(value);
markdown.renderer.rules.table_open = () => '<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable data table"><table>\n';
markdown.renderer.rules.table_close = () => '</table></div>\n';
const plain = value => String(value ?? '').replace(/\s+/g,' ').trim();
const dateLabel = date => date && !Number.isNaN(Date.parse(date)) ? new Intl.DateTimeFormat('en',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date)) : '';
const kind = doc => ({article:'Article',project:'Project',note:'Note',page:'Page'}[doc.metadata?.type] || 'Record');
const dated = docs => [...docs].sort((a,b)=>(b.metadata?.date || '').localeCompare(a.metadata?.date || '') || a.title.localeCompare(b.title));
export function viewUrl(doc) {
 const url = new URL(doc.url);
 return url.pathname === '/' && url.hash ? `/notes/${encodeURIComponent(decodeURIComponent(url.hash.slice(1)))}/` : url.pathname;
}
// Images remain references to media already present in the canonical public text.
export function recordImages(doc) {
 const found=new Map();
 const pattern=/https:\/\/mayphus\.org\/media\/[^\s()<>"']+?\.(?:png|jpe?g|webp)(?=[\s)<>"']|$)/gi;
 for(const match of doc.text.matchAll(pattern)) {
  const before=doc.text.slice(0,match.index).split(/[)\n]/).at(-1).replace(/\($/,'').trim();
  const caption=before && before.length<240 && !before.includes('https:') ? before : doc.title;
  if(!found.has(match[0])) found.set(match[0],{url:match[0],caption});
 }
 return [...found.values()];
}
function rows(docs,{level=3}={}) {
 if (!docs.length) return '<p class="empty">No entries are published here yet.</p>';
 return '<ol class="entry-list">'+docs.map(doc=>`<li class="entry"><div class="entry-meta"><span>${escape(kind(doc))}</span>${doc.metadata?.date?`<time datetime="${escape(doc.metadata.date)}">${escape(dateLabel(doc.metadata.date))}</time>`:''}</div><div class="entry-copy"><h${level}><a href="${escape(viewUrl(doc))}">${escape(doc.title)}</a></h${level}><p>${escape(plain(doc.summary))}</p></div></li>`).join('')+'</ol>';
}
function curatedPhotoGallery(text) {
 const pairs=/([^()]*)\((https:\/\/mayphus\.org\/media\/[^)]+\.(?:png|jpe?g|webp))\)\s+\(\2\)/gi;
 const photos=[];
 for (const match of text.matchAll(pairs)) {
  const caption=match[1].trim().split("\n").at(-1).trim();
  if (!caption || /^Photo \d+ attached|^Screenshot from/i.test(caption)) continue;
  photos.push({caption,url:match[2]});
  if (photos.length===6) break;
 }
 return photos;
}
function shell({title,description,url='https://mayphus.org/',language='en',home,current='',body,article=false,date='',root=false}) {
 if(!/^https:\/\/github\.com\/[A-Za-z0-9_-]+\/?$/.test(home.github))throw Error('Invalid canonical GitHub URL');
 const email=home.email;
 if(!/^[^\s<>"'@]+@[^\s<>"'@]+\.[^\s<>"'@]+$/.test(email))throw Error('Invalid canonical contact email');
 const structured={'@context':'https://schema.org','@type':article?'Article':'WebPage',name:title,url,description,...(article?{headline:title,author:{'@type':'Person',name:home.title},...(date?{datePublished:date}:{})}:{})};
 return `<!doctype html><html lang="${escape(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}${title===home.title?'':` — ${escape(home.title)}`}</title><meta name="description" content="${escape(plain(description).slice(0,300))}"><link rel="canonical" href="${escape(url)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(plain(description).slice(0,300))}"><meta property="og:url" content="${escape(url)}"><meta property="og:type" content="${article?'article':'website'}"><link rel="stylesheet" href="/landing.css"><link rel="alternate" type="application/rss+xml" href="/rss.xml" title="Mayphus updates"><link rel="alternate" type="application/json" href="/agent-index.json" title="AI-readable content index"><script type="application/ld+json">${JSON.stringify(structured).replaceAll('<','\\u003c')}</script></head><body><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/" aria-label="Mayphus home"><span class="brand-mark" aria-hidden="true"></span>${escape(home.title)}</a><nav aria-label="Main navigation">${[['Work','/work/'],['Writing','/journal/'],['About','/profile/'],['Contact','/#contact']].map(([label,path])=>`<a href="${path}"${current===label?' aria-current="page"':''}>${label}</a>`).join('')}</nav></header><main id="main">${body}</main><footer class="site-footer" id="contact"><a class="email-link" href="mailto:${escape(email)}">${escape(email)}</a></footer>${root?'<script src="/fragments.js" defer></script>':''}</body></html>`;
}
export function renderHome(home,docs,projects) {
 const recent=dated(docs.filter(d=>d.metadata?.type==='article')).slice(0,5);
 const work=dated(projects.filter(d=>d.metadata?.type==='project')).slice(0,4);
 return shell({title:home.title,description:home.description,home,root:true,body:`<section class="hero"><p class="eyebrow">A field notebook</p><h1>${escape(home.introduction)}</h1><p>${escape(home.background)}</p></section><section class="index-section" aria-labelledby="latest-heading"><div class="section-heading"><h2 id="latest-heading">Writing</h2><a href="/journal/">View all</a></div>${rows(recent)}</section><section class="index-section" aria-labelledby="work-heading"><div class="section-heading"><h2 id="work-heading">Work</h2><a href="/work/">View all</a></div>${rows(work)}</section>`});
}
export function renderIndex(home,docs,{title,description,path,current}) {
 return shell({title,description,url:'https://mayphus.org'+path,home,current,body:`<section class="index-intro"><p class="eyebrow">${escape(home.title)} / ${escape(title)}</p><h1>${escape(title)}</h1><p>${escape(description)}</p></section><section class="index-section" aria-label="${escape(title)} entries">${rows(dated(docs),{level:2})}</section>`});
}
export function renderDocument(home,doc,docs=[]) {
 const gallery=doc.id==='page:/photos/';
 const images=gallery?curatedPhotoGallery(doc.text):recordImages(doc).slice(0,6);
 let text=gallery?'':doc.text;
 // The title is still displayed exactly once in the semantic page header.
 const lines=text.split('\n');
 if (lines[0].replace(/^#\s+/,'').trim()===doc.title.trim()) text=lines.slice(1).join('\n').trimStart();
 // A media-only line is represented by its figures; preserve every narrative line.
 text=text.split('\n').filter(line=>{
  let remainder=line;
  for(const photo of images) {
   remainder=remainder.replaceAll(`${photo.caption} (${photo.url})`,'').replaceAll(`(${photo.url})`,'');
  }
  return remainder.trim()!=='' || line.trim()==='';
 }).join('\n');
 const article=doc.metadata?.type==='article';
 const current=article?'Writing':doc.metadata?.type==='project'?'Work':doc.url.includes('/profile/')?'About':'';
 return shell({title:doc.title,description:doc.summary,url:doc.url,language:doc.metadata?.language || 'en',home,current,article,date:doc.metadata?.date,body:`<article class="reading" data-record-id="${escape(doc.id)}"><header class="reading-header"><p class="eyebrow">${escape(kind(doc))}${doc.metadata?.date?` <span aria-hidden="true">/</span> <time datetime="${escape(doc.metadata.date)}">${escape(dateLabel(doc.metadata.date))}</time>`:''}</p><h1>${escape(doc.title)}</h1>${doc.summary!==doc.title?`<p class="standfirst">${escape(plain(doc.summary))}</p>`:''}</header><div class="prose">${markdown.render(text)}</div>${images.length?`<section class="record-gallery" aria-label="Images from this record">${images.map(photo=>`<figure><a href="${escape(photo.url)}"><img src="${escape(photo.url)}" alt="${escape(photo.caption)}" loading="lazy" decoding="async"></a><figcaption>${escape(photo.caption)}</figcaption></figure>`).join('')}</section>`:''}</article>`});
}
export async function buildEditorial(home,corpus,catalogs) {
 const docs=corpus.documents;
 const projectUrls=new Set(catalogs.projects.map(p=>p.url || 'https://mayphus.org'+p.route));
 const projects=docs.filter(d=>projectUrls.has(d.url));
 const routes={}; const fragments={};
 async function page(route,html) {
  const target='/_human/'+Buffer.from(route).toString('base64url')+'.html';
  await mkdir(dirname('dist'+target),{recursive:true});await writeFile('dist'+target,html);routes[route]=target;
 }
 await writeFile('dist/index.html',renderHome(home,docs,projects));
 for(const doc of docs) {
  if(doc.url==='https://mayphus.org/' || doc.metadata?.type==='capability')continue;
  const route=viewUrl(doc);
  if(route==='/')continue;
  await page(route,renderDocument(home,doc,docs));
  const hash=new URL(doc.url).hash;
  if(hash)fragments[decodeURIComponent(hash.slice(1))]=route;
 }
 await page('/work/',renderIndex(home,projects,{title:'Work',description:'Projects, tools and investigations from the public record.',path:'/work/',current:'Work'}));
 await page('/journal/',renderIndex(home,docs.filter(d=>d.metadata?.date),{title:'Writing',description:'Progress, observations and what I learned along the way.',path:'/journal/',current:'Writing'}));
 await writeFile('dist/human-fragments.json',JSON.stringify(fragments)+'\n');
 await writeFile('.cache/human-routes.json',JSON.stringify(routes)+'\n');
 return routes;
}
