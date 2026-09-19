// Compatibility for old /#note-id links. Reading never requires JavaScript.
if (location.hash) {
  fetch('/legacy-fragments.json').then(response => response.json()).then(records => {
    const target = records[decodeURIComponent(location.hash.slice(1))];
    if (typeof target === 'string' && target.startsWith('/records/')) location.replace(target);
  }).catch(() => {});
}
