// Enhance the retained chart. Audio mappings and names come from canonical links.
(async () => {
 const article = document.querySelector('[data-ipa-chart]');
 const fallback = article?.querySelector('img[src="/ipa/ipa-chart.svg"]');
 if (!fallback) return;
 const samples = new Map();
 for (const link of article.querySelectorAll('a[href^="/ipa/sounds/"]')) {
  const match = link.textContent.match(/^(.+?) — (.+)$/);
  if (match && /^\/ipa\/sounds\/\d{3}\.(?:ogg|oga)$/.test(link.getAttribute('href'))) samples.set(match[1], {url: link.getAttribute('href'), name: match[2]});
 }
 const status = document.createElement('p');
 status.className = 'ipa-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
 fallback.parentElement.before(status);
 try {
  const response = await fetch('/ipa/ipa-chart.svg');
  if (!response.ok) throw new Error('Chart unavailable');
  const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml').documentElement;
  if (svg.localName !== 'svg' || svg.querySelector('parsererror')) throw new Error('Invalid chart');
  const chart = document.importNode(svg, true);
  for (const style of chart.querySelectorAll('style')) style.textContent = style.textContent.replace(/:root\s*\{[^}]*\}/g, '');
  chart.removeAttribute('width'); chart.removeAttribute('height');
  chart.setAttribute('role', 'group'); chart.setAttribute('aria-label', 'IPA chart with 14 recorded symbols');
  const ns = 'http://www.w3.org/2000/svg';
  const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'none'; audio.hidden = true;
  audio.setAttribute('aria-label', 'Selected IPA recording');
  let selected = null;
  const choices = [];
  const label = () => selected ? selected.symbol + ' — ' + selected.sample.name : '';
  const fail = () => { status.textContent = label() + '. Audio could not play. Try the audio links below.'; };
  audio.addEventListener('error', fail);
  audio.addEventListener('ended', () => { status.textContent = label() + '. Audio finished.'; });
  function select(choice) {
   audio.pause(); selected = choice;
   for (const item of choices) { item.button.setAttribute('aria-pressed', String(item === choice)); }
   status.textContent = label() + '. Loading audio…';
   audio.src = choice.sample.url; audio.hidden = false;
   audio.play().then(() => { if (selected === choice) status.textContent = label() + '. Playing.'; }).catch(() => { if (selected === choice) fail(); });
  }
  for (const cell of chart.querySelectorAll('[data-ipa]')) {
   cell.removeAttribute('tabindex'); cell.removeAttribute('role'); cell.removeAttribute('aria-label');
   const symbols = cell.getAttribute('data-ipa').split(/\s+/);
   if (!symbols.every(symbol => samples.has(symbol))) continue;
   const rect = cell.querySelector('rect'), text = cell.querySelector('text');
   if (!rect || !text) continue;
   const x = Number(rect.getAttribute('x')), y = Number(rect.getAttribute('y'));
   const width = Number(rect.getAttribute('width')) / symbols.length, height = Number(rect.getAttribute('height'));
   const baseline = text.getAttribute('y'); cell.replaceChildren();
   for (const [index, symbol] of symbols.entries()) {
    const button = document.createElementNS(ns, 'g'); button.classList.add('ipa-choice'); button.setAttribute('data-symbol', symbol);
    button.setAttribute('tabindex', '0'); button.setAttribute('role', 'button'); button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', symbol + ' — ' + samples.get(symbol).name + '. Play recording');
    const hit = document.createElementNS(ns, 'rect');
    for (const [key, value] of Object.entries({x: x + index * width, y, width, height})) hit.setAttribute(key, String(value));
    const glyph = document.createElementNS(ns, 'text'); glyph.setAttribute('x', String(x + (index + .5) * width)); glyph.setAttribute('y', baseline); glyph.setAttribute('text-anchor', 'middle'); glyph.classList.add('ipa-symbol'); glyph.textContent = symbol;
    button.append(hit, glyph); cell.append(button);
    const choice = {button, symbol, sample: samples.get(symbol)}; choices.push(choice);
    button.addEventListener('click', () => select(choice));
    button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(choice); } });
   }
  }
  if (choices.length !== samples.size || !choices.length) throw new Error('Incomplete chart');
  const region = document.createElement('div'); region.className = 'ipa-chart-scroll'; region.tabIndex = 0;
  region.setAttribute('role', 'region'); region.setAttribute('aria-label', 'Scrollable IPA chart'); region.append(chart);
  fallback.parentElement.replaceWith(region); region.before(audio);
  status.textContent = 'Choose a highlighted symbol. Only the 14 linked recordings are available.';
 } catch {
  status.textContent = 'Interactive chart unavailable. Use the chart image and audio links below.';
 }
})();
