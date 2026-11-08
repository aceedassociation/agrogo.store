(() => {
 'use strict';
 const dictionaries=window.LAND_I18N;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const tr=(lang,k)=>dictionaries[lang]?.[k]||dictionaries.fr[k]||k;
 const localized=(v,lang)=>typeof v==='object'?(v?.[lang]||v?.fr||''):String(v??'');
 const digits=v=>String(v||'').replace(/[٠-٩]/g,c=>c.charCodeAt(0)-1632).replace(/[۰-۹]/g,c=>c.charCodeAt(0)-1776);
 const regions=[
  ['tanger','Tanger-Tétouan-Al Hoceïma','طنجة تطوان الحسيمة'],['oriental','Oriental','الشرق'],['fes','Fès-Meknès','فاس مكناس'],['rabat','Rabat-Salé-Kénitra','الرباط سلا القنيطرة'],['beni','Béni Mellal-Khénifra','بني ملال خنيفرة'],['casablanca','Casablanca-Settat','الدار البيضاء سطات'],['marrakech','Marrakech-Safi','مراكش آسفي'],['draa','Drâa-Tafilalet','درعة تافيلالت'],['souss','Souss-Massa','سوس ماسة'],['guelmim','Guelmim-Oued Noun','كلميم واد نون'],['laayoune','Laâyoune-Sakia El Hamra','العيون الساقية الحمراء'],['dakhla','Dakhla-Oued Ed-Dahab','الداخلة وادي الذهب']
 ];
 const options={areaUnit:['ha','sqm'],landType:['crop','orchard','livestock','mixed','other'],waterNeed:['waterAny','waterRequired','waterFlexible'],water:['unknown','well','network','basin','multiple','noWater'],access:['unknown','road','track','limited'],electricity:['unknown','connected','solar','nearby','none'],titlePref:['titleAny','titled','registration','melk'],tenure:['titled','registration','melk','collective','unknown'],timeline:['soon','threeMonths','sixMonths','flexible'],priceBasis:['total','perHa','perSqm'],relationship:['owner','representative','another']};
 const defaults={buy:{areaUnit:'ha',landType:'crop',waterNeed:'waterAny',titlePref:'titleAny',timeline:'flexible'},sell:{areaUnit:'ha',priceBasis:'total',water:'unknown',access:'unknown',electricity:'unknown'}};
 const state={mode:'buy',buy:{data:{...defaults.buy},signature:'',reference:'',status:'',busy:false},sell:{data:{...defaults.sell},signature:'',reference:'',status:'',busy:false}};
 let current=null;
 const validLink=v=>{if(!v)return true;try{return /^https?:$/.test(new URL(v).protocol);}catch{return false;}};
 const fields={buy:['region','commune','areaUnit','minArea','maxArea','minBudget','maxBudget','landType','waterNeed','titlePref','timeline','notes','name','phone','email'],sell:['propertyTitle','region','commune','area','areaUnit','askingPrice','priceBasis','tenure','relationship','water','access','electricity','equipment','mapLink','photoLinks','notes','name','phone','email']};
 const labels={buy:{commune:'communeBuy'},sell:{notes:'notesSell'}};
 function valueText(k,v,lang){if(k==='region'){const r=regions.find(r=>r[0]===v);return r?r[lang==='ar'?2:1]:v==='any'?tr(lang,'anyRegion'):v;}return options[k]?tr(lang,v):v;}
 function summary(mode,data,lang){return fields[mode].filter(k=>data[k]!==undefined&&String(data[k]).trim()).map(k=>tr(lang,labels[mode][k]||k)+': '+valueText(k,String(data[k]).trim(),lang)).join('\n');}
 function validate(mode,data){
  const errors={};
  const required=mode==='sell'?['propertyTitle','region','commune','area','areaUnit','askingPrice','priceBasis','tenure','relationship','name','phone','consent']:['region','minArea','areaUnit','maxBudget','name','phone','consent'];
  required.forEach(k=>{if(!String(data[k]||'').trim())errors[k]='required';});
  if(!['ha','sqm'].includes(data.areaUnit))errors.areaUnit='required';
  const phone=digits(data.phone).replace(/\D/g,'');if(phone.length<8||phone.length>15)errors.phone='phoneError';
  for(const k of mode==='buy'?['minArea','maxArea','minBudget','maxBudget']:['area','askingPrice']){
   if(data[k]!==undefined&&data[k]!==''){
    const n=Number(data[k]);if(!Number.isFinite(n)||n<0||(['area','minArea','maxBudget','askingPrice'].includes(k)&&n===0))errors[k]='required';
   }
  }
  if(mode==='buy')for(const [a,b] of [['minArea','maxArea'],['minBudget','maxBudget']])if(data[a]!==''&&data[b]!==''&&data[a]!=null&&data[b]!=null&&+data[a]>+data[b])errors[b]='rangeError';
  for(const k of ['mapLink','photoLinks'])if(!validLink(data[k]))errors[k]='linkError';
  if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))errors.email='required';
  if(data.consent!=='yes')errors.consent='required';
  return errors;
 }
 function createPayload({mode,data,lang='fr',reference,submittedAt=new Date().toISOString()}){
  if(!['buy','sell'].includes(mode)||!reference||Object.keys(validate(mode,data)).length)throw new Error('Invalid land request');
  const kind=tr('fr',mode==='buy'?'buyerRequest':'sellerRequest');
  const details=summary(mode,data,lang);
  const payload={subject:`AGROGO FONCIER — ${kind} ${reference}`,service:'Foncier agricole',intent:mode==='buy'?'achat':'vente',reference,language:lang,submitted_at:submittedAt,name:data.name.trim(),phone:digits(data.phone).trim(),region:valueText('region',data.region,'fr'),consent:'Contact autorisé pour cette demande',details,message:`AGROGO — FONCIER AGRICOLE\n${tr(lang,mode==='buy'?'buyerRequest':'sellerRequest')}\n${tr(lang,'reference')}: ${reference}\n\n${details}`,_gotcha:data._gotcha||''};
  if(data.email?.trim())payload.email=data.email.trim();
  if(mode==='sell')payload.area_m2=String(Number(data.area)*(data.areaUnit==='ha'?10000:1));
  return payload;
 }
 const signature=(mode,data)=>JSON.stringify([mode,...fields[mode].map(k=>String(data[k]||'').trim()),data.consent||'']);
 function ensureReference(mode){const s=state[mode],sig=signature(mode,s.data);if(s.signature!==sig){s.signature=sig;s.reference='AG-F-'+(mode==='buy'?'A':'V')+'-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+(window.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)).slice(0,8).toUpperCase();s.status='';}return s.reference;}
 const icon=`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="m7 15 12-5 11 5 11-5v28l-11 5-11-5-12 5V15Z"/><path d="M19 10v28m11-23v28M10 29l6-3m7-4 4 2m6 5 5-3"/></svg>`;
 function teaser(lang){const t=k=>tr(lang,k);return `<section class="container land-home"><img src="assets/foncier/parcelles.jpg" alt="${esc(t('nav'))}" loading="lazy"><div><span class="land-kicker">${t('homeEye')}</span><h2>${t('homeTitle')}</h2><p>${t('homeText')}</p><a href="#/foncier-agricole" class="btn">${t('homeAction')} <span aria-hidden="true">↗</span></a></div><span class="land-home-index" aria-hidden="true">${icon}</span></section>`;}
 function render({main,lang,wa}){
  current={main,lang,wa};
  const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('intent');if(requested==='buy'||requested==='sell')state.mode=requested;
  const t=k=>tr(lang,k);
  main.innerHTML=`<div class="land-page"><div class="container land-crumb"><a href="#/">${window.L10N[lang].home}</a><span>/</span><span>${t('nav')}</span></div><section class="land-hero container"><img class="land-hero-image" src="assets/foncier/parcelles.jpg" alt="${t('photoNote')}" fetchpriority="high"><div class="land-hero-copy"><span class="land-kicker">AGROGO / ${t('eye')}</span><h1>${t('title')}</h1><p>${t('intro')}</p><a href="#land-intake" class="land-hero-link" data-land-start="buy">${t('buyShort')} <span aria-hidden="true">↗</span></a><a href="#land-intake" class="land-hero-link secondary" data-land-start="sell">${t('sellShort')} <span aria-hidden="true">↗</span></a></div><div class="land-stamp" aria-hidden="true">${icon}<span>AGROGO<br><b>FONCIER</b></span></div><p class="land-photo-caption">${t('heroNote')}</p></section><div class="container"><div class="land-intents" aria-label="${t('nav')}">${['buy','sell'].map((m,i)=>`<button type="button" class="land-intent" data-land-mode="${m}" aria-pressed="${state.mode===m}"><span class="land-intent-index">0${i+1}</span><span><strong>${t(m)}</strong><small>${t(m+'Sub')}</small></span><span class="land-intent-arrow" aria-hidden="true">↗</span></button>`).join('')}</div><p class="land-ambient-note">${t('photoNote')}</p></div><section class="container land-intake" id="land-intake" aria-labelledby="land-form-heading"><aside class="land-guide"><span class="land-kicker">${t('formEye')}</span><h2 id="land-form-heading"></h2><p id="land-form-intro"></p><ol class="land-flow">${[1,2,3].map(n=>`<li><span>0${n}</span><div><h3>${t('flow'+n)}</h3><p>${t('flow'+n+'d')}</p></div></li>`).join('')}</ol><div class="land-direct">${icon}<p>${t('direct')}<a href="${wa('AGROGO FONCIER — '+t('sentVia'))}" target="_blank" rel="noopener">${t('directLink')} ↗</a></p></div></aside><div class="land-form-wrap" id="land-form-slot"></div></section><section class="container land-listings" aria-labelledby="land-listing-heading"><div class="land-section-title"><div><span class="land-kicker">${t('listEye')}</span><h2 id="land-listing-heading">${t('listTitle')}</h2></div><span class="land-outline-icon">${icon}</span></div><div id="land-listing-content"></div></section><section class="land-inspiration"><div class="container"><div class="land-section-title"><div><span class="land-kicker">${t('inspiration')}</span><h2>${t('inspirationTitle')}</h2></div><p>${t('photoNote')}</p></div><div class="land-photo-grid">${[['parcelles','culture'],['oliveraie','orchard'],['terres-aeriennes','open']].map(([img,k],i)=>`<figure><img src="assets/foncier/${img}.jpg" alt="${esc(t(k+'Title'))}" loading="lazy"><figcaption><small>0${i+1}</small><div><h3>${t(k+'Title')}</h3><p>${t(k+'Text')}</p></div></figcaption></figure>`).join('')}</div><a class="land-credits" href="https://www.pexels.com/" target="_blank" rel="noopener">${t('photoCredits')} ↗</a></div></section></div>`;
  main.querySelectorAll('[data-land-start]').forEach(a=>a.onclick=e=>{e.preventDefault();setMode(a.dataset.landStart,true);});
  main.querySelectorAll('[data-land-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.landMode,true));
  drawForm();drawListings();
 }
 function setMode(mode,scroll){
  if(state[state.mode].busy)return;
  state.mode=mode;history.replaceState(null,'','#/foncier-agricole?intent='+mode);
  current.main.querySelectorAll('[data-land-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.landMode===mode)));
  drawForm();if(scroll)document.querySelector('#land-intake').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 }
 function drawForm(){
  const {main,lang,wa}=current,t=k=>tr(lang,k),mode=state.mode,s=state[mode],d=s.data;
  main.querySelector('#land-form-heading').textContent=t(mode+'Title');main.querySelector('#land-form-intro').textContent=t(mode+'Text');
  function field(k,{type='text',required=false,label=labels[mode][k]||k,placeholder='',full=false}={}){
   const v=String(d[k]??''),id='land-'+k,base=`id="${id}" name="${k}" ${required?'required':''}`;
   let input;
   if(k==='region')input=`<select ${base}><option value="">${t('choose')}</option>${mode==='buy'?`<option value="any" ${v==='any'?'selected':''}>${t('anyRegion')}</option>`:''}${regions.map(r=>`<option value="${r[0]}" ${v===r[0]?'selected':''}>${esc(r[lang==='ar'?2:1])}</option>`).join('')}</select>`;
   else if(options[k])input=`<select ${base}>${required&&!v?`<option value="">${t('choose')}</option>`:''}${options[k].map(o=>`<option value="${o}" ${v===o?'selected':''}>${t(o)}</option>`).join('')}</select>`;
   else if(type==='textarea')input=`<textarea ${base} rows="3" maxlength="3000" placeholder="${esc(placeholder)}">${esc(v)}</textarea>`;
   else input=`<input ${base} type="${type}" value="${esc(v)}" ${type==='number'?`min="${['minBudget','maxArea'].includes(k)?'0':'0.0001'}" max="100000000000000" step="any" inputmode="decimal"`: `maxlength="${type==='tel'?'30':type==='url'?'2000':'250'}"`} ${['tel','email','url'].includes(type)?'dir="ltr"':''} ${k==='name'?'autocomplete="name"':k==='phone'?'autocomplete="tel"':k==='email'?'autocomplete="email"':''} placeholder="${esc(placeholder)}">`;
   return `<div class="land-field ${full?'land-full':''}"><label for="${id}">${t(label)}${required?' <span aria-hidden="true">*</span>':''}</label>${input}${k==='photoLinks'?`<small>${t('photosHint')}</small>`:''}</div>`;
  }
  const section=(i,title,content)=>`<fieldset><legend><span>0${i}</span> ${t(title)}</legend><div class="land-fields">${content}</div></fieldset>`;
  const primary=mode==='buy'?field('region',{required:true})+field('commune')+field('minArea',{type:'number',required:true})+field('maxArea',{type:'number'})+field('areaUnit')+field('landType')+field('minBudget',{type:'number'})+field('maxBudget',{type:'number',required:true}):field('propertyTitle',{required:true,full:true,placeholder:t('titlePlaceholder')})+field('region',{required:true})+field('commune',{required:true})+field('area',{type:'number',required:true})+field('areaUnit')+field('askingPrice',{type:'number',required:true})+field('priceBasis')+field('tenure',{required:true})+field('relationship',{required:true});
  const features=mode==='buy'?field('waterNeed')+field('titlePref')+field('timeline')+field('notes',{type:'textarea',full:true}):field('water')+field('access')+field('electricity')+field('equipment',{type:'textarea',full:true,placeholder:t('equipmentHint')})+field('mapLink',{type:'url',full:true,placeholder:t('linkPlaceholder')})+field('photoLinks',{type:'url',full:true,placeholder:t('linkPlaceholder')})+field('notes',{type:'textarea',full:true});
  main.querySelector('#land-form-slot').innerHTML=`<form id="land-form"><div class="land-form-top"><span>${t(mode==='buy'?'buyShort':'sellShort')}</span><small>${t('required')}</small></div>${section(1,mode==='buy'?'partSearch':'partLand',primary)}${section(2,'partFeatures',features)}${section(3,'partContact',field('name',{required:true})+field('phone',{type:'tel',required:true,placeholder:'+212 …'})+field('email',{type:'email',full:true}))}<div class="form-trap" aria-hidden="true"><label>Leave empty<input name="_gotcha" tabindex="-1" autocomplete="off"></label></div><label class="land-consent"><input type="checkbox" name="consent" value="yes" ${d.consent==='yes'?'checked':''} required><span>${t('consent')} <a href="#/confidentialite">${t('privacy')} ↗</a></span></label><p class="land-privacy-note">${t('privacyBrief')}</p><details class="land-review"><summary>${t('review')}</summary><pre id="land-preview"></pre></details><div id="land-status" role="status" aria-live="polite"></div><div class="land-submit-actions"><button class="btn" type="submit" id="land-send">${t(mode==='buy'?'send':'sendSell')} <span aria-hidden="true">↗</span></button><a class="land-wa" id="land-wa" href="#" target="_blank" rel="noopener">${t('whatsapp')} ↗</a></div><button class="land-native" id="land-native" type="button" hidden>${t('native')} ↗</button><p class="land-form-note">${t(mode==='sell'?'photosLater':'emailOptional')}</p></form>`;
  const form=main.querySelector('#land-form');
  function read(){if(!s.busy){s.data=Object.fromEntries(new FormData(form));if(s.signature&&s.signature!==signature(mode,s.data))s.status='';}return s.data;}
  function check(){const errors=validate(mode,s.data);form.querySelectorAll('input,select,textarea').forEach(el=>el.setCustomValidity(''));Object.entries(errors).forEach(([k,msg])=>{const el=form.elements.namedItem(k);if(el&&msg!=='required')el.setCustomValidity(t(msg));});return form.reportValidity()&&!Object.keys(errors).length;}
  function update(){
   const data=s.data,ref=s.reference&&s.signature===signature(mode,data)?s.reference:'';
   main.querySelector('#land-preview').textContent=summary(mode,data,lang);
   const message=`AGROGO — FONCIER AGRICOLE\n${t(mode==='buy'?'buyerRequest':'sellerRequest')}${ref?'\n'+t('reference')+': '+ref:''}\n\n${summary(mode,data,lang)}`;
   form.querySelector('#land-wa').href=wa(message);
   form.querySelector('#land-send').disabled=s.busy||s.status==='sent';
   form.querySelector('#land-send').innerHTML=esc(t(s.busy?'sending':s.status==='sent'?'already':mode==='buy'?'send':'sendSell'))+' <span aria-hidden="true">↗</span>';
   form.querySelectorAll('fieldset').forEach(f=>f.disabled=s.busy);form.elements.consent.disabled=s.busy;
   main.querySelectorAll('[data-land-mode]').forEach(b=>b.disabled=s.busy);
   form.querySelector('#land-native').hidden=s.status!=='error';
   form.querySelector('#land-status').className=s.status?'land-status '+s.status:'';
   form.querySelector('#land-status').innerHTML=s.status==='sent'?`<strong>✓ ${t('sent')}</strong><p>${t('sentText')}</p><small>${t('reference')}</small><b dir="ltr">${esc(s.reference)}</b>`:s.status==='error'?`<strong>${t('error')}</strong><b dir="ltr">${esc(s.reference)}</b>`:'';
  }
  form.oninput=()=>{read();form.querySelectorAll('input,select,textarea').forEach(el=>el.setCustomValidity(''));update();};
  form.onchange=()=>{read();update();};
  form.onsubmit=async e=>{
   e.preventDefault();if(s.busy)return;read();if(!check())return;
   ensureReference(mode);if(s.status==='sent')return;
   const body=createPayload({mode,data:s.data,lang,reference:s.reference});s.busy=true;s.status='';update();
   try{await window.AGROGO_ORDERS.submit(body);s.status='sent';}catch{s.status='error';}
   finally{s.busy=false;if(form.isConnected)update();else if(document.querySelector('#land-form')&&state.mode===mode)drawForm();}
  };
  form.querySelector('#land-wa').onclick=e=>{if(s.busy){e.preventDefault();return;}read();if(!check()){e.preventDefault();return;}ensureReference(mode);update();};
  form.querySelector('#land-native').onclick=()=>{
   if(s.busy)return;read();if(!check())return;ensureReference(mode);
   const body=createPayload({mode,data:s.data,lang,reference:s.reference}),native=document.createElement('form');native.action=window.AGROGO_ORDERS.endpoint;native.method='POST';
   Object.entries(body).forEach(([k,v])=>{const input=document.createElement('input');input.type='hidden';input.name=k;input.value=v;native.append(input);});document.body.append(native);native.submit();
  };
  update();
 }
 function drawListings(){
  const {main,lang,wa}=current,t=k=>tr(lang,k);
  const listings=(window.AGROGO_LAND_LISTINGS||[]).filter(p=>p.published===true&&p.id&&p.title&&p.image);
  const dest=main.querySelector('#land-listing-content');
  if(!listings.length){dest.innerHTML=`<div class="land-empty">${icon}<div><h3>${t('empty')}</h3><p>${t('emptyText')}</p></div><button class="btn outline" type="button">${t('listingCta')} ↗</button></div>`;dest.querySelector('button').onclick=()=>setMode('buy',true);return;}
  const image=p=>/^assets\/[a-z0-9_./-]+$/i.test(p.image)&&!p.image.includes('..')?p.image:'assets/foncier/parcelles.jpg';
  const price=p=>Number.isFinite(p.priceMad)&&p.priceMad>0?new Intl.NumberFormat(lang==='ar'?'ar-MA':lang==='en'?'en-GB':'fr-MA').format(p.priceMad)+' MAD'+(p.priceBasis==='perHa'?' / '+t('ha'):p.priceBasis==='perSqm'?' / m²':''):t('priceOnRequest');
  dest.innerHTML=`<div class="land-listing-grid">${listings.map((p,i)=>`<article><img src="${esc(image(p))}" alt="${esc(localized(p.title,lang))}" loading="lazy"><div><small>${esc(localized(p.location,lang))}</small><h3>${esc(localized(p.title,lang))}</h3><p>${esc(p.area)} ${t(p.unit==='sqm'?'sqm':'ha')}</p><strong>${esc(price(p))}</strong><button data-land-listing="${i}" type="button">${t('details')} ↗</button></div></article>`).join('')}</div><dialog class="land-dialog"><button class="land-dialog-close" type="button" aria-label="${t('close')}">×</button><div id="land-dialog-body"></div></dialog>`;
  const dialog=dest.querySelector('dialog');dest.querySelector('.land-dialog-close').onclick=()=>dialog.close();
  dest.querySelectorAll('[data-land-listing]').forEach(b=>b.onclick=()=>{const p=listings[+b.dataset.landListing];dest.querySelector('#land-dialog-body').innerHTML=`<img src="${esc(image(p))}" alt="${esc(localized(p.title,lang))}"><span class="land-kicker">${t('sale')} · ${esc(p.id)}</span><h2>${esc(localized(p.title,lang))}</h2><p>${esc(localized(p.location,lang))} · ${esc(p.area)} ${t(p.unit==='sqm'?'sqm':'ha')}</p><strong>${esc(price(p))}</strong><p class="land-description">${esc(localized(p.description,lang))}</p><a class="btn" href="${wa('AGROGO FONCIER — '+t('interested')+'\n'+p.id+' — '+localized(p.title,lang))}" target="_blank" rel="noopener">${t('interested')} ↗</a>`;dialog.showModal();});
 }
 window.AGROGO_LAND=Object.freeze({render,teaser,createPayload,validate});
})();
