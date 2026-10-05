// Preserve old home-fragment links as readable views of the same canonical notes.
(async () => {
 if (!location.hash) return;
 let fragment;
 try { fragment=decodeURIComponent(location.hash.slice(1)); } catch { return; }
 if(fragment==='contact'||fragment==='main')return;
 try {
  const response=await fetch('/human-fragments.json');
  if(!response.ok)return;
  const routes=await response.json();
  if(typeof routes[fragment]==='string' && routes[fragment].startsWith('/notes/'))location.replace(routes[fragment]);
 } catch { /* The homepage remains readable when a request is unavailable. */ }
})();
