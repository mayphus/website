// Existing production edge analytics insertion, matched byte-for-byte.
export const productionAnalytics = "<script>(function(w,i,g){w[g]=w[g]||[];if(typeof w[g].push=='function')w[g].push(i)})\n(window,'G-XLGB1ZDPYC','google_tags_first_party');</script><script async src=\"/analytics/\"></script>\n\t\t\t<script>\n\t\t\t\twindow.dataLayer = window.dataLayer || [];\n\t\t\t\tfunction gtag(){dataLayer.push(arguments);}\n\t\t\t\tgtag('js', new Date());\n\t\t\t\tgtag('set', 'developer_id.dYzg1YT', true);\n\t\t\t\tgtag('config', 'G-XLGB1ZDPYC');\n\t\t\t</script>\n\t\t\t";
export const productionBeacon = "<script type=\"module\" src=\"https://static.cloudflareinsights.com/beacon.min.js/v31edd6df95cf4e85bb4c19e7a9bdbcba1788362987495\" integrity=\"sha512-iIg7k2xntmwu6/uSb5tpc/hySgZc4eoL31yB29W6tJFo2akwjPWcEqnCEdJvGexCL0KEQwVYv5BlowfhVz26hg==\" data-cf-beacon='{\"version\":\"2024.11.0\",\"token\":\"eca6dd6a7fdb499fb8e9276852858ea0\",\"r\":1,\"spa\":2}' crossorigin=\"anonymous\"></script>\n";
// Exact additional edge version observed during production verification on 2026-10-07.
export const productionBeaconCurrent = "<script type=\"module\" src=\"https://static.cloudflareinsights.com/beacon.min.js/v4bc70e2c01a94c73b74392e4234840661791215815920\" integrity=\"sha512-L0ha0OXavK/8okipN9F8BtP84dg9DUhPERbBXzwI6dgTA55d2+yweo3pn5CSFYs45/r8md2+xvUPtTdvTNRfjA==\" data-cf-beacon='{\"version\":\"2024.11.0\",\"token\":\"eca6dd6a7fdb499fb8e9276852858ea0\",\"r\":1,\"spa\":2}' crossorigin=\"anonymous\"></script>\n";
export function canonicalHtml(html, base) {
 if(new URL(base).origin !== 'https://mayphus.org') return html;
 const normalized=html.replace('<head>'+productionAnalytics, '<head>');
 for(const beacon of [productionBeacon,productionBeaconCurrent]) {
  if(normalized.endsWith(beacon+'</body></html>')) return normalized.slice(0,-(beacon+'</body></html>').length)+'</body></html>';
  if(normalized.endsWith(beacon+'</body>')) return normalized.slice(0,-(beacon+'</body>').length)+'</body>';
 }
 return normalized;
}
