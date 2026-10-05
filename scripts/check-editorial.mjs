import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDocument,renderHome,viewUrl,recordImages} from './editorial.mjs';
const home={title:'Mayphus',email:'tangmeifa@gmail.com',github:'https://github.com/mayphus',footer:'One content.',introduction:'Build with AI.',background:'Software and systems.',records_description:'Source records.',contact_invitation:'People and their AI agents are welcome.'};
const doc={id:'note:example',title:'测试 <script>',url:'https://mayphus.org/example/',text_url:'https://mayphus.org/records/example.txt',summary:'A safe & readable record.',metadata:{type:'article',date:'2026-10-05',route:'/example/'},text:'# 测试 <script>\n\n[Bad](javascript:alert(1))\n\n<script>alert(1)</script>\n\n| Column | Value |\n|---|---|\n|中文|123|'};
test('renders the canonical record safely with semantic reading and contact',()=>{const html=renderDocument(home,doc);assert.ok(html.includes('测试 &lt;script&gt;'));assert.ok(!html.includes('<script>alert'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('class="table-scroll"'));assert.ok(html.includes('mailto:'+home.email));assert.ok(html.includes(home.contact_invitation));assert.ok(html.includes('/example/index.txt'));assert.ok(html.includes('name="viewport"'));assert.ok(html.includes('Skip to content'));});
test('renders empty indexes and encoded fragment routes without new content',()=>{assert.ok(renderHome(home,[],[]).includes('No entries are published'));assert.equal(viewUrl({...doc,url:'https://mayphus.org/#old-note'}),'/notes/old-note/');assert.throws(()=>renderDocument({...home,email:'bad"@email'},doc),/contact email/);});

// Production analytics may add only its exact known prefix; all other bytes remain checked.
import {canonicalHtml, productionAnalytics, productionBeacon} from './html-contract.mjs';
test('HTML comparison accepts only the existing production analytics insertion',()=>{
 const expected='<head><meta charset="utf-8"></head><body>reviewed</body>';
 const actual=expected.replace('<head>','<head>'+productionAnalytics).replace('</body>',productionBeacon+'</body>');
 assert.equal(canonicalHtml(actual,'https://mayphus.org'),expected);
 assert.equal(canonicalHtml(expected,'https://mayphus.org'),expected);
 assert.equal(canonicalHtml(actual,'https://abc-mayphus.mayphus.workers.dev'),actual);
 assert.notEqual(canonicalHtml(actual.replace('reviewed','stale'),'https://mayphus.org'),expected);
 assert.notEqual(canonicalHtml(actual.replace('/analytics/','/unexpected/'),'https://mayphus.org'),expected);
});

test('notebook uses only existing same-site photos and real topic connections',()=>{
 const note={...doc,text:'Board on the bench (https://mayphus.org/media/board.jpg) (https://mayphus.org/media/board.jpg) https://other.example/photo.jpg',metadata:{...doc.metadata,tags:['hardware']}};
 assert.deepEqual(recordImages(note),[{url:'https://mayphus.org/media/board.jpg',caption:'Board on the bench'}]);
 const related={...doc,id:'related',title:'Related board',url:'https://mayphus.org/related/',metadata:{type:'note',tags:['hardware']}};
 const unrelated={...related,id:'unrelated',title:'Unrelated',metadata:{type:'note',tags:['software']}};
 const html=renderDocument(home,note,[note,related,unrelated]);
 assert.ok(html.includes('alt="Board on the bench"'));
 assert.ok(html.includes('Related board'));
 assert.ok(!html.includes('>Unrelated<'));
});
