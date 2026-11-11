(function(){
'use strict';

/* =====================================================================
   CONFIGURAÇÃO — cole aqui os dois dados do seu projeto Supabase
   (Project Settings > API). Use a chave PÚBLICA (anon / publishable),
   nunca a chave secreta (service_role).
   ===================================================================== */
var CFG={
  url:'https://uqccppushebwnnqyswbi.supabase.co',
  key:'sb_publishable_8C5nzFqa7KyAMeE3SG4TDA_QaLsTQMu'
};

var BARBER={h:'733576b64b5660e56145e8f480a3acaa5c7d82e3ebffba736ecbbb68c9daafce',first:'Bryan'};

var WEEK=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
var DEFAULT_CFG={photo:'',address:'',about:'',shopName:'Barbearia',open:'09:00',close:'19:00',step:15,closedDays:[0],services:[]};

/* ---------- utilitários ---------- */
function $(s){return document.querySelector(s);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
function digits(s){return String(s||'').replace(/\D/g,'');}
function phoneKey(s){var d=digits(s);if((d.length===12||d.length===13)&&d.indexOf('55')===0)d=d.slice(2);return d;}
function isBarber(n,sn,ph){
  var t=norm(n+' '+sn)+'|'+phoneKey(ph);
  if(!(window.crypto&&crypto.subtle&&window.TextEncoder))return Promise.resolve(true);
  return crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)).then(function(b){
    var x=Array.prototype.map.call(new Uint8Array(b),function(v){return ('0'+v.toString(16)).slice(-2);}).join('');
    return x===BARBER.h;
  }).catch(function(){return true;});
}
function fmtPhone(s){
  var d=digits(s).slice(0,11);
  if(d.length<=2)return d;
  if(d.length<=6)return '('+d.slice(0,2)+') '+d.slice(2);
  if(d.length<=10)return '('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6);
  return '('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7);
}
function pad(n){return String(n).padStart(2,'0');}
function dk(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function pd(k){var p=k.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function toMin(t){var p=String(t).split(':').map(Number);return p[0]*60+p[1];}
function fromMin(m){return pad(Math.floor(m/60))+':'+pad(m%60);}
function slotKey(date,time){return date+'_'+time.replace(':','');}
function slug(s){return norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'servico';}
function rid(){return Math.random().toString(36).slice(2,6);}
var money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
function clone(o){return JSON.parse(JSON.stringify(o));}
function cmpDT(a,b){return (a.date+a.time).localeCompare(b.date+b.time);}
function dayLong(k){
  var today=dk(new Date()),tm=new Date();tm.setDate(tm.getDate()+1);
  var rel=k===today?'Hoje':(k===dk(tm)?'Amanhã':'');
  var s=pd(k).toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  return rel?rel+' · '+s:s;
}
function shortDay(k){var w=pd(k).toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');return w.charAt(0).toUpperCase()+w.slice(1)+'., '+k.split('-').reverse().join('/');}
function shortDay2(k){var w=pd(k).toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');return w+', '+k.split('-').reverse().join('/');}
function shortDate(k){return pd(k).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).replace('.','');}
function avatarInner(){var c=S.cfg;return c.photo?'<img src="'+c.photo+'" alt="">':esc(initials(c.shopName));}
function initials(n){var p=String(n||'').trim().split(/\s+/).filter(Boolean);return ((p[0]||'B')[0]+((p[1]||'')[0]||'')).toUpperCase();}
function mergeCfg(c){
  var d=clone(DEFAULT_CFG);
  if(!c||typeof c!=='object')return d;
  var okT=function(t){return /^\d\d:\d\d$/.test(String(t||''));};
  var svcs=(Array.isArray(c.services)?c.services:[]).map(function(s){
    return {id:String(s.id||slug(s.name)),name:String(s.name||'Serviço'),duration:Math.max(1,parseInt(s.duration,10)||15),price:Math.max(0,Number(s.price)||0)};
  });
  var ph=(typeof c.photo==='string'&&c.photo.length<200000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(c.photo))?c.photo:'';
  return {
    photo:ph,
    address:String(c.address||'').trim().slice(0,200),
    about:String(c.about||'').trim().slice(0,1000),
    shopName:String(c.shopName||'').trim()||d.shopName,
    open:okT(c.open)?c.open:d.open,
    close:okT(c.close)?c.close:d.close,
    step:[10,15,20,30,60].indexOf(Number(c.step))>=0?Number(c.step):d.step,
    closedDays:Array.isArray(c.closedDays)?c.closedDays.filter(function(n){return n>=0&&n<=6;}):d.closedDays,
    services:svcs
  };
}

/* ---------- ícones ---------- */
var SV='<svg viewBox="0 0 24 24" width="SZ" height="SZ" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
function ico(p,sz){return SV.replace(/SZ/g,sz||22)+p+'</svg>';}
var I={
  clock:function(s){return ico('<circle cx="12" cy="12" r="9"/><path d="M12 7v5h4"/>',s);},
  cash:function(s){return ico('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>',s);},
  cal:function(s){return ico('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>',s);},
  home:function(s){return ico('<path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5.5h4V20"/>',s);},
  pin:function(s){return ico('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/>',s);},
  user:function(s){return ico('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.2 8-6.2s8 2.2 8 6.2"/>',s);},
  check:function(s){return ico('<path d="M5 12.5l4.5 4.5L19 7.5"/>',s);}
};

/* ---------- comunicação com o Supabase ---------- */
var CONFIGURED=/^https:\/\/\S+$/.test(CFG.url)&&CFG.key&&CFG.key.indexOf('COLE_AQUI')<0;
function rpc(fn,args){
  var h={'Content-Type':'application/json','apikey':CFG.key};
  if(CFG.key.indexOf('eyJ')===0)h.Authorization='Bearer '+CFG.key;
  return fetch(CFG.url.replace(/\/+$/,'')+'/rest/v1/rpc/bb_'+fn,{method:'POST',headers:h,body:JSON.stringify(args||{})}).then(function(r){
    return r.text().then(function(t){
      var j=null;try{j=t?JSON.parse(t):null;}catch(e){}
      if(!r.ok){throw {code:String((j&&(j.message||j.error))||('http_'+r.status)),status:r.status};}
      return j;
    });
  },function(){throw {code:'rede'};});
}
var MSG={
  horario_ocupado:'Esse horário acabou de ser reservado. Escolha outro.',
  horario_invalido:'Esse horário não está mais disponível.',
  horario_bloqueado:'Esse horário não está disponível. Escolha outro.',
  dia_fechado:'A barbearia não abre nesse dia.',
  data_invalida:'Escolha uma data válida.',
  servico_invalido:'Esse serviço mudou. Atualize a página.',
  dados_invalidos:'Confira nome, sobrenome e celular.',
  nao_encontrado:'Agendamento não encontrado.',
  nao_autorizado:'Sua sessão expirou. Entre de novo.',
  rede:'Sem conexão com o servidor. Tente de novo.',
  muitas_tentativas:'Muitas senhas erradas. Aguarde 15 minutos.',
  senha_atual_incorreta:'A senha atual está incorreta.',
  senha_curta:'A senha nova precisa ter de 8 a 72 caracteres.',
  senha_fraca:'Senha fraca. Use letras e números, sem sequências ou seu nome e número.',
  muitas_requisicoes:'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  limite_agendamentos:'Você já tem 3 horários marcados. Cancele um para marcar outro.'
};
function msg(e){return MSG[e&&e.code]||'Algo deu errado. Tente de novo.';}

/* ---------- estado ---------- */
var S={
  cfg:clone(DEFAULT_CFG),cfgLoaded:false,loadErr:false,taken:new Set(),mine:[],mineLoading:false,all:[],
  view:'client',tab:'agenda',modal:null,
  identity:{name:'',surname:'',phone:''},
  phoneQuery:'',blocks:{},blkDay:null,page:null,doneB:null,sched:null,confirmId:null,draft:null,bl:null,token:null,dirty:false
};
try{var sv=JSON.parse(localStorage.getItem('barbearia.id')||'null');if(sv&&typeof sv==='object')S.identity={name:String(sv.name||''),surname:String(sv.surname||''),phone:String(sv.phone||'')};}catch(e){}
function saveIdentity(){try{localStorage.setItem('barbearia.id',JSON.stringify(S.identity));}catch(e){}}
function saveToken(t){try{if(t)sessionStorage.setItem('barbearia.tk',t);else sessionStorage.removeItem('barbearia.tk');}catch(e){}}

var toastT=null;
function toast(m){var t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show');},3800);}
function getSvc(id){return S.cfg.services.find(function(s){return s.id===id;});}

/* ---------- carregar dados ---------- */
function loadConfig(){
  return rpc('get_config').then(function(c){
    S.cfg=mergeCfg(c);S.cfgLoaded=true;S.loadErr=false;
    document.title=S.cfg.shopName;
    safeRender();refreshSched();
  }).catch(function(){S.loadErr=true;if(!S.cfgLoaded)render();});
}
function lastDay(){var n=new Date(),e=new Date(n.getFullYear(),11,31),m=new Date(n.getFullYear(),n.getMonth(),n.getDate()+30);return e>m?e:m;}
function isBlocked(k,t){var b=S.blocks[k];return !!(b&&(b.all||b.slots[t]));}
function dayBlocked(k){var b=S.blocks[k];return !!(b&&b.all);}
function loadBlocks(){
  return rpc('get_blocks',{p_from:dk(new Date()),p_to:dk(lastDay())}).then(function(rows){
    var m={};(rows||[]).forEach(function(r){var o=m[r.d]||(m[r.d]={all:false,slots:{}});if(r.t==null)o.all=true;else o.slots[r.t]=true;});
    S.blocks=m;refreshSched();if(S.view==='barber')safeRender();
  }).catch(function(){});
}
function refreshTaken(){
  var from=new Date(),to=lastDay();
  loadBlocks();
  return rpc('get_taken',{p_from:dk(from),p_to:dk(to)}).then(function(rows){
    var set=new Set();(rows||[]).forEach(function(r){set.add(slotKey(r.d,r.t));});
    S.taken=set;refreshSched();
  }).catch(function(){});
}
function loadAll(){
  if(!S.token)return Promise.resolve();
  return rpc('barber_bookings',{p_token:S.token}).then(function(arr){S.all=arr||[];safeRender();}).catch(function(e){
    if(e.code==='nao_autorizado')forceLogout();
  });
}
function barberCall(fn,args){
  args.p_token=S.token;
  return rpc(fn,args).catch(function(e){if(e.code==='nao_autorizado')forceLogout();throw e;});
}

/* ---------- tela do cliente ---------- */
function viewDone(){
  var b=S.doneB||{};
  return '<main class="donepage"><div class="okc">'+I.check(46)+'</div><h1>Agendamento concluído</h1>'+
    '<p class="t">Seu agendamento foi realizado com '+esc(BARBER.first)+' em '+esc(S.cfg.shopName)+' '+esc(shortDay2(b.date))+' às '+esc(b.time)+'h</p>'+
    '<button class="pbtn go" data-act="home">Novo agendamento</button>'+
    '<button class="pbtn gr" data-act="mine-page">Ver os meus agendamentos</button></main>';
}
function viewMine(){
  var today=dk(new Date()),ini=initials(S.cfg.shopName);
  var up=S.mine.filter(function(b){return b.status!=='concluido'&&b.date>=today;}).sort(cmpDT);
  var past=S.mine.filter(function(b){return !(b.status!=='concluido'&&b.date>=today);}).sort(function(a,b){return cmpDT(b,a);});
  var list=up.concat(past),body;
  if(S.mineLoading)body='<p class="empty">Buscando seus horários…</p>';
  else if(!list.length)body='<p class="empty">Nenhum agendamento encontrado para este número.</p>';
  else body='<ul class="mcards">'+list.map(function(b){
    var ag=b.status!=='concluido'&&b.date>=today,act='';
    if(ag)act=S.confirmId===b.id?
      '<div class="qrow"><span class="q">Cancelar?</span><button class="btn-danger sm" data-act="cancel-yes" data-id="'+esc(b.id)+'">Sim</button><button class="btn-ghost sm" data-act="cancel-no">Não</button></div>':
      '<button class="trash" aria-label="Cancelar agendamento" data-act="cancel-mine" data-id="'+esc(b.id)+'"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>';
    return '<li class="mc'+(ag?' ag':'')+'"><div class="av" aria-hidden="true">'+avatarInner()+'</div><div class="tx"><span>'+esc(b.serviceName)+'</span><span>'+esc(shortDay(b.date))+' às '+esc(b.time)+'</span><span class="pr">'+I.cash(22)+'a partir de '+money.format(Number(b.price)||0)+'</span></div><span class="st">'+(ag?'AGENDADO':'FINALIZADO')+'</span>'+act+'</li>';
  }).join('')+'</ul>';
  return '<main class="minepage"><div class="mhead"><h1>Meus agendamentos</h1><button class="pbtn go" data-act="home">Novo agendamento</button></div>'+body+'</main>';
}
function navHtml(){
  var cur=S.page==='address'?'address':(S.page==='about'?'about':'home');
  var items=[['home','Início',I.home],['address','Endereço',I.pin],['about','Barbeiro',I.user]];
  return '<div class="glass-bar">'+items.map(function(i){
    return '<button type="button" class="gbtn" data-act="nav" data-p="'+i[0]+'"'+(cur===i[0]?' aria-current="page"':'')+'>'+i[2](26)+'<span>'+i[1]+'</span></button>';
  }).join('')+'</div>';
}
function viewAddress(){
  var c=S.cfg,has=!!c.address,closed=c.closedDays.map(function(d){return WEEK[d];});
  return '<main class="wrap"><h1>Endereço</h1><div class="gcard" style="margin-top:22px"><div class="pin">'+I.pin(30)+'</div>'+
    '<p class="addr">'+(has?esc(c.address):'O endereço ainda não foi cadastrado.')+'</p>'+
    (has?'<a class="btn-ok map" target="_blank" rel="noopener noreferrer" href="'+esc('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(c.address))+'">Abrir no mapa</a>':'')+
    '<p class="hours" style="margin-top:18px">Atendimento das '+esc(c.open)+' às '+esc(c.close)+(closed.length?' · fechado: '+closed.join(', '):'')+'</p></div></main>';
}
function viewAbout(){
  var c=S.cfg;
  return '<main class="wrap"><section class="hello"><div class="avatar" aria-hidden="true">'+avatarInner()+'</div><div><p class="eyebrow">Conheça o barbeiro</p><h1>'+esc(BARBER.first)+'</h1></div></section>'+
    '<div class="gcard" style="margin-top:24px"><p class="about">'+(c.about?esc(c.about):'Em breve você vai conhecer mais sobre o barbeiro.')+'</p></div></main>';
}
function viewClient(){
  var c=S.cfg;
  if(S.page==='address'&&S.cfgLoaded)return viewAddress();
  if(S.page==='about'&&S.cfgLoaded)return viewAbout();
  if(S.page==='done'&&S.cfgLoaded)return viewDone();
  if(S.page==='mine'&&S.cfgLoaded)return viewMine();
  if(!CONFIGURED){
    return '<main class="wrap"><h1>Falta conectar o Supabase</h1><p class="notice">Abra o arquivo index.html, procure por CONFIGURAÇÃO no começo do script e cole a URL e a chave pública do seu projeto.</p></main>';
  }
  if(!S.cfgLoaded){
    return '<main class="wrap">'+(S.loadErr?'<p class="notice bad">Não foi possível carregar a barbearia. Confira a conexão e se o arquivo supabase.sql foi executado.</p><p style="margin-top:14px"><button class="btn-ghost sm" data-act="retry">Tentar de novo</button></p>':'<p class="loading">Carregando…</p>')+'</main>';
  }
  var closed=c.closedDays.map(function(d){return WEEK[d];});
  var items=c.services.map(function(s){
    return '<li><div class="svc"><h3>'+esc(s.name)+'</h3>'+
      '<p class="meta">'+I.clock(22)+'<span>'+pad(s.duration)+'min</span></p>'+
      '<p class="meta">'+I.cash(22)+'<span>a partir de '+money.format(s.price)+'</span></p></div>'+
      '<button class="btn-res" data-act="book" data-id="'+esc(s.id)+'">'+I.cal(24)+'Reservar</button></li>';
  }).join('');
  return '<header class="top"><span class="wordmark">'+esc(c.shopName)+'</span><button class="tab-btn" data-act="mine">Meus agendamentos</button></header>'+
    '<main class="wrap"><section class="hello"><div class="avatar" aria-hidden="true">'+avatarInner()+'</div>'+
    '<div><p class="eyebrow">Seja bem-vindo(a) ao</p><h1>'+esc(c.shopName)+'</h1></div></section>'+
    '<h2 class="sect">Serviços</h2><ul class="services">'+(items||'<li><p class="empty">Nenhum serviço cadastrado.</p></li>')+'</ul>'+
    '<p class="hours">Atendimento das '+esc(c.open)+' às '+esc(c.close)+(closed.length?' · fechado: '+closed.join(', '):'')+'</p></main>';
}

/* ---------- painel do barbeiro ---------- */
function doneKey(b){return b.doneAt?dk(new Date(b.doneAt)):b.date;}
function periodRevenue(list){
  var now=new Date(),today=dk(now),dow=(now.getDay()+6)%7;
  var mon=new Date(now.getFullYear(),now.getMonth(),now.getDate()-dow);
  var sun=new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+6);
  var wk0=dk(mon),wk1=dk(sun),ym=today.slice(0,7);
  var out={day:{v:0,n:0},week:{v:0,n:0},month:{v:0,n:0},per:{},last7:[],wk0:wk0,wk1:wk1};
  var idx={};
  for(var i=6;i>=0;i--){var d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i);var k=dk(d);idx[k]=out.last7.length;out.last7.push({k:k,v:0,today:k===today});}
  list.forEach(function(b){
    if(b.status!=='concluido')return;
    var k=doneKey(b),v=Number(b.price)||0;
    if(k===today){out.day.v+=v;out.day.n++;}
    if(k>=wk0&&k<=wk1){out.week.v+=v;out.week.n++;}
    if(k.slice(0,7)===ym){
      out.month.v+=v;out.month.n++;
      var p=out.per[b.serviceName]||(out.per[b.serviceName]={n:0,v:0});p.n++;p.v+=v;
    }
    if(idx[k]!==undefined)out.last7[idx[k]].v+=v;
  });
  return out;
}
function brl0(v){return v%1===0?String(v):v.toFixed(2).replace('.',',');}

function bookingRow(b,mode){
  var wa='https://wa.me/55'+phoneKey(b.phone);
  var wam=wa+'?text='+encodeURIComponent('Olá, '+b.name+'! Aqui é da '+S.cfg.shopName+'. Sobre o seu horário de '+dayLong(b.date)+' às '+b.time+': ');
  var wbtn='<a class="btn-wa sm" href="'+esc(wam)+'" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-1.500-.700-2.400-1.300-3.400-3-.3-.4.2-.4.700-1.300.1-.2 0-.3 0-.5l-.8-1.900c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.300-.2.300-.9.900-.9 2.200s.9 2.500 1.100 2.700c.1.200 1.800 2.800 4.400 3.900 1.600.7 2.300.7 3.100.6.500-.1 1.500-.6 1.700-1.200.2-.6.2-1.100.2-1.200-.1-.1-.2-.2-.5-.3z"/></svg>WhatsApp</a>';
  var acts;
  if(S.confirmId===b.id){
    acts='<span class="q">Remover este atendimento?</span><button class="btn-danger sm" data-act="rm-yes" data-id="'+esc(b.id)+'">Sim, remover</button><button class="btn-ghost sm" data-act="rm-no">Não</button>';
  }else if(mode==='pending'){
    acts='<button class="btn-ok sm" data-act="done" data-id="'+esc(b.id)+'">Concluir</button><button class="btn-ghost sm" data-act="rm" data-id="'+esc(b.id)+'">Remover</button>'+wbtn;
  }else{
    acts='<button class="btn-ghost sm" data-act="undo" data-id="'+esc(b.id)+'">Desfazer</button><button class="btn-ghost sm" data-act="rm" data-id="'+esc(b.id)+'">Remover</button>'+wbtn;
  }
  var when=mode==='pending'?esc(b.time):esc(shortDate(b.date));
  return '<li class="bk"><div class="time">'+when+'</div><div class="who"><strong>'+esc(b.name)+' '+esc(b.surname)+'</strong>'+
    '<span>'+esc(b.serviceName)+' · '+money.format(Number(b.price)||0)+(mode==='done'?' · '+esc(b.time):'')+' · <a href="'+esc(wa)+'" target="_blank" rel="noopener">'+esc(fmtPhone(b.phone))+'</a></span></div>'+
    '<div class="acts">'+acts+'</div></li>';
}
function agendaHtml(){
  var today=dk(new Date());
  var list=S.all.filter(function(b){return b.status!=='concluido';}).sort(cmpDT);
  if(!list.length)return '<p class="empty">Nenhum agendamento pendente.</p>';
  var groups=[];
  list.forEach(function(b){
    var key=b.date<today?'late':b.date;
    var g=groups.find(function(x){return x.key===key;});
    if(!g){g={key:key,items:[]};groups.push(g);}
    g.items.push(b);
  });
  return groups.map(function(g){
    var head=g.key==='late'?'<p class="gh late">Atrasados · conclua ou remova</p>':'<p class="gh">'+esc(dayLong(g.key))+'</p>';
    return head+'<ul class="bks">'+g.items.map(function(b){return bookingRow(b,'pending');}).join('')+'</ul>';
  }).join('');
}
function doneHtml(){
  var list=S.all.filter(function(b){return b.status==='concluido';}).sort(function(a,b){return String(b.doneAt||b.date).localeCompare(String(a.doneAt||a.date));});
  if(!list.length)return '<p class="empty">Nenhum atendimento concluído ainda.</p>';
  return '<ul class="bks" style="margin-top:20px">'+list.slice(0,80).map(function(b){return bookingRow(b,'done');}).join('')+'</ul>';
}
function settingsHtml(){
  if(!S.draft)S.draft=clone(S.cfg);
  var d=S.draft;
  var steps=[10,15,20,30,60].map(function(n){return '<option value="'+n+'"'+(Number(d.step)===n?' selected':'')+'>'+n+' min</option>';}).join('');
  var days=WEEK.map(function(w,i){return '<button type="button" data-act="toggle-day" data-d="'+i+'" aria-pressed="'+(d.closedDays.indexOf(i)>=0)+'">'+w+'</button>';}).join('');
  var rows=d.services.map(function(s,i){
    return '<div class="srow"><div class="nm"><label for="sn'+i+'">Nome</label><input id="sn'+i+'" type="text" data-f="svc" data-i="'+i+'" data-k="name" value="'+esc(s.name)+'"></div>'+
      '<div><label for="sd'+i+'">Minutos</label><input id="sd'+i+'" type="number" min="1" inputmode="numeric" data-f="svc" data-i="'+i+'" data-k="duration" value="'+esc(s.duration)+'"></div>'+
      '<div><label for="sp'+i+'">Preço (R$)</label><input id="sp'+i+'" type="text" inputmode="decimal" data-f="svc" data-i="'+i+'" data-k="price" value="'+esc(String(s.price).replace('.',','))+'"></div>'+
      '<button type="button" class="btn-ghost sm" data-act="del-svc" data-i="'+i+'">Excluir</button></div>';
  }).join('');
  var prev=d.photo?'<img src="'+d.photo+'" alt="">':esc(initials(d.shopName));
  return '<div class="cfg" style="margin-top:22px">'+
    '<div class="card"><h3>Foto da barbearia</h3><div class="photo-row"><div class="photo-prev">'+prev+'</div><div class="stack">'+
      '<p style="font-size:14px;color:var(--muted)">Aparece na página inicial e nos agendamentos do cliente. Escolha uma foto do celular ou do computador. Ela é ajustada e salva na hora.</p>'+
      '<div class="acts" style="justify-content:flex-start"><label class="btn-ok sm filebtn"><input type="file" id="photo-in" accept="image/*">Trocar foto</label>'+(d.photo?'<button type="button" class="btn-ghost sm" data-act="photo-del">Remover foto</button>':'')+'</div></div></div></div>'+
    '<div class="card"><h3>Endereço e sobre o barbeiro</h3><div class="stack">'+
      '<div><label for="c-addr">Endereço da barbearia</label><input id="c-addr" type="text" maxlength="200" placeholder="Rua, número, bairro, cidade" data-f="address" value="'+esc(d.address||'')+'"></div>'+
      '<div><label for="c-about">Descrição do barbeiro</label><textarea id="c-about" maxlength="1000" placeholder="Conte quem você é, sua experiência, o estilo de corte..." data-f="about">'+esc(d.about||'')+'</textarea></div>'+
      '<p style="font-size:14px;color:var(--muted)">Aparecem nos botões Endereço e Barbeiro, na barra de baixo do site. Depois de editar, toque em Salvar alterações.</p></div></div>'+
    '<div class="card"><h3>Barbearia</h3><div class="grid2">'+
      '<div><label for="c-name">Nome</label><input id="c-name" type="text" data-f="shopName" value="'+esc(d.shopName)+'"></div>'+
      '<div><label for="c-open">Abre</label><input id="c-open" type="time" data-f="open" value="'+esc(d.open)+'"></div>'+
      '<div><label for="c-close">Fecha</label><input id="c-close" type="time" data-f="close" value="'+esc(d.close)+'"></div>'+
      '<div><label for="c-step">Intervalo dos horários</label><select id="c-step" data-f="step">'+steps+'</select></div></div>'+
      '<p class="lbl">Dias fechados</p><div class="daytog">'+days+'</div></div>'+
    '<div class="card"><h3>Serviços e preços</h3><div class="shead"><span>Nome</span><span>Minutos</span><span>Preço</span><span></span></div><div class="stack">'+rows+'</div>'+
      '<div style="margin-top:14px"><button type="button" class="btn-ghost sm" data-act="add-svc">Adicionar serviço</button></div></div>'+
    '<div><button type="button" class="btn-ok" data-act="save-cfg">Salvar alterações</button></div>'+
    '<div class="card"><h3>Senha do painel</h3><div class="grid2">'+
      '<div><label for="pw-old">Senha atual</label><input id="pw-old" type="password" autocomplete="current-password"></div>'+
      '<div><label for="pw-new">Senha nova (8+ caracteres, letras e números)</label><input id="pw-new" type="password" autocomplete="new-password"></div></div>'+
      '<div style="margin-top:14px"><button type="button" class="btn-ghost sm" data-act="change-pw">Trocar senha</button></div></div></div>';
}
function blockDays(){
  var out=[],now=new Date(),end=lastDay();
  for(var i=0;i<400;i++){
    var d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i);
    if(d>end)break;
    if(S.cfg.closedDays.indexOf(d.getDay())>=0)continue;
    out.push(dk(d));
  }
  return out;
}
function blockHtml(){
  var c=S.cfg,days=blockDays();
  if(!days.length)return '<p class="empty">Sem dias abertos pela frente.</p>';
  if(!S.blkDay||days.indexOf(S.blkDay)<0)S.blkDay=days[0];
  var k=S.blkDay,b=S.blocks[k]||{all:false,slots:{}};
  var chips=days.map(function(x){
    var d=pd(x),bx=S.blocks[x],has=!!(bx&&(bx.all||Object.keys(bx.slots).length));
    return '<button type="button" class="day" data-act="blk-day" data-k="'+x+'" aria-pressed="'+(x===k)+'"><small>'+esc(d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''))+'</small><b>'+d.getDate()+'</b><small>'+esc(d.toLocaleDateString('pt-BR',{month:'short'}).replace('.',''))+'</small>'+(has?'<i class="dot"></i>':'')+'</button>';
  }).join('');
  var booked={},nb=0;
  S.all.forEach(function(a){if(a.date===k){booked[a.time]=a;nb++;}});
  var open=toMin(c.open),close=toMin(c.close),step=Number(c.step)||15,cells=[],nblk=0;
  for(var t=open;t+step<=close;t+=step){
    var time=fromMin(t),bk=booked[time];
    if(bk)cells.push('<button type="button" class="slot bkd" disabled title="'+esc(bk.name+' '+bk.surname)+'">'+time+'</button>');
    else if(b.all||b.slots[time]){nblk++;cells.push('<button type="button" class="slot blk" data-act="blk-slot" data-t="'+time+'" aria-pressed="true">'+time+'</button>');}
    else cells.push('<button type="button" class="slot" data-act="blk-slot" data-t="'+time+'" aria-pressed="false">'+time+'</button>');
  }
  var top=b.all?
    '<div class="alert bad"><b>O dia inteiro está bloqueado.</b> Os clientes não conseguem marcar nada em '+esc(dayLong(k))+'.</div>':
    (nblk?'<div class="alert">'+nblk+(nblk===1?' horário bloqueado':' horários bloqueados')+' em '+esc(dayLong(k))+'.</div>':'');
  var warn=(nb&&(b.all||nblk))?'<div class="alert">Atenção: este dia já tem '+nb+(nb===1?' cliente agendado':' clientes agendados')+'. O bloqueio não cancela quem já marcou. Veja na aba Agenda e avise essas pessoas.</div>':'';
  return '<div style="margin-top:22px"><div class="help"><b>Como funciona:</b> 1) escolha o dia abaixo. 2) Toque nos horários que você <b>não vai atender</b>: eles ficam vermelhos e somem para os clientes. 3) Toque de novo para liberar. Serve para feriados, compromissos e folgas. Pontinho vermelho no dia = tem bloqueio.</div>'+
    '<p class="lbl">1. Escolha o dia</p><div class="days">'+chips+'</div>'+
    '<p class="lbl">2. Toque nos horários</p>'+
    '<div class="blkbar">'+(b.all?'<button type="button" class="btn-ok sm" data-act="blk-all" data-v="0">Liberar o dia inteiro</button>':'<button type="button" class="btn-danger sm" data-act="blk-all" data-v="1">Bloquear o dia inteiro</button>')+'</div>'+
    top+warn+
    '<div class="slots" style="margin-top:14px">'+cells.join('')+'</div>'+
    '<div class="legend"><span><i></i>Livre</span><span><i class="r"></i>Bloqueado</span><span><i class="g"></i>Cliente agendado</span></div></div>';
}
function setBlock(day,slot,blocked){
  var o=S.blocks[day]||(S.blocks[day]={all:false,slots:{}});
  if(slot==null)o.all=blocked;else{if(blocked)o.slots[slot]=true;else delete o.slots[slot];}
  render();
  barberCall('barber_set_block',{p_day:day,p_slot:slot==null?null:slot,p_blocked:blocked}).catch(function(e){toast(msg(e));}).then(loadBlocks);
}
function viewBarber(){
  var r=periodRevenue(S.all),c=S.cfg;
  var pend=S.all.filter(function(b){return b.status!=='concluido';}).length;
  var tiles=[['Hoje',r.day,dayLong(dk(new Date()))],['Esta semana',r.week,shortDate(r.wk0)+' a '+shortDate(r.wk1)],['Este mês',r.month,pd(dk(new Date())).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})]].map(function(t){
    var n=t[1].n;
    return '<div class="tile"><p class="tl">'+t[0]+'</p><p class="tv">'+money.format(t[1].v)+'</p><p class="ts">'+n+(n===1?' atendimento concluído':' atendimentos concluídos')+'</p></div>';
  }).join('');
  var max=Math.max.apply(null,r.last7.map(function(x){return x.v;}).concat([1]));
  var bars=r.last7.map(function(x){
    var h=x.v>0?Math.max(6,Math.round(x.v/max*100)):0;
    var wd=pd(x.k).toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');
    return '<div class="bar'+(x.today?' today':'')+'" title="'+esc(shortDate(x.k)+': '+money.format(x.v))+'"><span class="val">'+(x.v>0?brl0(x.v):'')+'</span><div class="box"><div class="col" style="height:'+h+'%"></div></div><span class="d">'+esc(wd)+'</span></div>';
  }).join('');
  var per=Object.keys(r.per).map(function(k){return {name:k,n:r.per[k].n,v:r.per[k].v};}).sort(function(a,b){return b.v-a.v;});
  var pmax=Math.max.apply(null,per.map(function(x){return x.v;}).concat([1]));
  var perHtml=per.length?'<div class="sv">'+per.map(function(x){
    return '<div><div class="top2"><span>'+esc(x.name)+' <span style="color:var(--muted)">· '+x.n+'x</span></span><span class="nums">'+money.format(x.v)+'</span></div><div class="track"><div class="fill" style="width:'+Math.round(x.v/pmax*100)+'%"></div></div></div>';
  }).join('')+'</div>':'<p class="empty" style="padding:10px 0">Sem atendimentos concluídos neste mês.</p>';
  var body=S.tab==='agenda'?agendaHtml():(S.tab==='concluidos'?doneHtml():(S.tab==='bloqueios'?blockHtml():settingsHtml()));
  var tabs=[['agenda','Agenda ('+pend+')'],['concluidos','Concluídos'],['bloqueios','Bloqueios'],['ajustes','Ajustes']].map(function(t){
    return '<button type="button" role="tab" data-act="tab" data-tab="'+t[0]+'" aria-selected="'+(S.tab===t[0])+'">'+t[1]+'</button>';
  }).join('');
  return '<header class="top"><span class="wordmark">'+esc(c.shopName)+'</span><button class="tab-btn" data-act="logout">Sair</button></header>'+
    '<main class="panel"><div class="ph"><h1>Painel do barbeiro</h1><p>Olá, '+esc(BARBER.first)+'. O faturamento soma só o que você marcou como concluído.</p></div>'+
    '<div class="tiles">'+tiles+'</div>'+
    '<div class="cols"><div class="card"><h3>Últimos 7 dias (R$)</h3><div class="bars">'+bars+'</div></div>'+
    '<div class="card"><h3>Por serviço neste mês</h3>'+perHtml+'</div></div>'+
    '<div class="tabs" role="tablist">'+tabs+'</div>'+body+'</main>';
}

