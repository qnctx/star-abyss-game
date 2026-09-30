// Fetch the author's free Standard download. No account, payment or user data.
// Source responses are data only; no downloaded JavaScript is evaluated.
const base = 'https://quaternius.itch.io/universal-animation-library';
const cookies = new Map();
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Cookie: [...cookies].map(([k,v])=>`${k}=${v}`).join('; '), ...options.headers } });
  for (const cookie of response.headers.getSetCookie()) { const pair=cookie.split(';')[0], at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1)); }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${new URL(url).pathname}`);
  return response;
}
const purchase = await (await request(base + '/purchase')).text();
const csrf = purchase.match(/name="csrf_token" value="([^"]+)"/)?.[1];
if (!csrf) throw new Error('Missing anonymous CSRF token');
const result = await (await request(base + '/download_url', { method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf_token:csrf}) })).json();
if (!result.url) throw new Error('Free download link unavailable');
const page = await (await request(result.url)).text();
const upload = page.match(/data-upload_id="(\d+)"[^]*?title="Universal Animation Library\[Standard\]\.zip"/)?.[1];
if (!upload) throw new Error('Free Standard upload not found');
const pageCsrf = page.match(/name="csrf_token" value="([^"]+)"/)?.[1];
const key = page.match(/"key"\s*:\s*"([^"]+)"/)?.[1];
const query = new URLSearchParams({source:'game_download'});if(key)query.set('key',key);
const file = await (await request(`${base}/file/${upload}?${query}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf_token:pageCsrf||csrf})})).json();
if (!file.url || file.errors || file.lightbox) throw new Error('Free file unavailable: '+JSON.stringify(file.errors||file.lightbox_type||'no URL'));
const response = await fetch(file.url);
if (!response.ok) throw new Error('ZIP download failed');
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.subarray(0,2).toString() !== 'PK' || bytes.length > 25_000_000) throw new Error('Unexpected Standard archive');
const fs=await import('node:fs'),crypto=await import('node:crypto');
fs.mkdirSync('playable/assets/animations',{recursive:true});
fs.writeFileSync('playable/assets/animations/quaternius-standard.zip',bytes);
console.log(JSON.stringify({file:'playable/assets/animations/quaternius-standard.zip',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
