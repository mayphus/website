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
function rows(docs,{numbers=false,level=3}={}) {
 if (!docs.length) return '<p class="empty">No entries are published here yet.</p>';
 return '<ol class="entry-list">'+docs.map((doc,i)=>`<li class="entry"><div class="entry-meta">${numbers?`<span class="index">${String(i+1).padStart(2,'0')}</span>`:''}<span>${escape(kind(doc))}</span>${doc.metadata?.date?`<time datetime="${escape(doc.metadata.date)}">${escape(dateLabel(doc.metadata.date))}</time>`:''}</div><div class="entry-copy"><h${level}><a href="${escape(viewUrl(doc))}">${escape(doc.title)}<span aria-hidden="true"> ↗</span></a></h${level}><p>${escape(plain(doc.summary))}</p>${doc.metadata?.tags?.length?`<p class="tags">${doc.metadata.tags.map(escape).join(' · ')}</p>`:''}</div></li>`).join('')+'</ol>';
}
function shell({title,description,url='https://mayphus.org/',language='en',home,current='',body,article=false,date='',root=false}) {
 if(!/^https:\/\/github\.com\/[A-Za-z0-9_-]+\/?$/.test(home.github))throw Error('Invalid canonical GitHub URL');
 const invitation=home.contact_invitation || '';
 const email=home.email;
 if(!/^[^\s<>"'@]+@[^\s<>"'@]+\.[^\s<>"'@]+$/.test(email))throw Error('Invalid canonical contact email');
 const structured={'@context':'https://schema.org','@type':article?'Article':'WebPage',name:title,url,description,...(article?{headline:title,author:{'@type':'Person',name:home.title},...(date?{datePublished:date}:{})}:{})};
 return `<!doctype html><html lang="${escape(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}${title===home.title?'':` — ${escape(home.title)}`}</title><meta name="description" content="${escape(plain(description).slice(0,300))}"><link rel="canonical" href="${escape(url)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(plain(description).slice(0,300))}"><meta property="og:url" content="${escape(url)}"><meta property="og:type" content="${article?'article':'website'}"><link rel="stylesheet" href="/landing.css"><link rel="alternate" type="application/rss+xml" href="/rss.xml" title="Mayphus updates"><link rel="alternate" type="application/json" href="/agent-index.json" title="AI-readable content index"><script type="application/ld+json">${JSON.stringify(structured).replaceAll('<','\\u003c')}</script></head><body><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/" aria-label="Mayphus home"><span class="brand-mark" aria-hidden="true"></span>${escape(home.title)}</a><nav aria-label="Main navigation">${[['Work','/work/'],['Writing','/journal/'],['About','/profile/'],['Contact','/#contact']].map(([label,path])=>`<a href="${path}"${current===label?' aria-current="page"':''}>${label}</a>`).join('')}</nav></header><main id="main">${body}</main><footer class="site-footer" id="contact"><div class="contact"><p class="eyebrow">An open conversation</p><h2>Let’s talk.</h2>${invitation?`<p>${escape(invitation)}</p>`:''}<a class="email-link" href="mailto:${escape(email)}">${escape(email)} <span aria-hidden="true">↗</span></a></div><div class="footer-meta"><p>${escape(home.footer)}</p><nav aria-label="Other ways to read"><a href="/llms.txt">For AI agents</a><a href="/agent-index.json">Content index</a><a href="/rss.xml">RSS</a><a href="${escape(home.github)}">GitHub</a></nav></div></footer>${root?'<script src="/fragments.js" defer></script>':''}</body></html>`;
}
export function renderHome(home,docs,projects) {
 const articles=dated(docs.filter(d=>d.metadata?.type==='article'));
 const recent=articles.slice(0,4);
 const work=projects.slice(0,6);
 return shell({title:home.title,description:home.description,home,root:true,body:`<section class="hero"><p class="eyebrow">Work, investigations &amp; notes</p><h1>${escape(home.introduction)}</h1><div class="hero-bottom"><p>${escape(home.background)}</p><a class="text-link" href="/work/">Explore the work <span aria-hidden="true">↗</span></a></div></section><section class="index-section" aria-labelledby="latest-heading"><div class="section-heading"><h2 id="latest-heading">Latest writing</h2><a href="/journal/">All writing <span aria-hidden="true">↗</span></a></div>${rows(recent)}</section><section class="index-section" aria-labelledby="work-heading"><div class="section-heading"><h2 id="work-heading">Work &amp; investigations</h2><a href="/work/">All work <span aria-hidden="true">↗</span></a></div><div class="project-grid">${rows(work,{numbers:true})}</div></section><aside class="shared-source"><span class="eyebrow">One content, different ways to read</span><p>${escape(home.records_description)}</p><a href="/agents/">Explore with your AI agent <span aria-hidden="true">↗</span></a></aside>`});
}
export function renderIndex(home,docs,{title,description,path,current}) {
 return shell({title,description,url:'https://mayphus.org'+path,home,current,body:`<section class="index-intro"><p class="eyebrow">${escape(home.title)} / ${escape(title)}</p><h1>${escape(title)}</h1><p>${escape(description)}</p></section><section class="index-section" aria-label="${escape(title)} entries">${rows(dated(docs),{numbers:true,level:2})}</section>`});
}
export function renderDocument(home,doc) {
 let text=doc.text;
 // The title is still displayed exactly once in the semantic page header.
 const lines=text.split('\n');
 if (lines[0].replace(/^#\s+/,'').trim()===doc.title.trim()) text=lines.slice(1).join('\n').trimStart();
 const article=doc.metadata?.type==='article';
 const current=article?'Writing':doc.metadata?.type==='project'?'Work':doc.url.includes('/profile/')?'About':'';
 const textUrl=doc.metadata?.route ? doc.metadata.route+'index.txt' : new URL(doc.text_url).pathname;
 return shell({title:doc.title,description:doc.summary,url:doc.url,language:doc.metadata?.language || 'en',home,current,article,date:doc.metadata?.date,body:`<article class="reading" data-record-id="${escape(doc.id)}"><header class="reading-header"><a class="back-link" href="${current==='Work'?'/work/':'/journal/'}">← ${current==='Work'?'All work':'All writing'}</a><p class="eyebrow">${escape(kind(doc))}${doc.metadata?.date?` <span aria-hidden="true">/</span> <time datetime="${escape(doc.metadata.date)}">${escape(dateLabel(doc.metadata.date))}</time>`:''}</p><h1>${escape(doc.title)}</h1><p class="standfirst">${escape(plain(doc.summary))}</p><a class="source-link" href="${escape(textUrl)}">Read as plain text ↗</a></header><div class="prose">${markdown.render(text)}</div><div class="reading-end"><a href="${escape(textUrl)}">Plain text</a><a href="/api/document?id=${encodeURIComponent(doc.id)}">Same record as JSON</a><a href="/journal/">More writing ↗</a></div></article>`});
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
  await page(route,renderDocument(home,doc));
  const hash=new URL(doc.url).hash;
  if(hash)fragments[decodeURIComponent(hash.slice(1))]=route;
 }
 await page('/work/',renderIndex(home,projects,{title:'Work',description:'Projects, tools and investigations from the public record.',path:'/work/',current:'Work'}));
 await page('/journal/',renderIndex(home,docs.filter(d=>d.metadata?.date),{title:'Writing',description:'Progress, observations and what I learned along the way.',path:'/journal/',current:'Writing'}));
 await writeFile('dist/human-fragments.json',JSON.stringify(fragments)+'\n');
 await writeFile('.cache/human-routes.json',JSON.stringify(routes)+'\n');
 return routes;
}