function render(){
  S.dirty=false;
  $('#app').innerHTML=S.view==='barber'?viewBarber():viewClient();
  var show=S.view!=='barber'&&CONFIGURED&&S.cfgLoaded;
  $('#nav').innerHTML=show?navHtml():'';
  document.body.classList.toggle('has-nav',show);
}
function safeRender(){
  var a=document.activeElement;
  if(a&&a.matches&&a.matches('#app input, #app select, #app textarea')){S.dirty=true;return;}
  render();
}

/* ---------- modais ---------- */
function card(title,body,foot,wide,oneBtn){
  return '<div class="overlay" data-act="overlay"><div class="sheet'+(wide?' wide':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(title)+'">'+
    '<div class="sh-head"><h2>'+esc(title)+'</h2><button class="x" data-act="close" aria-label="Fechar">&times;</button></div>'+
    '<div class="sh-body">'+body+'</div><div class="sh-foot'+(oneBtn?' one':'')+'">'+foot+'</div></div></div>';
}
function mIdentity(){
  var id=S.identity;
  var body='<p class="lead">Por favor, escreva seu nome e o número do celular usado para agendar o serviço.</p>'+
    '<label for="f-name">Nome</label><input id="f-name" type="text" autocomplete="given-name" placeholder="Digite seu nome" value="'+esc(id.name)+'">'+
    '<label for="f-surname">Sobrenome</label><input id="f-surname" type="text" autocomplete="family-name" placeholder="Digite seu sobrenome" value="'+esc(id.surname)+'">'+
    '<label for="f-phone">Celular (WhatsApp)</label><input id="f-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="Digite seu celular" value="'+esc(fmtPhone(id.phone))+'">'+
    '<p class="err" id="err" role="alert"></p>';
  return card('Confirme seus dados',body,'<button class="btn-grey" data-act="close">Voltar</button><button class="btn-ok" data-act="identity-ok">Confirmar</button>');
}
function mPassword(){
  var body='<p class="lead">Olá, '+esc(S.bl.name)+'. Digite a senha do painel do barbeiro.</p>'+
    '<label for="f-pass">Senha</label><input id="f-pass" type="password" autocomplete="current-password" placeholder="Digite a senha">'+
    '<p class="err" id="err" role="alert"></p>';
  return card('Área do barbeiro',body,'<button class="btn-grey" data-act="back-id">Voltar</button><button class="btn-ok" id="pass-btn" data-act="pass-ok">Entrar</button>');
}
function mPhone(){
  var body='<p class="lead">Por favor, escreva o número do celular usado para agendar o serviço.</p>'+
    '<label for="f-phone">Celular (WhatsApp)</label><input id="f-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="Digite seu celular" value="'+esc(fmtPhone(S.identity.phone))+'">'+
    '<p class="err" id="err" role="alert"></p>';
  return card('Confirme o seu número',body,'<button class="btn-grey" data-act="close">Voltar</button><button class="btn-ok" data-act="phone-ok">Confirmar</button>');
}
function mineHtml(){
  if(S.mineLoading)return '<p class="empty">Buscando seus horários…</p>';
  var today=dk(new Date());
  var up=S.mine.filter(function(b){return b.status!=='concluido'&&b.date>=today;}).sort(cmpDT);
  var past=S.mine.filter(function(b){return !(b.status!=='concluido'&&b.date>=today);}).sort(function(a,b){return cmpDT(b,a);});
  var list=up.concat(past);
  if(!list.length)return '<p class="empty">Nenhum agendamento encontrado para este número.</p>';
  return '<ul class="mine">'+list.map(function(b){
    var canCancel=b.status!=='concluido'&&b.date>=today;
    var acts='';
    if(canCancel){
      acts=S.confirmId===b.id?
        '<div class="row-acts"><span class="q">Cancelar este horário?</span><button class="btn-danger sm" data-act="cancel-yes" data-id="'+esc(b.id)+'">Sim, cancelar</button><button class="btn-ghost sm" data-act="cancel-no">Não</button></div>':
        '<div class="row-acts"><button class="btn-ghost sm" data-act="cancel-mine" data-id="'+esc(b.id)+'">Cancelar</button></div>';
    }
    return '<li><div class="r1"><strong>'+esc(b.serviceName)+'</strong><span class="badge'+(b.status==='concluido'?' done':'')+'">'+(b.status==='concluido'?'Concluído':'Agendado')+'</span></div>'+
      '<span style="color:var(--muted)">'+esc(dayLong(b.date))+' às '+esc(b.time)+' · '+money.format(Number(b.price)||0)+'</span>'+acts+'</li>';
  }).join('')+'</ul>';
}
function mMine(){return card('Meus agendamentos','<div id="mine-body">'+mineHtml()+'</div>','<button class="btn-grey" data-act="close">Fechar</button>',false,true);}

function schedDays(){
  var out=[],now=new Date(),end=lastDay();
  for(var i=0;i<400;i++){
    var d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i);
    if(d>end)break;
    if(S.cfg.closedDays.indexOf(d.getDay())>=0)continue;
    if(i===0&&now.getHours()*60+now.getMinutes()>=toMin(S.cfg.close)-(Number(S.cfg.step)||15))continue;
    out.push(dk(d));
  }
  return out;
}
function daysHtml(){
  return schedDays().map(function(k){
    var d=pd(k);
    return '<button type="button" class="day" data-act="day" data-k="'+k+'" aria-pressed="'+(S.sched.date===k)+'"'+(dayBlocked(k)?' disabled title="Sem atendimento neste dia"':'')+'><small>'+esc(d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''))+'</small><b>'+d.getDate()+'</b><small>'+esc(d.toLocaleDateString('pt-BR',{month:'short'}).replace('.',''))+'</small></button>';
  }).join('');
}
function slotsHtml(){
  var c=S.cfg,date=S.sched.date,now=new Date();
  var isToday=date===dk(now),nowMin=now.getHours()*60+now.getMinutes();
  var open=toMin(c.open),close=toMin(c.close),step=Number(c.step)||15;
  var groups={'Manhã':[],'Tarde':[],'Noite':[]},free=0;
  if(S.sched.time&&(S.taken.has(slotKey(date,S.sched.time))||isBlocked(date,S.sched.time)))S.sched.time=null;
  for(var t=open;t+step<=close;t+=step){
    var time=fromMin(t),off=S.taken.has(slotKey(date,time))||isBlocked(date,time)||(isToday&&t<=nowMin);
    if(off)continue;
    free++;
    var g=t<720?'Manhã':(t<1080?'Tarde':'Noite');
    groups[g].push('<button type="button" class="slot" data-act="pick" data-t="'+time+'" aria-pressed="'+(S.sched.time===time)+'">'+time+'</button>');
  }
  if(!free)return '<p class="empty">Sem horários livres neste dia. Escolha outro dia.</p>';
  return Object.keys(groups).filter(function(k){return groups[k].length;}).map(function(k){
    return '<p class="per">'+k+'</p><div class="slots">'+groups[k].join('')+'</div>';
  }).join('');
}
function mSchedule(){
  var svc=getSvc(S.sched.serviceId);
  var body='<div class="summary"><strong>'+esc(svc.name)+'</strong><span>'+pad(svc.duration)+'min · '+money.format(svc.price)+'</span></div>'+
    '<p class="lbl">Dia</p><div class="days" id="days">'+daysHtml()+'</div><p class="lbl">Horário</p><div id="slots">'+slotsHtml()+'</div>';
  return card('Escolha o horário',body,'<button class="btn-grey" data-act="back-id">Voltar</button><button class="btn-ok" id="sched-ok" data-act="sched-ok" disabled>Agendar</button>',true);
}
function refreshSched(){
  if(!S.modal||S.modal.type!=='schedule')return;
  var d=$('#days'),s=$('#slots'),b=$('#sched-ok');
  if(!d||!s||!b)return;
  d.innerHTML=daysHtml();s.innerHTML=slotsHtml();
  b.disabled=!S.sched.time;b.textContent=S.sched.time?'Agendar às '+S.sched.time:'Agendar';
}
function mDone(m){
  var b=m.b;
  var body='<div class="center"><div class="okmark">'+I.check(34)+'</div><h3>Agendamento confirmado</h3>'+
    '<p>'+esc(b.serviceName)+' · '+money.format(Number(b.price)||0)+'</p><p style="color:var(--muted)">'+esc(dayLong(b.date))+' às '+esc(b.time)+'</p>'+
    '<p style="color:var(--muted);margin-top:14px;font-size:14px">Para cancelar, use Meus agendamentos.</p></div>';
  return card('Tudo certo, '+b.name,body,'<button class="btn-ok" data-act="close">Fechar</button>',false,true);
}
function modalHtml(m){
  if(m.type==='identity')return mIdentity();
  if(m.type==='password')return mPassword();
  if(m.type==='phone')return mPhone();
  if(m.type==='mine')return mMine();
  if(m.type==='schedule')return mSchedule();
  if(m.type==='done')return mDone(m);
  return '';
}
function openModal(m){
  S.modal=m;S.confirmId=null;
  $('#modal').innerHTML=modalHtml(m);
  if(m.type==='schedule')refreshSched();
  setTimeout(function(){var i=$('#modal input');if(i)i.focus();},30);
}
function closeModal(){S.modal=null;S.confirmId=null;$('#modal').innerHTML='';}
function refreshMine(){if(S.page==='mine')render();}

