const origin='https://mayphus.org';
// Public application entry points; item/query states stay in their live catalogues.
const indexes=[
 ['/', 'Home'], ['/journal/','All work & notes'], ['/work/','Work index'],
 ['/archive/','Archive'], ['/sitemap/','Site map'],
 ['/typing/methods','Input methods catalogue'], ['/typing/guide','Install & test an input method'],
 ['/typing/customize','Customize an input method with AI'],
];
export function sitemapGroups(documents,pages=[]) {
 const excluded=new Set(pages.filter(p=>p.access&&p.access!=='public'||p.sitemap===false||p.discoverable===false).map(p=>p.route));
 const entries=new Map();
 for(const doc of documents) {
  const meta=doc.metadata||{};let url;try{url=new URL(doc.url);}catch{continue;}
  if(url.origin!==origin||url.search||url.hash||meta.type==='capability'||meta.access==='private'||['private','todo'].includes(meta.kind)||excluded.has(url.pathname)||/^\/(?:todo|inside|my|private|api|records)(?:\/|$)/.test(url.pathname))continue;
  entries.set(url.pathname,{path:url.pathname,title:doc.title,status:meta.status==='archived'||meta.discovery==='archive'?'Archived':meta.status==='shelved'?'Shelved':null});
 }
 for(const [path,title] of indexes)if(!excluded.has(path)&&!entries.has(path))entries.set(path,{path,title,status:null});
 const nested=new Set([...entries.keys()].filter(p=>p.split('/').filter(Boolean).length>1).map(p=>p.split('/')[1]));
 const groups=new Map();
 for(const entry of entries.values()) {
  const first=entry.path.split('/')[1];
  const prefix=first&&(nested.has(first)||first==='books'||first==='typing')?'/'+first+'/':'/';
  if(!groups.has(prefix))groups.set(prefix,[]);groups.get(prefix).push(entry);
 }
 return [...groups].sort(([a],[b])=>a.localeCompare(b,'en')).map(([path,entries])=>({path,entries:entries.sort((a,b)=>a.path.localeCompare(b.path,'en'))}));
}
export function sitemapText(groups) {
 return 'Source: https://mayphus.org/sitemap/\nTitle: Site map\n\nPublic pages grouped by URL path. Books and input methods have their own live catalogues.\n\n'+groups.map(g=>g.path+'\n'+g.entries.map(e=>`${e.title}${e.status?' — '+e.status:''}\n${origin}${e.path}`).join('\n\n')).join('\n\n');
}
