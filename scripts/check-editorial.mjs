import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDocument,renderHome,viewUrl,recordImages,stylesheetPath,renderGuide,renderFullIndex,renderReadingIndexText,readingDocuments} from './editorial.mjs';
const home={title:'Mayphus',email:'tangmeifa@gmail.com',github:'https://github.com/mayphus',footer:'One content.',introduction:'Build with AI.',background:'Software and systems.',records_description:'Source records.',contact_invitation:'People and their AI agents are welcome.'};
const doc={id:'note:example',title:'测试 <script>',url:'https://mayphus.org/example/',text_url:'https://mayphus.org/records/example.txt',summary:'A safe & readable record.',metadata:{type:'article',date:'2026-10-05',route:'/example/'},text:'# 测试 <script>\n\n[Bad](javascript:alert(1))\n\n<script>alert(1)</script>\n\n| Column | Value |\n|---|---|\n|中文|123|'};
test('renders the canonical record safely with semantic reading and contact',()=>{const html=renderDocument(home,doc);assert.ok(html.includes('测试 &lt;script&gt;'));assert.ok(!html.includes('<script>alert'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('class="table-scroll"'));assert.ok(html.includes('mailto:'+home.email));assert.ok(!html.includes('class="reading-end"'));assert.ok(!html.includes('/example/index.txt')); assert.ok(html.includes('name="viewport"'));assert.ok(html.includes('Skip to content'));});
test('renders empty indexes and encoded fragment routes without new content',()=>{assert.ok(renderHome(home,[],[]).includes('No entries are published'));assert.equal(viewUrl({...doc,url:'https://mayphus.org/#old-note'}),'/notes/old-note/');assert.throws(()=>renderDocument({...home,email:'bad"@email'},doc),/contact email/);});

// Production analytics may add only its exact known prefix; all other bytes remain checked.
import {canonicalHtml, productionAnalytics, productionBeacon, productionBeaconCurrent} from './html-contract.mjs';
test('HTML comparison accepts only the existing production analytics insertion',()=>{
 const expected='<head><meta charset="utf-8"></head><body>reviewed</body>';
 const actual=expected.replace('<head>','<head>'+productionAnalytics).replace('</body>',productionBeacon+'</body>');
 assert.equal(canonicalHtml(actual,'https://mayphus.org'),expected);
 assert.equal(canonicalHtml(expected,'https://mayphus.org'),expected);
 assert.equal(canonicalHtml(actual,'https://abc-mayphus.mayphus.workers.dev'),actual);
 assert.notEqual(canonicalHtml(actual.replace('reviewed','stale'),'https://mayphus.org'),expected);
 assert.notEqual(canonicalHtml(actual.replace('/analytics/','/unexpected/'),'https://mayphus.org'),expected);
});

test('HTML comparison recognizes the exact updated edge beacon and rejects modified variants',()=>{
 const expected='<head></head><body>reviewed</body></html>';
 for(const beacon of [productionBeacon,productionBeaconCurrent]) {
  const actual=expected.replace('</body>',beacon+'</body>');
  assert.equal(canonicalHtml(actual,'https://mayphus.org'),expected);
  assert.equal(canonicalHtml(actual,'https://preview.workers.dev'),actual);
  for(const changed of [actual.replace('reviewed','stale'),actual.replace('sha512-','sha256-'),actual.replace('"spa":2','"spa":3'),actual.replace('beacon.min.js/','unknown.js/')]) assert.notEqual(canonicalHtml(changed,'https://mayphus.org'),expected);
 }
});

test('record gallery uses only existing same-site photos without extra related links',()=>{
 const note={...doc,text:'Board on the bench (https://mayphus.org/media/board.jpg) (https://mayphus.org/media/board.jpg) https://other.example/photo.jpg',metadata:{...doc.metadata,tags:['hardware']}};
 assert.deepEqual(recordImages(note),[{url:'https://mayphus.org/media/board.jpg',caption:'Board on the bench'}]);
 const related={...doc,id:'related',title:'Related board',url:'https://mayphus.org/related/',metadata:{type:'note',tags:['hardware']}};
 const unrelated={...related,id:'unrelated',title:'Unrelated',metadata:{type:'note',tags:['software']}};
 const html=renderDocument(home,note,[note,related,unrelated]);
 assert.ok(html.includes('alt="Board on the bench"'));
 assert.ok(!html.includes('Related board'));
 assert.ok(!html.includes('>Unrelated<'));
});

test('photo index shows a curated gallery without dumping source URLs',()=>{
 const media='Board setup (https://mayphus.org/media/notes/setup.jpg)  (https://mayphus.org/media/notes/setup.jpg) Photo 1 attached to a post (https://mayphus.org/media/x/post.jpg)  (https://mayphus.org/media/x/post.jpg) Sensor board (https://mayphus.org/media/notes/sensor.jpg)  (https://mayphus.org/media/notes/sensor.jpg)';
 const photos={...doc,id:'page:/photos/',title:'Photos',url:'https://mayphus.org/photos/',text:'Photos\n\n'+media,metadata:{type:'page',route:'/photos/'}};
 const html=renderDocument(home,photos);
 assert.equal((html.match(/<figure>/g)||[]).length,2);
 assert.ok(html.includes('<figcaption>Board setup</figcaption>'));
 assert.ok(!html.includes('post.jpg'));
 assert.ok(!html.includes('Board setup (https://'));
 assert.ok(!html.includes('One content.'));
});

test('homepage presents one index without category navigation or divider rows',()=>{
 const records=[doc,{...doc,id:'note:old',title:'An older note',url:'https://mayphus.org/#old',metadata:{type:'note',date:'2026-01-01'}},{...doc,id:'page:/writing/',title:'Writing',url:'https://mayphus.org/writing/',metadata:{type:'page'}},{...doc,id:'page:/collection/',title:'Collection',url:'https://mayphus.org/collection/',metadata:{type:'page',kind:'collection'}},{...doc,id:'page:/chat/',title:'Chat',url:'https://mayphus.org/chat/',metadata:{type:'page',kind:'tool'}}];
 const html=renderHome(home,records,[]);
 assert.equal((html.match(/<ul class="content-index" role="list">/g)||[]).length,1);
 assert.ok(!html.includes('<ol class="content-index"'));
 assert.ok(html.indexOf('href="/example/"')<html.indexOf('href="/notes/old/"'));
 assert.ok(!html.includes('<time'));
 assert.equal((html.match(/class="topic-icon"/g)||[]).length,2);
 assert.ok(html.includes('<span class="sr-only">Article: </span>'));
 assert.match(stylesheetPath,/^\/landing\.[a-f0-9]{16}\.css$/);
 assert.ok(html.includes(`href="${stylesheetPath}"`));
 assert.equal(records[1].metadata.date,'2026-01-01');
 assert.ok(html.includes('href="/example/"'));
 assert.ok(html.includes('href="/notes/old/"'));
 assert.ok(!html.includes('href="/writing/"'));
 assert.ok(!html.includes('href="/collection/"'));
 assert.ok(!html.includes('href="/chat/"'));
 assert.ok(!html.includes('<nav aria-label="Main navigation">'));
 assert.ok(!html.includes('<hr'));
});


test('shared disclosure appears once in human views without modifying source records',()=>{
 const before=JSON.stringify(doc);
 for(const html of [renderHome(home,[doc]),renderDocument(home,doc)]) {
  assert.equal((html.match(/href="\/about-this-content\/"/g)||[]).length,1);
  assert.ok(html.includes('>Human work. AI-assisted words.</a>'));
 }
 assert.equal(JSON.stringify(doc),before);
 const explanation={...doc,title:'About this content',url:'https://mayphus.org/about-this-content/',summary:'About this content',text:'Based on my real work, experiments and observations. AI helps turn them into published content. Claims should be judged by their evidence; corrections are welcome.'};
 const html=renderDocument(home,explanation);
 assert.ok(html.includes(explanation.text));
 assert.ok(!html.includes(home.email));
 assert.ok(!html.includes('mailto:'));
 assert.equal((renderHome(home,[explanation]).match(/href="\/about-this-content\/"/g)||[]).length,1);
});


import {indexTopic} from './index-topics.mjs';
test('index topics use canonical tags before broad topics and never guess from titles',()=>{
 const category=metadata=>indexTopic({...doc,metadata});
 assert.equal(category({tags:['photography','camera']}).key,'photography');
 assert.equal(category({tags:['maps','software']}).key,'maps-history');
 assert.equal(category({tags:['hardware','ai']}).key,'hardware');
 assert.equal(category({tags:['language-models']}).key,'software');
 assert.equal(category({tags:['chemistry']}).key,'science');
 assert.equal(category({tags:['language']}).key,'art-language');
 assert.equal(category({topic:'making'}).label,'Making');
 assert.equal(category({topic:'life'}).label,'Life');
 assert.equal(indexTopic({...doc,title:'Camera mathematics Linux',metadata:{type:'note'}}).label,'Note');
 const html=renderHome(home,[{...doc,metadata:{type:'article',tags:['photography']}}]);
 assert.ok(html.includes('title="Photography"'));
 assert.ok(html.includes('<span class="sr-only">Photography: </span>'));
 assert.ok(html.includes('aria-hidden="true" focusable="false"'));
});


test('content headers omit date chrome while metadata and prose dates survive',()=>{
 for(const type of ['article','note']) {
  const record={...doc,text:'Experiment observed on 2026-10-05 at 14:30 UTC.',metadata:{...doc.metadata,type}};
  const before=JSON.stringify(record);
  const html=renderDocument(home,record);
  const header=html.match(/<header class="reading-header">(.*?)<\/header>/s)[1];
  assert.ok(!header.includes('<time'));
  assert.ok(!header.includes('2026-10-05'));
  assert.ok(!header.includes('eyebrow'));
  assert.ok(html.includes('<p>Experiment observed on 2026-10-05 at 14:30 UTC.</p>'));
  assert.equal(JSON.stringify(record),before);
  if(type==='article') {
   const data=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
   assert.equal(data.datePublished,'2026-10-05');
  }
 }
});


test('editorial guide keeps explicit selections stable while the full index grows',()=>{
 const selected={...doc,id:'selected',title:'Selected record',metadata:{type:'article',date:'2020-01-01'}};
 const another={...doc,id:'another',url:'https://mayphus.org/another/',title:'Another record',metadata:{type:'article',date:'2026-10-01'}};
 const guideHome={...home,guide:{overview:'A stable overview.',index_label:'All work & notes',index_description:'The whole index.',themes:[{id:'systems',title:'Systems',description:'Follow the evidence.',entries:[{record:'selected',note:'A checked starting point.'}]}]}};
 const before=renderGuide(guideHome,[selected]);
 assert.equal(renderGuide(guideHome,[another,selected]),before);
 const html=renderHome(guideHome,[another,selected]);
 assert.ok(html.includes('A stable overview.'));
 assert.ok(html.includes('href="/journal/"'));
 assert.ok(html.includes('Selected record'));
 assert.ok(!html.includes('Another record'));
 assert.ok(!html.includes('<time'));
 const index=renderFullIndex(guideHome,[another,selected]);
 assert.ok(index.includes('Selected record')&&index.includes('Another record'));
 assert.ok(!index.includes('A checked starting point.'));
 assert.throws(()=>renderGuide(guideHome,[]),/Missing public guide record/);
 assert.ok(renderGuide({...guideHome,guide:{...guideHome.guide,themes:[{...guideHome.guide.themes[0],description:'<script>unsafe</script>'}]}},[selected]).includes('&lt;script&gt;'));
});


test('summaries already in a short post or profile body are not repeated visually',()=>{
 for(const body of ['The exact observation.', 'Name\n\nProfessional Summary\n\nThe exact observation.\n\nMore detail.']) {
  const record={...doc,summary:'The exact observation.',text:body};
  const html=renderDocument(home,record);
  assert.ok(!html.includes('class="standfirst"'));
  assert.ok(html.includes('<p>The exact observation.</p>'));
  assert.equal(record.text,body);
  assert.ok(html.includes('name="description" content="The exact observation."'));
 }
 assert.ok(renderDocument(home,{...doc,summary:'A useful distinct summary.',text:'A different body.'}).includes('class="standfirst"'));
 assert.ok(renderDocument(home,{...doc,summary:'A partial thought',text:'A partial thought extended into something else.'}).includes('class="standfirst"'));
});
test('short posts retain unique source and project links without inventing a story',()=>{
 const record={...doc,metadata:{type:'note',date:'2020-01-02',links:[{label:'Original post',url:'https://example.com/post'},{label:'Full project record',url:'https://mayphus.org/project/'},{label:'Duplicate',url:'https://example.com/post'},{label:'Unsafe',url:'javascript:alert(1)'}]},summary:'One observation.',text:'One observation.'};
 const html=renderDocument(home,record);
 assert.ok(html.includes('<a href="https://example.com/post">Original post</a>'));
 assert.ok(html.includes('<a href="https://mayphus.org/project/">Full project record</a>'));
 assert.ok(!html.includes('>Duplicate<'));assert.ok(!html.includes('javascript:'));
 assert.ok(!html.includes('<time'));
 assert.equal(record.metadata.date,'2020-01-02');
 const inBody=renderDocument(home,{...record,text:'[Original post](https://example.com/post)'});
 assert.equal((inBody.match(/href="https:\/\/example.com\/post"/g)||[]).length,1);
});

test('plain-text reading index uses the same selected records and current human URLs as HTML',()=>{
 const note={...doc,id:'note:short',url:'https://mayphus.org/notes/short/',metadata:{type:'note',id:'short'},title:'Short observation'};
 const capability={...doc,id:'capability:search',metadata:{type:'capability'}};
 const docs=[note,capability];const text=renderReadingIndexText(home,docs);
 assert.deepEqual(readingDocuments(docs),[note]);
 assert.ok(text.includes('https://mayphus.org/notes/short/'));assert.ok(!text.includes('capability'));
 assert.ok(renderFullIndex(home,docs).includes('href="/notes/short/"'));
 assert.equal(viewUrl(note),'/notes/short/');assert.equal(viewUrl({...note,url:'https://mayphus.org/#short'}),'/notes/short/');
});

test('reading index negotiation serves text by default and preserves HTML and HEAD',async()=>{
 const {build}=await import('esbuild');
 const result=await build({entryPoints:['workers/human.ts'],bundle:true,write:false,format:'esm',platform:'neutral',plugins:[{name:'fixture-content',setup(build){
  build.onResolve({filter:/^mayphus-(content-worker|human-routes)$/},args=>({path:args.path,namespace:'fixture'}));
  build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='mayphus-human-routes'?`export default {'/journal/':'/_human/journal.html','/work/':'/_human/work.html','/archive/':'/_human/archive.html','/profile/':'/_human/profile.html'};`:`export default {fetch(){return new Response('canonical content',{headers:{'Content-Type':'text/plain'}})}};`}));
 }}]});
 const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const env={ASSETS:{fetch:async request=>new Response(new URL(request.url).pathname)}};
 for(const route of ['/journal/','/work/','/archive/']) {
  for(const path of [route,route+'index.html',route.slice(0,-1)]) {
   for(const accept of ['', '*/*','text/plain','text/html;q=0','text/plain;q=1,text/html;q=.5']) {
    const response=await worker.fetch(new Request('https://mayphus.org'+path,{headers:{Accept:accept}}),env);
    assert.equal(response.status,200);assert.equal(await response.text(),route+'index.txt');assert.match(response.headers.get('content-type'),/^text\/plain/);assert.equal(response.headers.get('vary'),'Accept');
   }
  }
  const html=await worker.fetch(new Request('https://mayphus.org'+route,{headers:{Accept:'text/html'}}),env);
  assert.equal(await html.text(),'/_human'+route.slice(0,-1)+'.html');
  for(const accept of ['*/*','text/html']){
   const head=await worker.fetch(new Request('https://mayphus.org'+route,{method:'HEAD',headers:{Accept:accept}}),env);assert.equal(head.status,200);assert.equal(await head.text(),'');
  }
 }
 const profile=await worker.fetch(new Request('https://mayphus.org/profile/'),env);assert.equal(await profile.text(),'canonical content');
 assert.equal((await worker.fetch(new Request('https://mayphus.org/_human/journal.html'),env)).status,404);
});