/* ---------- fluxos ---------- */
function val(id){var e=$('#'+id);return e?e.value.trim():'';}
function setErr(m){var e=$('#err');if(e)e.textContent=m;}
function enterBarber(){
  S.view='barber';S.tab='agenda';S.draft=null;S.confirmId=null;S.all=[];
  render();window.scrollTo(0,0);loadAll();
}
function leaveBarber(){
  S.view='client';S.page=null;S.all=[];S.token=null;saveToken(null);S.confirmId=null;S.draft=null;
  render();window.scrollTo(0,0);
}
function forceLogout(){if(S.view==='barber'){leaveBarber();toast(MSG.nao_autorizado);}}
function firstDate(){var a=schedDays();return a.filter(function(k){return !dayBlocked(k);})[0]||a[0];}

function onIdentityOk(){
  var n=val('f-name'),sn=val('f-surname'),ph=val('f-phone'),m=S.modal;
  if(n.length<2)return setErr('Escreva seu nome.');
  if(sn.length<2)return setErr('Escreva seu sobrenome.');
  var d=phoneKey(ph);
  if(d.length<10||d.length>11)return setErr('Escreva o celular com DDD, por exemplo (16) 99999-9999.');
  isBarber(n,sn,ph).then(function(yes){
    if(yes){
      S.bl={name:n,surname:sn,phone:d,serviceId:m.serviceId};
      openModal({type:'password'});return;
    }
    S.identity={name:n,surname:sn,phone:d};saveIdentity();
    S.sched={serviceId:m.serviceId,date:firstDate(),time:null};
    openModal({type:'schedule'});
    refreshTaken();
  });
}
function onPassOk(){
  var pw=$('#f-pass')?$('#f-pass').value:'';
  if(!pw)return setErr('Digite a senha.');
  var btn=$('#pass-btn');if(btn){btn.disabled=true;btn.textContent='Entrando…';}
  rpc('barber_login',{p_name:S.bl.name,p_surname:S.bl.surname,p_phone:S.bl.phone,p_password:pw}).then(function(r){
    if(r&&r.ok&&r.token){S.token=r.token;saveToken(r.token);S.bl=null;closeModal();enterBarber();}
    else{setErr(r&&r.error==='muitas_tentativas'?MSG.muitas_tentativas:'Dados ou senha incorretos.');if(btn){btn.disabled=false;btn.textContent='Entrar';}var f=$('#f-pass');if(f){f.value='';f.focus();}}
  }).catch(function(e){setErr(msg(e));if(btn){btn.disabled=false;btn.textContent='Entrar';}});
}
function onPhoneOk(){
  var d=phoneKey(val('f-phone'));
  if(d.length<10||d.length>11)return setErr('Escreva o celular com DDD, por exemplo (16) 99999-9999.');
  S.phoneQuery=d;S.mine=[];S.mineLoading=true;
  closeModal();S.page='mine';window.scrollTo(0,0);render();
  rpc('my_bookings',{p_phone:d}).then(function(arr){S.mine=arr||[];}).catch(function(e){S.mine=[];toast(msg(e));}).then(function(){S.mineLoading=false;refreshMine();});
}
function doBook(){
  var svc=getSvc(S.sched.serviceId),id=S.identity,s=S.sched;
  if(!svc||!s.time)return;
  var btn=$('#sched-ok');if(btn){btn.disabled=true;btn.textContent='Agendando…';}
  rpc('create_booking',{p_name:id.name,p_surname:id.surname,p_phone:id.phone,p_service_id:svc.id,p_date:s.date,p_time:s.time}).then(function(b){
    S.taken.add(slotKey(b.date,b.time));
    closeModal();S.doneB=b;S.page='done';window.scrollTo(0,0);render();
  }).catch(function(e){
    toast(msg(e));
    if(e.code==='horario_ocupado'||e.code==='horario_invalido'||e.code==='horario_bloqueado')S.sched.time=null;
    refreshSched();refreshTaken();
  });
}
function findBooking(list,id){return list.find(function(b){return b.id===id;});}

