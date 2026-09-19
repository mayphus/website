export function render(template, content) {
 const escape = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
 return template.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => {
  if (typeof content[key] !== 'string') throw new Error(`Missing homepage field: ${key}`);
  if (key === 'github' && !/^https:\/\/github\.com\/[a-zA-Z0-9-]+\/?$/.test(content[key])) throw new Error('Invalid GitHub profile URL');
  if (key === 'email' && !/^[^\s<>"'@]+@[^\s<>"'@]+\.[^\s<>"'@]+$/.test(content[key])) throw new Error('Invalid email');
  return escape(content[key]);
 });
}