test('quiet archive is explicit and reversible while substantive archived work remains visible',()=>{
 const quiet={...doc,id:'note:reply',title:'Reply',url:'https://mayphus.org/notes/reply/',metadata:{type:'note',status:'archived',discovery:'archive'},text:'Original reply.'};
 const historical={...doc,id:'page:/study/',url:'https://mayphus.org/study/',metadata:{type:'page',status:'archived'}};
 assert.deepEqual(readingDocuments([quiet,historical]),[historical]);
 assert.deepEqual(readingDocuments([quiet,historical],{archive:true}),[quiet]);
 assert.ok(renderFullIndex(home,[quiet,historical],'/archive/').includes('href="/notes/reply/"'));
 assert.ok(!renderFullIndex(home,[quiet,historical]).includes('href="/notes/reply/"'));
 assert.ok(renderReadingIndexText(home,[quiet,historical],'/archive/').includes(quiet.url));
 assert.ok(renderDocument(home,quiet).includes('Archived record'));
 assert.ok(renderDocument(home,quiet).includes('<p>Original reply.</p>'));
 const restored={...quiet,metadata:{...quiet.metadata,discovery:'primary'}};
 assert.ok(readingDocuments([restored,historical]).includes(restored));
 assert.equal(quiet.text,restored.text);
});


