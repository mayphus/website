// Human discovery metadata is derived from canonical records; no generated body copy.
const origin='https://mayphus.org';
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const plain=value=>String(value??'').replace(/\s+/g,' ').trim();
const clip=(value,max)=>{const text=plain(value);if(text.length<=max)return text;const prefix=text.slice(0,max-1);return prefix.replace(/\s+\S*$/,'')+'…';};
export function socialMetadata({title,description,url=origin+'/',language='en',home,article=false,date='',doc,docs=[]}) {
 const summary=clip(description||title,300),path=new URL(url).pathname;
 const image=doc?.metadata?.social_image;
 const websiteId=origin+'/#website',personId=origin+'/#person',pageId=url+'#webpage';
 const ref=id=>({'@id':id});
 const page={'@type':['/profile/','/profile/zh/'].includes(path)?'ProfilePage':'WebPage','@id':pageId,url,name:title,description:summary,inLanguage:language,isPartOf:ref(websiteId)};
 const graph=[{'@type':'WebSite','@id':websiteId,url:origin+'/',name:home.title,publisher:ref(personId)},{'@type':'Person','@id':personId,name:home.title,url:origin+'/profile/',sameAs:[home.github]},page];
 if(page['@type']==='ProfilePage')page.mainEntity=ref(personId);
 if(article){const id=url+'#article';page.mainEntity=ref(id);graph.push({'@type':'Article','@id':id,url,headline:title,description:summary,inLanguage:language,author:ref(personId),mainEntityOfPage:ref(pageId),...(date?{datePublished:date}:{})});}
 // This route actually contains the interactive chart. Project descriptions are not applications.
 if(path==='/ipa/') {const id=url+'#application';page.mainEntity=ref(id);graph.push({'@type':'WebApplication','@id':id,url,name:title,description:summary,inLanguage:language,applicationCategory:'EducationalApplication',browserRequirements:'JavaScript for the interactive IPA chart',mainEntityOfPage:ref(pageId)});}
 const meta=(key,value,property=false)=>`<meta ${property?'property':'name'}="${escape(key)}" content="${escape(value)}">`;
 let html=meta('description',summary)+`<link rel="canonical" href="${escape(url)}">`;
 for(const[key,value]of Object.entries({'og:title':title,'og:description':summary,'og:url':url,'og:type':article?'article':'website','og:site_name':home.title}))html+=meta(key,value,true);
 html+=meta('twitter:card',image&&image.width>=600&&image.height>=315&&image.width/image.height>=1.2?'summary_large_image':'summary')+meta('twitter:title',title)+meta('twitter:description',clip(summary,200));
 if(article&&date)html+=meta('article:published_time',date,true);
 if(image){
  for(const[key,value]of Object.entries({'og:image':image.url,'og:image:secure_url':image.url,'og:image:type':image.type,'og:image:width':image.width,'og:image:height':image.height,'og:image:alt':image.alt}))html+=meta(key,value,true);
  html+=meta('twitter:image',image.url)+meta('twitter:image:alt',image.alt);
  const id=image.url+'#image';page.primaryImageOfPage=ref(id);const articleNode=graph.find(node=>node['@type']==='Article');if(articleNode)articleNode.image=ref(id);
  graph.push({'@type':'ImageObject','@id':id,contentUrl:image.url,encodingFormat:image.type,width:image.width,height:image.height,description:image.alt});
 }
 // Only existing translations are advertised, with reciprocal links.
 for(const pair of [['/profile/','/profile/zh/'],['/resume/','/resume/zh/']]){
  if(!pair.includes(path))continue;
  const translated=pair.map(p=>docs.find(d=>d.url===origin+p));
  if(translated.every(Boolean))for(const d of translated)html+=`<link rel="alternate" hreflang="${escape(d.metadata?.language||'en')}" href="${escape(d.url)}">`;
 }
 return html+`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029')}</script>`;
}
