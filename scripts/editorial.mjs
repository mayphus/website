import {indexTopic,topicSvg} from './index-topics.mjs';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import MarkdownIt from 'markdown-it';
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
export const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export const stylesheetPath='/landing.'+createHash('sha256').update(readFileSync(new URL('../public/landing.css',import.meta.url))).digest('hex').slice(0,16)+'.css';
export const ipaScriptPath='/ipa-chart.'+createHash('sha256').update(readFileSync(new URL('../public/ipa-chart.js',import.meta.url))).digest('hex').slice(0,16)+'.js';
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
 const disclosurePage=new URL(url).pathname==='/about-this-content/';
 const email=home.email;
 if(!/^[^\s<>"'@]+@[^\s<>"'@]+\.[^\s<>"'@]+$/.test(email))throw Error('Invalid canonical contact email');
 const structured={'@context':'https://schema.org','@type':article?'Article':'WebPage',name:title,url,description,...(article?{headline:title,author:{'@type':'Person',name:home.title},...(date?{datePublished:date}:{})}:{})};
 return `<!doctype html><html lang="${escape(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}${title===home.title?'':` — ${escape(home.title)}`}</title><meta name="description" content="${escape(plain(description).slice(0,300))}"><link rel="canonical" href="${escape(url)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(plain(description).slice(0,300))}"><meta property="og:url" content="${escape(url)}"><meta property="og:type" content="${article?'article':'website'}"><link rel="stylesheet" href="${stylesheetPath}"><link rel="alternate" type="application/rss+xml" href="/rss.xml" title="Mayphus updates"><link rel="alternate" type="application/json" href="/agent-index.json" title="AI-readable content index"><script type="application/ld+json">${JSON.stringify(structured).replaceAll('<','\\u003c')}</script></head><body><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/" aria-label="Mayphus home"><span class="brand-mark" aria-hidden="true"></span>${escape(home.title)}</a></header><main id="main">${body}</main><footer class="site-footer" id="contact">${disclosurePage?'':`<a class="email-link" href="mailto:${escape(email)}">${escape(email)}</a>`}<a class="content-disclosure" href="/about-this-content/" aria-label="About this content: Human work. AI-assisted words.">Human work. AI-assisted words.</a></footer>${url==='https://mayphus.org/ipa/'?`<script src="${ipaScriptPath}" defer></script>`:''}${root||url==='https://mayphus.org/journal/'?'<script src="/fragments.js" defer></script>':''}</body></html>`;
}
export function readingDocuments(docs,{archive=false}={}) {
 if(archive)return dated(docs.filter(doc=>doc.metadata?.discovery==='archive' && doc.metadata?.type!=='capability'));
 // Keep routes and the complete machine index; omit empty wrappers and duplicate collection indexes from this reading list.
 const wrappers=new Set(['/writing/','/infra/','/agents/','/chat/','/daily/','/diet/','/job-hunter/','/status/','/demo/','/about-this-content/']);
 const announcements=new Set([
  'page:/entries/x-2060192582706344390/','page:/entries/x-2062104590410260679/',
  'note:openlens-local-first-camera','note:ai-native-website-interfaces',
  'note:electronic-learning-book-repair','note:nanopi-r2s-alpine-boot','note:how-i-work-with-ai',
  'note:nano-pi-teardown','note:router-service-recovery','note:sugar-from-a-soldier',
 ]);
 return dated(docs.filter(doc=>doc.metadata?.discovery!=='archive' && doc.url!=='https://mayphus.org/' && doc.metadata?.type!=='capability' && doc.metadata?.kind!=='collection' && !wrappers.has(new URL(doc.url).pathname) && !announcements.has(doc.id)));
}
function contentIndex(docs,options) {
 const visible=readingDocuments(docs,options);
 if (!visible.length) return '<p class="empty">No entries are published here yet.</p>';
 return '<ul class="content-index" role="list">'+visible.map(doc=>{const topic=indexTopic(doc);return `<li><span class="topic-icon" title="${escape(topic.label)}" aria-hidden="true">${topicSvg(topic)}</span><a href="${escape(viewUrl(doc))}" title="${escape(topic.label)}"><span class="sr-only">${escape(topic.label)}: </span>${escape(doc.title)}</a></li>`;}).join('')+'</ul>';
}
export function renderGuide(home,docs) {
 const guide=home.guide;
 if(!guide)return '';
 const records=new Map(docs.map(doc=>[doc.id,doc]));
 return `<div class="home-guide">${guide.themes.map(theme=>`<section class="guide-theme" aria-labelledby="guide-${escape(theme.id)}"><h2 id="guide-${escape(theme.id)}">${escape(theme.title)}</h2><p class="theme-description">${escape(theme.description)}</p><ul class="guide-links" role="list">${theme.entries.map(entry=>{
  const doc=records.get(entry.record);
  if(!doc||doc.metadata?.type==='capability')throw Error(`Missing public guide record: ${entry.record}`);
  const topic=indexTopic(doc);
  return `<li><span class="topic-icon" title="${escape(topic.label)}" aria-hidden="true">${topicSvg(topic)}</span><div><a class="guide-title" href="${escape(viewUrl(doc))}" title="${escape(topic.label)}"><span class="sr-only">${escape(topic.label)}: </span>${escape(doc.title)}</a><p>${escape(entry.note)}</p></div></li>`;
 }).join('')}</ul></section>`).join('')}</div>`;
}
export function renderHome(home,docs) {
 const guide=home.guide;
 const body=guide?`<section class="hero guide-intro"><h1>${escape(home.introduction)}</h1><p>${escape(guide.overview)}</p><a class="index-jump" href="/journal/">${escape(guide.index_label)} <span aria-hidden="true">→</span></a></section>${renderGuide(home,docs)}<p class="guide-more"><a href="/journal/">${escape(guide.index_label)} <span aria-hidden="true">→</span></a></p>`:`<section class="hero"><h1>${escape(home.introduction)}</h1><p>${escape(home.background)}</p></section><section class="index-section" aria-label="Content index">${contentIndex(docs)}</section>`;
 return shell({title:home.title,description:home.description,home,root:true,body});
}
function readingIndexDetails(home,path) {
 return path==='/archive/'?{title:'Archive',description:'Historical records preserved outside the main reading index. Original bodies, source links, and direct URLs remain available.',archive:true}:{title:home.guide?.index_label || 'All work & notes',description:home.guide?.index_description || home.background,archive:false};
}
export function renderReadingIndexText(home,docs,path='/journal/') {
 const {title,description,archive}=readingIndexDetails(home,path);
 return `Source: https://mayphus.org${path}\nTitle: ${title}\n\n${description}\n\n${readingDocuments(docs,{archive}).map(doc=>`${doc.title}\nhttps://mayphus.org${viewUrl(doc)}`).join('\n\n')}\n`;
}
export function renderFullIndex(home,docs,path='/journal/') {
 const {title,description,archive}=readingIndexDetails(home,path);
 const navigation=archive?'<a href="/journal/">All work &amp; notes</a>':'<a href="/archive/">Archive</a>';
 return shell({title,description,url:'https://mayphus.org'+path,home,body:`<section class="index-intro full-index-intro"><h1>${escape(title)}</h1><p>${escape(description)}</p></section><section class="index-section" aria-label="${escape(title)}">${contentIndex(docs,{archive})}</section><p class="guide-more">${navigation}</p>`});
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
 // Summaries remain metadata; do not repeat prose already present in the record.
 const summary=plain(doc.summary);
 const repeatedSummary=plain(text)===summary || markdown.parse(text,{}).some((token,index,tokens)=>token.type==='inline' && tokens[index-1]?.type==='paragraph_open' && plain(token.content)===summary);
 const links=[];const seenLinks=new Set();
 for(const link of doc.metadata?.links || []) {
  if(typeof link.url!=='string' || !/^https?:\/\//i.test(link.url) || seenLinks.has(link.url) || doc.text.includes(link.url))continue;
  seenLinks.add(link.url);links.push(link);
 }
 const sourceLinks=links.length?`<p class="record-links">${links.map(link=>`<a href="${escape(link.url)}">${escape(link.label || 'Source')}</a>`).join(' · ')}</p>`:'';
 const article=doc.metadata?.type==='article';
 const current=article?'Writing':doc.metadata?.type==='project'?'Work':doc.url.includes('/profile/')?'About':'';
 return shell({title:doc.title,description:doc.summary,url:doc.url,language:doc.metadata?.language || 'en',home,current,article,date:doc.metadata?.date,body:`<article class="reading"${doc.url==='https://mayphus.org/ipa/'?' data-ipa-chart':''} data-record-id="${escape(doc.id)}"><header class="reading-header">${doc.metadata?.discovery==='archive'?'<p class="eyebrow"><a href="/archive/">Archived record</a></p>':''}<h1>${escape(doc.title)}</h1>${summary && summary!==plain(doc.title) && !repeatedSummary?`<p class="standfirst">${escape(plain(doc.summary))}</p>`:''}</header><div class="prose">${markdown.render(text)}${sourceLinks}</div>${images.length?`<section class="record-gallery" aria-label="Images from this record">${images.map(photo=>`<figure><a href="${escape(photo.url)}"><img src="${escape(photo.url)}" alt="${escape(photo.caption)}" loading="lazy" decoding="async"></a><figcaption>${escape(photo.caption)}</figcaption></figure>`).join('')}</section>`:''}</article>`});
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
  else if(doc.id.startsWith('note:') && !doc.metadata?.route)fragments[doc.metadata.id]=route;
 }
 await page('/work/',renderFullIndex(home,docs,'/work/'));
 await page('/journal/',renderFullIndex(home,docs));
 await page('/archive/',renderFullIndex(home,docs,'/archive/'));
 for(const route of ['/journal/','/work/','/archive/']) {
  await mkdir('dist'+route,{recursive:true});
  await writeFile('dist'+route+'index.txt',renderReadingIndexText(home,docs,route));
 }
 await writeFile('dist/human-fragments.json',JSON.stringify(fragments)+'\n');
 await writeFile('.cache/human-routes.json',JSON.stringify(routes)+'\n');
 return routes;
}
