'use strict';
// Imported original sources are kept private; only generic editor code and its font are public.
const fs=require('fs'),path=require('path'),vm=require('vm');
const FONT_URL='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2';
const original=path.resolve(process.argv[2]||'../workup-print-studio'),out='public/print-studio',privateDir='data/print-studio';
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(privateDir+'/photos',{recursive:true});
let html=fs.readFileSync(original+'/dist/index.html','utf8');
html=html.replace('<html lang="ko">','<html lang="ko" data-owner="__PRINT_OWNER__">').replace('전단 스튜디오 9','전단 스튜디오 WEB');
html=html.replace('href="style.css"','href="/print-studio/style.css"');
html=html.replace('<div class="top-actions">','<div class="top-actions"><span id="cloudStatus" class="cloud-status">서버 미저장</span><button id="cloudOpen">내 전단</button><button id="cloudSave">서버 저장</button>');
html=html.replace('<button id="openCatalog" class="primary">발주 상품 불러오기</button>', '<button id="openWjumun" class="primary">W주문 상품 검색</button><button id="openCatalog" class="subtle">저장된 상품 자료</button>');
html=html.replace('확보한 확대 사진 65개 · 전체 상품 정보 검색','W주문 최신 조회 · 저장된 자료도 사용 가능');
html=html.replace('<script src="app.js"></script>',fs.readFileSync('scripts/print-studio-ui.html','utf8')+'<script src="/print-studio/app.js"></script><script src="/print-studio/catalog.js"></script><script src="/print-studio/web.js"></script>');
let app=fs.readFileSync(original+'/dist/app.js.before-catalog','utf8');
app=app.replace("indexedDB.open('workup-print-studio',1)","indexedDB.open('workup-print-studio-web-'+document.documentElement.dataset.owner,1)");
app=app.replace("new URL('PretendardVariable.ttf',location.href)","new URL('"+FONT_URL+"')");
app=app.replace("function helpJump(target){$('helpDialog').close();", "function helpJump(target){$('helpDialog').close();if(target==='catalog'){openCatalog();return;}");
let catalog="const CATALOG_SEED={date:'2026-11-13',rows:[],photos:{},assets:{}};\n"+fs.readFileSync(original+'/catalog.js','utf8');
catalog=catalog.replace("indexedDB.open('workup-print-studio',1)","indexedDB.open('workup-print-studio-web-'+document.documentElement.dataset.owner,1)");
const web=fs.readFileSync('scripts/print-studio-web.js','utf8');
for(const [name,code] of [['app.js',app],['catalog.js',catalog],['web.js',web]]){new vm.Script(code,{filename:name});fs.writeFileSync(out+'/'+name,code);}
let css=fs.readFileSync(original+'/dist/style.css','utf8')+'\n'+fs.readFileSync('scripts/print-studio-web.css','utf8');css=css.replace('url("PretendardVariable.ttf")','url("'+FONT_URL+'")').replace(/format\(["']truetype["']\)/g,"format('woff2')");
fs.writeFileSync(out+'/style.css',css);fs.writeFileSync(privateDir+'/editor.html',html);
const seed=JSON.parse(fs.readFileSync(original+'/catalog-snapshot.json','utf8')),photos={};for(const [hash,image] of Object.entries(seed.assets)){const ext=image.data.startsWith('data:image/png')?'png':'jpg';fs.writeFileSync(privateDir+'/photos/'+hash+'.'+ext,Buffer.from(image.data.split(',')[1],'base64'));}for(const [id,hash] of Object.entries(seed.photos)){const image=seed.assets[hash],ext=image.data.startsWith('data:image/png')?'png':'jpg';photos[id]={data:'/api/admin/print-studio/catalog?asset='+hash+'.'+ext,width:image.width,height:image.height,filename:image.filename};}
fs.writeFileSync(privateDir+'/catalog.json',JSON.stringify({date:seed.date,rows:seed.rows,photos}));
if(fs.statSync(privateDir+'/catalog.json').size>4*1024*1024)throw Error('Private catalog exceeds function response size budget');
if(app.includes('1794545384')||catalog.includes('1794545384'))throw Error('Private seed leaked into public script');
console.log(JSON.stringify({editorBytes:Buffer.byteLength(html),coreBytes:Buffer.byteLength(app),catalogBytes:fs.statSync(privateDir+'/catalog.json').size,photoAssets:Object.keys(seed.assets).length}));