test('compact shared chrome keeps home and footer contact; journal resolves legacy fragments',()=>{
 const html=renderDocument(home,doc);
 assert.ok(html.includes('aria-label="Mayphus home"'));
 assert.ok(!html.includes('href="#contact"'));
 assert.equal((html.match(/class="email-link"/g)||[]).length,1);
 assert.ok(renderFullIndex(home,[doc]).includes('<script src="/fragments.js" defer></script>'));
});


test('IPA enhancement is scoped and preserves canonical no-JavaScript audio links',()=>{
 const ipa={...doc,url:'https://mayphus.org/ipa/',text:'![IPA chart](/ipa/ipa-chart.svg)\n\n[p — Voiceless bilabial plosive](/ipa/sounds/001.ogg)'};
 const html=renderDocument(home,ipa);
 assert.ok(html.includes('data-ipa-chart'));
 assert.match(html,/src="\/ipa-chart\.[a-f0-9]{16}\.js" defer/);
 assert.ok(html.includes('href="/ipa/sounds/001.ogg"'));
 assert.ok(html.includes('src="/ipa/ipa-chart.svg"'));
 assert.ok(!renderDocument(home,doc).includes('/ipa-chart.'));
});


test('shared footer exposes the existing RSS feed and matching autodiscovery',()=>{
 for(const html of [renderHome(home,[doc]),renderDocument(home,doc),renderFullIndex(home,[doc])]) {
  assert.equal((html.match(/class="rss-link" href="\/rss.xml"/g)||[]).length,1);
  assert.ok(html.includes('<link rel="alternate" type="application/rss+xml" href="/rss.xml"'));
  assert.ok(html.includes('>RSS</a>'));
 }
});
