const assert=require('node:assert/strict');
const fs=require('node:fs');
const Module=require('node:module');
const ts=require('typescript');
const source=fs.readFileSync('apps/web/app/clinic-map/route.ts','utf8');
const m=new Module(require('node:path').resolve('apps/web/app/clinic-map/route.ts'));
m.filename=m.id;
m._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,m.filename);
(async()=>{
 const previousKey=process.env.GOOGLE_MAPS_EMBED_KEY,previousFile=process.env.GOOGLE_MAPS_EMBED_KEY_FILE;
 delete process.env.GOOGLE_MAPS_EMBED_KEY;delete process.env.GOOGLE_MAPS_EMBED_KEY_FILE;
 try {
  const request=id=>new Request('https://dentpro.example/clinic-map?place_id='+encodeURIComponent(id));
  assert.equal((await m.exports.GET(request('<script>'))).status,400);
  const id='ChIJSyntheticPlace123';
  assert.equal((await m.exports.GET(request(id))).status,503);
  process.env.GOOGLE_MAPS_EMBED_KEY='synthetic-embed-key';
  const response=await m.exports.GET(request(id));
  const html=await response.text();
  assert.equal(response.status,200);
  assert.match(html,/q=place_id%3AChIJSyntheticPlace123/);
  assert.match(html,/referrerpolicy="strict-origin-when-cross-origin"/);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(response.headers.get('content-security-policy'),/frame-src https:\/\/www.google.com/);
  assert.match(html,/allowfullscreen/);
  assert.match(html,/min-width:200px;min-height:200px/);
  assert.doesNotMatch(html,/patient|Bearer/);
  process.env.GOOGLE_MAPS_EMBED_KEY_FILE='/nonexistent/dentpro-test-key';
  assert.equal((await m.exports.GET(request(id))).status,503);
  console.log('PASS: Maps Embed validation, configuration fallback, restricted iframe, headers and no patient data.');
 } finally {
  if(previousKey===undefined)delete process.env.GOOGLE_MAPS_EMBED_KEY;else process.env.GOOGLE_MAPS_EMBED_KEY=previousKey;
  if(previousFile===undefined)delete process.env.GOOGLE_MAPS_EMBED_KEY_FILE;else process.env.GOOGLE_MAPS_EMBED_KEY_FILE=previousFile;
 }
})().catch(error=>{console.error(error);process.exit(1)});