function saveConfig(){
  var d=S.draft;if(!d)return;
  var svcs=d.services.map(function(s){return {id:s.id||slug(s.name)+'-'+rid(),name:String(s.name||'').trim(),duration:Math.max(0,parseInt(s.duration,10)||0),price:Math.max(0,Number(s.price)||0)};});
  if(!String(d.shopName||'').trim())return toast('Escreva o nome da barbearia.');
  if(!svcs.length)return toast('Cadastre pelo menos um serviço.');
  if(svcs.some(function(s){return !s.name||s.duration<1;}))return toast('Todo serviço precisa de nome e de minutos.');
  if(toMin(d.open)>=toMin(d.close))return toast('O horário de abertura precisa ser antes do fechamento.');
  var clean={photo:d.photo||'',address:String(d.address||'').trim().slice(0,200),about:String(d.about||'').trim().slice(0,1000),shopName:String(d.shopName).trim(),open:d.open,close:d.close,step:Number(d.step)||15,closedDays:d.closedDays.slice(),services:svcs};
  barberCall('barber_save_config',{p_config:clean}).then(function(){S.cfg=mergeCfg(clean);document.title=S.cfg.shopName;S.draft=null;toast('Alterações salvas.');render();}).catch(function(e){toast(msg(e));});
}
function changePw(){
  var o=$('#pw-old'),n=$('#pw-new');
  if(!o||!n||!o.value||!n.value)return toast('Preencha a senha atual e a nova.');
  barberCall('barber_change_password',{p_old:o.value,p_new:n.value}).then(function(r){if(r&&r.ok===false)return toast(MSG[r.error]||'Não foi possível trocar a senha.');o.value='';n.value='';toast('Senha trocada. As outras sessões foram encerradas.');}).catch(function(e){toast(msg(e));});
}

