'use strict';
const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(root+'/data/print-studio/editor.html','utf8'),elements=new Map(),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const element=id=>{assert.ok(ids.has(id),'HTML element '+id);if(!elements.has(id))elements.set(id,{id,value:'',innerHTML:'',checked:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},addEventListener(){},close(){this.open=false;},showModal(){this.open=true;},focus(){},clientWidth:900,clientHeight:800,querySelectorAll(){return[];},scrollIntoView(){}});return elements.get(id);};
const ctx={console,crypto,TextEncoder,TextDecoder,Uint8Array,Blob,URL,Map,Set,setTimeout:()=>0,clearTimeout(){},confirm:()=>true,location:{origin:'https://www.workupkorea.com'},document:{getElementById:element,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},activeElement:{tagName:'BODY'},documentElement:{dataset:{owner:'test-owner'},style:{setProperty(){}}}},window:{addEventListener(){}},ResizeObserver:class{observe(){}}};
vm.createContext(ctx);for(const name of ['app','catalog','web'])vm.runInContext(fs.readFileSync(root+'/public/print-studio/'+name+'.js','utf8'),ctx,{filename:name+'.js'});
vm.runInContext(`
const check=(ok,m)=>{if(!ok)throw Error(m);};check(state.cells.length===21,'all initial cells rendered');check(validateProject(state),'default project validates');
check($('paperCanvas').innerHTML.includes('product-cell'),'canvas starts');state.cells[0].product.image={data:'data:image/png;base64,AAAA',width:500,height:500,filename:'test.png'};check(drawSVG(false).includes('data:image/png;base64,AAAA'),'embedded images in print');
openWjumun();check($('wjDialog').open,'live product search opens');
wjItems=[{id:'1',name:'테스트 상품',price:5900,brand:'브랜드',code:'ABC',imageUrl:''}];renderWjumun();check($('wjResults').innerHTML.includes('5,900원'),'live retail price renders');check(!$('wjResults').innerHTML.includes('undefined'),'safe result fields');
check(drawSVG(true).includes('work-crop-guides'),'work crop marks preserved');check(drawSVG(false,true).includes('print-crop-marks'),'print crop marks preserved');
check($('cloudOpen').onclick&&$('cloudSaveConfirm').onclick,'cloud controls initialized');check(catalogRows.length===0,'private seed not shipped in client code');
`,ctx);
console.log('PASS: web editor startup, 21 cells, embedded print image, W주문 search UI, crop marks, cloud controls and private seed separation.');
// Compile small shared modules for parser and server-side boundary validation without a running service.
const ts=require(path.join(root,'node_modules/typescript'));
function loadTs(file){const source=fs.readFileSync(root+'/'+file,'utf8'),js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};vm.runInNewContext('(function(require,module,exports){'+js+'\n})',{URL,Buffer})(name=>name==='./print-studio'?loadTs('lib/print-studio.ts'):require(name),m,m.exports);return m.exports;}
const helpers=loadTs('lib/print-studio.ts'),parser=loadTs('lib/print-studio-products.ts');
assert.ok(helpers.validPrintImageUrl('https://wjumun.com/shop/data/item/1794455245/1794455245_l1.jpg'));
for(const url of ['http://wjumun.com/shop/data/item/1/1_l1.jpg','https://wjumun.com.evil.test/shop/data/item/1/1_l1.jpg','https://127.0.0.1/a','https://wjumun.com/admin/index.php','https://wjumun.com/shop/data/item/1/1_l1.jpg?redirect=evil'])assert.equal(helpers.validPrintImageUrl(url),false,url);
const owner=helpers.printOwnerKey('member-A'),id=crypto.randomUUID(),revision=crypto.randomUUID();assert.ok(helpers.validPrintObjectPath(owner+'/'+id+'/'+revision+'.json',owner,id));assert.equal(helpers.validPrintObjectPath('another/'+id+'/'+revision+'.json',owner,id),false);assert.notEqual(owner,helpers.printOwnerKey('member-B'));
const fixture='<table><tr><td><input type="hidden" name="it_id[0]" value="1794455245"></td><td></td><td></td><td></td><td></td><td>디월트</td><td><img src="/shop/data/item/1794455245/1794455245_s1.jpg" class="shop_img" data_img="/shop/data/item/1794455245/1794455245_l1.jpg"></td><td><input value="디월트 &amp; 팩슨 패딩 팬츠" name="it_name[0]"><input name="it_code[0]" value="8802081140066"><input name="it_maker[0]" value="WP27599"><input name="it_purchase_cost[0]" value="64950"><input name="it_supply_pay[0]" value="129,900"></td></tr></table>';
const products=parser.parsePrintProducts(fixture);assert.equal(products.length,1);assert.equal(products[0].price,129900);assert.equal(products[0].name,'디월트 & 팩슨 패딩 팬츠');assert.match(products[0].imageUrl,/_l1.jpg$/);assert.equal('cost' in products[0],false);assert.equal('supply' in products[0],false);
assert.equal(parser.parsePrintProducts(fixture.replace('129,900','가격확인필요')).length,0);
const legacy=parser.parsePrintProducts(fixture.replaceAll('1794455245','2d734d9830'))[0];assert.equal(legacy.id,'2d734d9830');assert.ok(helpers.validPrintImageUrl(legacy.imageUrl));
assert.equal(parser.parsePrintProducts(fixture.replace('<input type="hidden" name="it_id[0]" value="1794455245">','<a href="./item_form.php?mode=E&amp;it_id=1794455245&amp;page=1">수정</a>'))[0].id,'1794455245');
console.log('PASS: W주문 parser uses retail price and larger observed image; private fields excluded; image URL and storage owner/path boundaries validated.');
