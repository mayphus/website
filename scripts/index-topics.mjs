// Topic icons use canonical metadata, never title matching or per-record overrides.
// Specific subject tags take precedence over broad media/software tags.
const categories = [
 ['photography','Photography',['photography'], '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>'],
 ['maps-history','Maps & history',['maps','openstreetmap','history','family history'], '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/>'],
 ['science','Science & mathematics',['biology','chemistry','mathematics','calculus','geometry','physics'], '<path d="M9 3h6M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10"/>'],
 ['art-language','Art & language',['generative','drawing','patterns','print','paper','hanzi','language','ipa','unicode','characters','input-method','rime','yuanshu'], '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1zM12 5v15"/>'],
 ['hardware','Hardware & robotics',['hardware','robotics','electronics','repair','teardown','embedded','camera','nanopi','nanopi-r2s','nanopi r2s','rp2040','raspberry pi pico'], '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/><rect x="10" y="10" width="4" height="4"/>'],
 ['software','Software & systems',['software','development','ai','language-models','training','freebsd','bsd','unix','linux','alpine','alpine linux','systems','networking','cloudflare','ops','operations','tailscale','homelab','macos','ubuntu','web','gateway','android'], '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m6 9 3 3-3 3M12 15h5"/>'],
];
const making = {key:'making',label:'Making',path:'<path d="m14 5 5 5M3 21l8-8M11 13l-3-3 8-8 6 6-8 8z"/>'};
const notePath='<path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6"/>';
export function indexTopic(doc) {
 const meta=doc.metadata || {};
 const tags=new Set((meta.tags || []).map(tag=>String(tag).toLowerCase().trim()));
 for(const [key,label,terms,path] of categories)if(terms.some(term=>tags.has(term)))return {key,label,path};
 if(meta.topic==='making')return making;
 const label=({ideas:'Ideas',life:'Life',work:'Work'}[meta.topic]) || ({profile:'Profile',tool:'Tool'}[meta.kind]) || ({article:'Article',project:'Project',note:'Note',page:'Reference'}[meta.type]) || 'Record';
 return {key:'record',label,path:notePath};
}
export function topicSvg(topic) {
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${topic.path}</svg>`;
}