/* ---------- eventos ---------- */
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]');if(!t)return;
  var act=t.dataset.act,id=t.dataset.id;
  if(act==='overlay'){if(e.target===t)closeModal();return;}
  switch(act){
    case 'retry':S.loadErr=false;render();loadConfig();break;
    case 'book':openModal({type:'identity',serviceId:id});break;
    case 'mine':openModal({type:'phone'});break;
    case 'nav':S.page=t.dataset.p==='home'?null:t.dataset.p;S.confirmId=null;window.scrollTo(0,0);render();break;
    case 'home':S.page=null;S.confirmId=null;window.scrollTo(0,0);render();break;
    case 'mine-page':
      var ph=phoneKey((S.identity&&S.identity.phone)||'');
      if(ph.length<10){openModal({type:'phone'});break;}
      S.phoneQuery=ph;S.mine=[];S.mineLoading=true;S.page='mine';window.scrollTo(0,0);render();
      rpc('my_bookings',{p_phone:ph}).then(function(arr){S.mine=arr||[];}).catch(function(e){S.mine=[];toast(msg(e));}).then(function(){S.mineLoading=false;refreshMine();});
      break;
    case 'close':S.bl=null;closeModal();break;
    case 'back-id':openModal({type:'identity',serviceId:S.bl?S.bl.serviceId:S.sched.serviceId});break;
    case 'identity-ok':onIdentityOk();break;
    case 'pass-ok':onPassOk();break;
    case 'phone-ok':onPhoneOk();break;
    case 'day':S.sched.date=t.dataset.k;S.sched.time=null;refreshSched();break;
    case 'pick':S.sched.time=t.dataset.t;refreshSched();break;
    case 'sched-ok':doBook();break;
    case 'cancel-mine':S.confirmId=id;refreshMine();break;
    case 'cancel-no':S.confirmId=null;refreshMine();break;
    case 'cancel-yes':{
      S.confirmId=null;
      rpc('cancel_booking',{p_id:id,p_phone:S.phoneQuery}).then(function(){
        S.mine=S.mine.filter(function(b){return b.id!==id;});toast('Agendamento cancelado.');refreshTaken();
      }).catch(function(er){toast(msg(er));}).then(refreshMine);
      break;}
    case 'logout':
      if(S.token)rpc('barber_logout',{p_token:S.token}).catch(function(){});
      leaveBarber();break;
    case 'tab':S.tab=t.dataset.tab;S.confirmId=null;if(S.tab==='ajustes')S.draft=clone(S.cfg);if(S.tab==='bloqueios')loadBlocks();render();break;
    case 'done':{
      var bd=findBooking(S.all,id);
      if(bd)barberCall('barber_set_status',{p_id:id,p_done:true}).then(function(){toast('Concluído · '+money.format(Number(bd.price)||0)+' no faturamento.');return loadAll();}).catch(function(er){toast(msg(er));});
      break;}
    case 'undo':
      barberCall('barber_set_status',{p_id:id,p_done:false}).then(function(){toast('Atendimento voltou para a agenda.');return loadAll();}).catch(function(er){toast(msg(er));});
      break;
    case 'rm':S.confirmId=id;render();break;
    case 'rm-no':S.confirmId=null;render();break;
    case 'rm-yes':
      S.confirmId=null;render();
      barberCall('barber_delete',{p_id:id}).then(function(){toast('Atendimento removido.');return loadAll();}).catch(function(er){toast(msg(er));});
      break;
    case 'toggle-day':{
      var di=Number(t.dataset.d),cd=S.draft.closedDays,ix=cd.indexOf(di);
      if(ix>=0)cd.splice(ix,1);else cd.push(di);
      render();break;}
    case 'add-svc':S.draft.services.push({id:'',name:'',duration:15,price:0});render();break;
    case 'del-svc':S.draft.services.splice(Number(t.dataset.i),1);render();break;
    case 'blk-day':S.blkDay=t.dataset.k;render();break;
    case 'blk-slot':{
      var bd=S.blocks[S.blkDay]||{all:false,slots:{}},tm=t.dataset.t;
      if(bd.all){toast('O dia inteiro está bloqueado. Toque em "Liberar o dia inteiro" primeiro.');break;}
      setBlock(S.blkDay,tm,!bd.slots[tm]);break;}
    case 'blk-all':setBlock(S.blkDay,null,t.dataset.v==='1');break;
    case 'photo-del':if(S.draft){S.draft.photo='';saveConfig();}break;
    case 'save-cfg':saveConfig();break;
    case 'change-pw':changePw();break;
  }
});
document.addEventListener('input',function(e){
  var el=e.target;
  if(el.id==='f-phone'){el.value=fmtPhone(el.value);return;}
  var f=el.dataset&&el.dataset.f;
  if(!f||!S.draft)return;
  if(f==='svc'){
    var s=S.draft.services[Number(el.dataset.i)];if(!s)return;
    var k=el.dataset.k;
    if(k==='name')s.name=el.value;
    else if(k==='duration')s.duration=parseInt(el.value,10)||0;
    else if(k==='price')s.price=parseFloat(String(el.value).replace(',','.'))||0;
  }else if(f==='step')S.draft.step=parseInt(el.value,10)||15;
  else S.draft[f]=el.value;
});
document.addEventListener('change',function(e){
  var el=e.target;if(!el||el.id!=='photo-in'||!el.files||!el.files[0]||!S.draft)return;
  var f=el.files[0];
  if(!/^image\//.test(f.type))return toast('Escolha um arquivo de imagem.');
  var rd=new FileReader(),img=new Image();
  img.onload=function(){
    var n=360,cv=document.createElement('canvas');cv.width=n;cv.height=n;
    var cx=cv.getContext('2d'),m=Math.min(img.width,img.height),sx=(img.width-m)/2,sy=(img.height-m)/2;
    cx.fillStyle='#fff';cx.fillRect(0,0,n,n);cx.drawImage(img,sx,sy,m,m,0,0,n,n);
    S.draft.photo=cv.toDataURL('image/jpeg',0.82);
    saveConfig();
  };
  img.onerror=function(){toast('Não consegui abrir essa imagem. Tente outra.');};
  rd.onload=function(){img.src=rd.result;};
  rd.onerror=img.onerror;
  rd.readAsDataURL(f);
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&S.modal){S.bl=null;closeModal();return;}
  if(e.key==='Enter'&&e.target&&e.target.matches&&e.target.matches('#modal input')){
    var ok=$('#modal .btn-ok');if(ok&&!ok.disabled){e.preventDefault();ok.click();}
  }
});
document.addEventListener('focusout',function(){setTimeout(function(){if(S.dirty&&!(document.activeElement&&document.activeElement.matches&&document.activeElement.matches('#app input, #app select, #app textarea')))render();},0);});

/* ---------- inicialização ---------- */
render();
if(CONFIGURED){
  loadConfig();
  refreshTaken();
  var tk=null;try{tk=sessionStorage.getItem('barbearia.tk');}catch(e){}
  if(tk){
    S.token=tk;
    rpc('barber_bookings',{p_token:tk}).then(function(arr){S.all=arr||[];enterBarber();}).catch(function(){S.token=null;saveToken(null);});
  }
  setInterval(function(){
    if(document.hidden)return;
    if(S.view==='barber')loadAll();else refreshTaken();
  },20000);
}
})();
