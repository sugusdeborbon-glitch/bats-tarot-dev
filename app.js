var BATS_VERSION="1.10.0";
window._ocultarReferencias=false;
var _BATS_TEST_COMODIN=true; // TODO: remove after testing

var PALOS=[["bastos","Wands"],["copas","Cups"],["espadas","Swords"],["oros","Pentacles"]];
var NOMPALO={bastos:"Bastos",copas:"Copas",espadas:"Espadas",oros:"Oros"};
var BARAJA=[];
var MAYORES=[
  [0,"El Loco","TheFool"],[1,"El Mago","TheMagician"],[2,"La Sacerdotisa","TheHighPriestess"],
  [3,"La Emperatriz","TheEmpress"],[4,"El Emperador","TheEmperor"],[5,"El Hierofante","TheHierophant"],
  [6,"Los Enamorados","TheLovers"],[7,"El Carro","TheChariot"],[8,"La Fuerza","Strength"],
  [9,"El Ermitaño","TheHermit"],[10,"La Rueda de la Fortuna","WheelOfFortune"],[11,"La Justicia","Justice"],
  [12,"El Colgado","TheHangedMan"],[13,"La Muerte","Death"],[14,"La Templanza","Temperance"],
  [15,"El Diablo","TheDevil"],[16,"La Torre","TheTower"],[17,"La Estrella","TheStar"],
  [18,"La Luna","TheMoon"],[19,"El Sol","TheSun"],[20,"El Juicio","Judgement"],[21,"El Mundo","TheWorld"]
];
MAYORES.forEach(function(a){
  BARAJA.push({nombre:a[1],valor:a[0],tipo:"arcano",img:"cartas/"+z(a[0])+"-"+a[2]+".jpg",nucleo:"Arcano Mayor",letras:ini(a[1])});
});
var NUMES=["","As","Dos","Tres","Cuatro","Cinco","Seis","Siete","Ocho","Nueve","Diez"];
var FIGURAS=["Sota","Caballo","Reina","Rey"];
PALOS.forEach(function(p){
  var pa=p[0],pi=p[1],np=NOMPALO[pa];
  for(var v=1;v<=14;v++){
    var nom=(v<=10?NUMES[v]:FIGURAS[v-11])+" de "+np;
    BARAJA.push({nombre:nom,valor:v,tipo:pa,img:"cartas/"+pi+z(v)+".jpg",nucleo:np,letras:ini(nom)});
  }
});

var COMODIN={nombre:"Comodín",valor:0,tipo:"comodin",img:"comodin_reverso.png",letras:"∞",nucleo:"Comodín"};
var COMODIN_INV_TEXT="El conocimiento no es apropiado en este momento; se recomienda avanzar con confianza.";
var COMODIN_TEXTO_REVERSO="Toca la carta para revelar el umbral.";
var COMODIN_TEXTO_CERRADO="Toca la carta para abrir la extensión BATS.";
var COMODIN_TEXTO_ABIERTO="Toca una carta extendida para ver su interpretación completa.";
var COMODIN_POS=["¿De qué te quiere avisar?","¿En qué te quiere ayudar?","La Salida"];
function esComodin(c){return c&&c.tipo==="comodin"}
function añadirComodin(mazo,activo){if(!activo&&!window._BATS_TEST_COMODIN)return mazo;mazo.push(Object.assign({},COMODIN));return mazo}
function comodinImg(estado,invertida){
  if(estado==="cerrado") return "comodin_anverso_umbral_cerrado.png";
  if(estado==="abierto") return "comodin_anverso_umbral_abierto.png";
  return "comodin_reverso.png";
}
function comodinEnCartas(cartas){
  if(!cartas) return null;
  for(var i=0;i<cartas.length;i++){if(esComodin(cartas[i].carta)) return cartas[i];}
  return null;
}
var TABLA_78=[];
(function(){
  for(var i=1;i<=21;i++)TABLA_78.push(BARAJA[i]);
  TABLA_78.push(BARAJA[0]);
  for(var i=22;i<=77;i++)TABLA_78.push(BARAJA[i]);
})();

function z(n){return n<10?"0"+n:""+n}
function ini(s){return s.replace(/^(La|Los|El|Las|As|Sota|Caballo|Reina|Rey)\s+(de\s+)?/i,"").substring(0,2).toUpperCase()}

var PITO={A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,I:9,J:1,K:2,L:3,M:4,N:5,O:6,P:7,Q:8,R:9,S:1,T:2,U:3,V:4,W:5,X:6,Y:7,Z:8};
function normalizarNombre(s){return s.toUpperCase().replace(/[ÁÉÍÓÚÜ]/g,function(m){return{"Á":"A","É":"E","Í":"I","Ó":"O","Ú":"U","Ü":"U"}[m]}).replace(/[^A-Z\s]/g,"")}
function sumaDigitos(n){var s=0;for(var i=0;i<n.length;i++)s+=parseInt(n[i])||0;return s}
function sumaNombre(s){var n=normalizarNombre(s),sum=0;for(var i=0;i<n.length;i++)if(PITO[n[i]])sum+=PITO[n[i]];return sum}
function calcArcanoNum(fechaNac,fechaDia,nombre){
  var dn=fechaNac.replace(/\//g,""),dd=fechaDia.replace(/\//g,"");
  if(dn.length!==8||dd.length!==8)return null;
  var sn=sumaDigitos(dn),sd=sumaDigitos(dd),snn=sumaNombre(nombre);
  var total=sn+sd+snn;
  if(total===0)return null;
  if(total>=1&&total<=78)return total;
  while(total>78){var s=0,t=total;while(t>0){s+=t%10;t=Math.floor(t/10)}total=s}
  return total>0&&total<=78?total:null;
}

function barajar(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a}
function crearSub(m){
  if(!m||m==="completo") return BARAJA.slice();
  if(m==="mayores") return BARAJA.filter(function(c){return c.tipo==="arcano"});
  if(m==="menores") return BARAJA.filter(function(c){return c.tipo!=="arcano"&&c.valor>=1&&c.valor<=10});
  if(m==="corte") return BARAJA.filter(function(c){return c.tipo!=="arcano"&&c.valor>=11&&c.valor<=14});
  return BARAJA.slice();
}
function repartir(n,inv,mazo){
  var d=barajar(mazo.slice()),r=[];
  for(var i=0;i<n&&i<d.length;i++) r.push({carta:d[i],invertida:inv?Math.random()<.5:false});
  return r;
}
function batsDe(c){
  if(typeof DATOS_BATS!=="undefined"&&DATOS_BATS[c.nombre]) return DATOS_BATS[c.nombre];
  return null;
}
function txt(c,inv,sombra){
  var d=batsDe(c);
  if(!d) return "\u2014";
  if(sombra&&d.sombra) return d.sombra;
  if(inv&&d.invertida) return d.invertida;
  if(d.normal) return d.normal;
  if(d.prof) return d.prof;
  return c.nucleo||"\u2014";
}

function toggleMenu(){
  document.getElementById("menu-overlay").classList.toggle("open");
  document.getElementById("menu-lateral").classList.toggle("open");
}
function cerrarMenu(){
  document.getElementById("menu-overlay").classList.remove("open");
  document.getElementById("menu-lateral").classList.remove("open");
}
function irA(id){
  cerrarMenu();
  if(typeof vozParar==="function"){try{vozParar()}catch(e){}}
  document.querySelectorAll(".panel").forEach(function(p){p.classList.remove("active")});
  var el=document.getElementById("panel-"+id);
  if(el) el.classList.add("active");
  if(id==="historial") cargarHist();
  if(id==="ayuda") mostrarTodas();
  window.scrollTo({top:0,behavior:"smooth"});
}

function toast(msg,isError){
  var t=document.createElement("div");
  t.className="toast"+(isError?" error-toast":"");
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){t.remove()},2500);
}

function imgCard(c,comodinEstado,comodinInv,idx){
  if(esComodin(c)){
    var src=comodinImg(comodinEstado||"reverso",comodinInv);
    var cls="comodin-card"+(comodinInv&&comodinEstado!=="reverso"?" invertida":"");
    var onclick=typeof idx==="number"?'onclick="revelarComodin('+idx+')"':('onclick="abrirLightbox(\''+src+'\',\'Comodín\')"');
    return '<img src="'+src+'" alt="Comodín" class="'+cls+'" '+onclick+'>';
  }
  return '<img src="'+c.img+'" alt="'+c.nombre+'" loading="lazy" onclick="abrirLightbox(this.src,this.alt)" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="card-placeholder" style="display:none"><div class="cp-name">'+c.letras+'</div><div class="cp-suit">'+(c.tipo==="arcano"?"AM":c.nucleo)+'</div></div>';
}
function abrirLightbox(src,alt){
  var o=document.createElement('div');
  o.className='lightbox';
  o.innerHTML='<div class="lightbox-bg" onclick="this.parentElement.remove()"></div><div class="lightbox-content" onclick="this.parentElement.remove()"><img src="'+src+'" alt="'+alt+'"><div class="lightbox-nombre">'+alt+'</div></div>';
  document.body.appendChild(o);
}

function revelarComodin(i){
  var cartas=window._ult;if(!cartas) return;
  var it=cartas[i];if(!it||!esComodin(it.carta)) return;
  if(it.comodinEstado==="reverso"){
    it.comodinEstado="cerrado";
    it.comodinImg=comodinImg("cerrado",it.comodinInvertido);
    renderCartasActuales();
    return;
  }
  if(it.comodinEstado==="cerrado"){
    if(it.comodinInvertido){toast(COMODIN_INV_TEXT);return;}
    if(it.extensionResuelta) return;
    abrirExtension(i);
    return;
  }
}
function abrirExtension(i){
  var cartas=window._ult;if(!cartas) return;
  var it=cartas[i];if(!it||!esComodin(it.carta)||it.extensionResuelta) return;
  var pool=window._mazoRestante||[];
  if(pool.length<3){toast("No hay suficientes cartas para la extensión",true);return;}
  var inv=it.comodinInvertido;
  var ext=[];
  for(var e=0;e<3;e++){
    var cr=pool[e];
    var invC=inv?Math.random()<.5:false;
    ext.push({carta:cr,invertida:invC,posicion:COMODIN_POS[e],texto:txt(cr,invC,e===0)});
  }
  it.extension=ext;
  it.extensionResuelta=true;
  it.comodinEstado="abierto";
  it.comodinImg=comodinImg("abierto",false);
  window._mazoRestante=pool.slice(3);
  recalcularQuintaYRenderizar();
  var dest=window._lastPanelDest;
  var ctx=window._lastCtx;
  if(!dest||!ctx) return;
  var panelId=ctx.panelId||window._lastPanel||"tirada";
  var useCorta=getFlagCorta(panelId);
  var useLarga=getFlagLarga(panelId);
  function fin(){
    window._ocultarReferencias=false;
    renderCartasActuales();
    if(useLarga){try{renderInterpLarga(dest,cartas,ctx)}catch(e){console.error("renderInterpLarga post-ext:",e)}}
    try{ponerBotones(dest,window._lastPanelTitle||"",window._lastPanel||"")}catch(e){}
  }
  if(!useCorta&&!useLarga){fin();return;}
  if(useLarga){
    window._ocultarReferencias=true;
    var el=document.getElementById(dest);
    if(el) el.innerHTML='<div class="ai-cargando"><span class="ai-spinner"></span>Interpretando con IA\u2026</div>';
    var pCorta=useCorta?generarTextosIA(cartas,ctx):Promise.resolve(cartas);
    pCorta.then(fin).catch(function(e){
      console.error("Error textos IA post-ext:",e);
      fin();
    });
    return;
  }
  window._ocultarReferencias=true;
  generarTextosIA(cartas,ctx).then(fin).catch(function(e){console.error("Error textos IA post-ext:",e);fin()});
}
function renderCartasActuales(){
  var cartas=window._ult;if(!cartas) return;
  var dest=window._lastPanelDest;
  if(!dest) return;
  var opts=window._lastRenderOpts||{};
  if(cartas.length===5&&!opts.posiciones) mostrarCruz(cartas,dest,opts);
  else mostrarCompleto(cartas,dest,opts);
  ponerBotones(dest,window._lastPanelTitle||"",window._lastPanel||"");
  var qEl=document.getElementById("q-result");
  if(qEl) qEl.innerHTML=qHTML(cartas);
}
function recalcularQuintaYRenderizar(){
  renderCartasActuales();
}
function extraerExtensionDelMazo(n,mazo){
  var r=[];for(var i=0;i<n&&i<mazo.length;i++) r.push(mazo[i]);
  return r;
}

function calcQuinta(cartas){
  var suma=0;
  cartas.forEach(function(it){
    if(esComodin(it.carta)){
      if(it.extensionResuelta&&it.extension&&it.extension[2]) suma+=it.extension[2].carta.valor;
    } else {
      suma+=it.carta.valor;
    }
  });
  while(suma>22){
    var s=0,t=suma;
    while(t>0){s+=t%10;t=Math.floor(t/10)}
    suma=s;
  }
  if(suma<1||suma>22) return null;
  if(suma===22) return BARAJA[0];
  return BARAJA[suma];
}
function textoQuinta(nombre){
  if(typeof QUINTA_BATS!=="undefined"&&QUINTA_BATS[nombre]) return QUINTA_BATS[nombre];
  return null;
}
function parsearQuinta(texto){
  if(!texto) return {lectura:"",consejo:"",palabraClave:"",antipatron:""};
  var parts=texto.split(/\s{2,}/);
  var r={lectura:"",consejo:"",palabraClave:"",antipatron:""};
  parts.forEach(function(p){
    var t=p.trim();
    if(/^CONSEJO:/i.test(t)) r.consejo=t.replace(/^CONSEJO:\s*/i,"");
    else if(/^PALABRA CLAVE:/i.test(t)) r.palabraClave=t.replace(/^PALABRA CLAVE:\s*/i,"");
    else if(/^ANTIPATR[ÓO]N:/i.test(t)) r.antipatron=t.replace(/^ANTIPATR[ÓO]N:\s*/i,"");
    else r.lectura+=(r.lectura?" ":"")+t;
  });
  return r;
}
function extensionMd(cartas){
  var ci=comodinEnCartas(cartas);
  if(!ci||!ci.extensionResuelta||!ci.extension) return "";
  var md="### ✦ Comodín ∞\n\n";
  ci.extension.forEach(function(it){
    md+="**"+it.posicion+":** "+it.carta.nombre+(it.invertida?" (invertida)":"")+"\n\n";
    md+=(it.texto||txt(it.carta,it.invertida)||"\u2014")+"\n\n";
  });
  return md;
}
function extensionHtml(cartas){
  var ci=comodinEnCartas(cartas);
  if(!ci||!ci.extensionResuelta||!ci.extension) return "";
  var h='<div style="margin:16px auto;padding:12px;background:#1a1225;border:1px solid #d4a847;border-radius:8px;text-align:center;max-width:620px"><div style="color:#f0d080;font-weight:600;margin-bottom:8px">✦ COMODÍN ∞ → EXTENSIÓN BATS</div>';
  ci.extension.forEach(function(it){
    h+='<div style="margin:8px 0"><strong style="color:#f0d080;font-size:.75rem">'+it.posicion+':</strong> '+it.carta.nombre+(it.invertida?" (inv)":"")+'</div>';
    h+='<div style="color:#b8a898;font-size:.8rem">'+(it.texto||txt(it.carta,it.invertida)||"\u2014")+'</div>';
  });
  h+='</div>';
  return h;
}
function extensionVoz(cartas){
  var ci=comodinEnCartas(cartas);
  if(!ci||!ci.extensionResuelta||!ci.extension) return "";
  var parts=[];
  parts.push("Comodín extendido");
  ci.extension.forEach(function(it){
    parts.push(it.posicion+": "+it.carta.nombre+(it.invertida?" invertida":"")+". "+(it.texto||txt(it.carta,it.invertida)||""));
  });
  return parts.join(". ");
}
function reconstruirCartasHist(hr){
  return hr.cartas.map(function(it){
    var obj={carta:{nombre:it.nombre,img:it.img,valor:it.valor,tipo:it.tipo,nucleo:it.nucleo,letras:it.letras},invertida:it.invertida,texto:it.texto,posicion:it.posicion};
    if(it.comodin){
      obj.comodinInvertido=it.comodinInvertido;obj.comodinEstado=it.comodinEstado;
      if(it.extensionResuelta&&it.extension){
        obj.extensionResuelta=true;
        obj.extension=it.extension.map(function(ex){return{carta:{nombre:ex.nombre,img:ex.img,valor:ex.valor,tipo:ex.tipo,nucleo:ex.nucleo,letras:ex.letras},invertida:ex.invertida,posicion:ex.posicion,texto:ex.texto};});
      }
    }
    return obj;
  });
}
var PROMPT_AI="Eres un intérprete profesional de tarot Rider-Waite-Smith. Recibirás una tirada con posiciones ya definidas y sus cartas asignadas, incluyendo la quintaesencia ya calculada.\nPara cada posición:\n* Describe brevemente la imagen simbólica de la carta (RWS).\n* Interpreta su significado filtrado por el sentido de esa posición específica.\nAl final, interpreta la quintaesencia como síntesis arquetípica de fondo (nunca como mandato de acción ni predicción).\nNo inventes datos biográficos ni asumas circunstancias no proporcionadas. Si falta información necesaria, indícala explícitamente en vez de suponerla.";
function comodinPendiente(cartas){
  var pend=false;
  cartas.forEach(function(it){if(esComodin(it.carta)&&!it.extensionResuelta) pend=true;});
  return pend;
}
function comodinResuelto(cartas){
  var r=null;
  cartas.forEach(function(it){if(esComodin(it.carta)&&it.extensionResuelta&&it.extension) r=it;});
  return r;
}
function cartasParaAI(cartas){
  var ci=comodinResuelto(cartas);
  if(!ci) return cartas;
  var nueva=[];
  cartas.forEach(function(it){
    if(esComodin(it.carta)){
      var laSalida=ci.extension[2];
      nueva.push({carta:laSalida.carta,invertida:laSalida.invertida,posicion:it.posicion,texto:laSalida.texto||txt(laSalida.carta,laSalida.invertida)});
    } else {
      nueva.push(it);
    }
  });
  nueva._interp=cartas._interp; nueva._ia=cartas._ia; nueva._qtext=cartas._qtext;
  nueva._q=calcQuinta(nueva);
  return nueva;
}
function cartasExtensionParaAI(cartas){
  var ci=comodinResuelto(cartas);
  if(!ci) return null;
  return ci.extension.map(function(it,i){
    return {carta:it.carta,invertida:it.invertida,posicion:it.posicion,texto:it.texto};
  });
}
function qHTML(cartas){
  if(window._ocultarReferencias) return '';
  if(comodinPendiente(cartas)){
    return '<div class="q-box"><div class="q-label">✦ QUINTAESENCIA</div><div class="q-inner"><div style="color:var(--text2)">Pendiente de resolución del Comodín</div></div></div>';
  }
  var q=calcQuinta(cartas);
  if(!q) return '<div class="q-box"><div class="q-label">✦ QUINTAESENCIA</div><div class="q-inner"><div style="color:var(--text2)">No calculada</div></div></div>';
  var raw=cartas._qtext||textoQuinta(q.nombre)||txt(q,false);
  var p=parsearQuinta(raw);
  var h='<div class="q-box"><div class="q-label">✦ QUINTAESENCIA: '+q.nombre+'</div><div class="q-inner">'+imgCard(q)+'<div><div class="q-name">'+q.nombre+'</div>';
  if(p.lectura) h+='<div class="q-text">'+p.lectura+'</div>';
  if(p.consejo) h+='<div class="q-field"><span class="q-fl">Consejo de acción BATS</span>'+p.consejo+'</div>';
  if(p.palabraClave) h+='<div class="q-field"><span class="q-fl">Palabra clave</span>'+p.palabraClave+'</div>';
  if(p.antipatron) h+='<div class="q-field"><span class="q-fl">Antipatrón</span>'+p.antipatron+'</div>';
  h+='</div></div></div>';
  return h;
}

function renderExtensionHTML(cartas){
  var ci=comodinEnCartas(cartas);
  if(!ci||!ci.extensionResuelta||!ci.extension) return "";
  var h='<div class="extension-box"><div class="ext-label">✦ COMODÍN ∞ → EXTENSIÓN BATS</div><div style="color:var(--gold2);font-style:italic;font-size:.8rem;margin-bottom:8px">'+COMODIN_TEXTO_ABIERTO+'</div><div class="ext-cards">';
  ci.extension.forEach(function(it){
    var c=it.carta,inv=it.invertida;
    h+='<div class="card-view ext-card'+(inv?" invertida":"")+'">'+imgCard(c);
    h+='<div class="card-name">'+c.nombre+(inv?" (inv)":"")+'</div>';
    h+='<div class="ext-pos">'+it.posicion+'</div>';
    if(!window._ocultarReferencias) h+='<div class="card-field">'+(it.texto||txt(c,inv))+'</div>';
    h+='</div>';
  });
  h+='</div></div>';
  return h;
}
function mostrarCompleto(cartas,dest,opts){
  opts=opts||{};
  window._lastPanelDest=dest;window._lastRenderOpts=opts;
  var html='<div class="card-container">';
  cartas.forEach(function(it,i){
    var c=it.carta,inv=it.invertida;
    var pos=it.posicion||(opts.posiciones?opts.posiciones[i]:null);
    var texto=it.texto||txt(c,inv);
    var comodinC=esComodin(c);
    html+='<div class="card-view'+(inv?" invertida":"")+(comodinC?" comodin-slot":"")+'">';
    if(comodinC) html+=imgCard(c,it.comodinEstado||"reverso",it.comodinInvertido,i);
    else html+=imgCard(c);
    html+='<div class="card-name">'+c.nombre+'</div>';
    if(pos) html+='<div style="font-size:.72rem;color:var(--gold2);margin-top:2px">'+pos+'</div>';
    if(comodinC&&it.comodinEstado==="cerrado"&&!it.comodinInvertido&&!it.extensionResuelta){
      html+='<div class="card-field" style="color:var(--gold2);font-style:italic">'+COMODIN_TEXTO_CERRADO+'</div>';
      html+='<div style="margin-top:6px"><button class="btn btn-gold btn-sm" onclick="abrirExtension('+i+')">✦ Abrir Extensión</button></div>';
    }
    if(comodinC&&it.comodinInvertido&&it.comodinEstado!=="reverso"){
      html+='<div class="card-field" style="color:var(--gold2);font-style:italic">'+COMODIN_INV_TEXT+'</div>';
    }
    if(comodinC&&it.comodinEstado==="reverso"){
      html+='<div class="card-field" style="color:var(--gold2);font-style:italic">'+COMODIN_TEXTO_REVERSO+'</div>';
    }
    if(texto&&opts.mostrarTexto!==false&&!comodinC&&!window._ocultarReferencias) html+='<div class="card-field">'+texto+'</div>';
    html+='</div>';
  });
  html+='</div>';
  html+=renderExtensionHTML(cartas);
  if(opts.mostrarQ!==false) html+=qHTML(cartas);
  document.getElementById(dest).innerHTML=html;
}

function mostrarCruz(cartas,dest,opts){
  opts=opts||{};
  window._lastPanelDest=dest;window._lastRenderOpts=opts;
  var cls=["cross-center","cross-left","cross-right","cross-top","cross-bottom"];
  var html='<div class="cross-container">';
  cartas.forEach(function(it,i){
    var c=it.carta,inv=it.invertida,pos=it.posicion;
    var texto=it.texto||txt(c,inv);
    var comodinC=esComodin(c);
    html+='<div class="card-view'+(inv?" invertida":"")+(comodinC?" comodin-slot":"")+' '+cls[i]+'">';
    if(comodinC) html+=imgCard(c,it.comodinEstado||"reverso",it.comodinInvertido,i);
    else html+=imgCard(c);
    html+='<div class="card-name">'+c.nombre+'</div>';
    if(pos) html+='<div style="font-size:.65rem;color:var(--gold2);margin-top:1px;line-height:1.2">'+pos+'</div>';
    if(comodinC&&it.comodinEstado==="cerrado"&&!it.comodinInvertido&&!it.extensionResuelta){
      html+='<div class="card-field" style="color:var(--gold2);font-style:italic;font-size:.7rem">'+COMODIN_TEXTO_CERRADO+'</div>';
      html+='<div style="margin-top:6px"><button class="btn btn-gold btn-sm" onclick="abrirExtension('+i+')">✦ Abrir Extensión</button></div>';
    }
    if(comodinC&&it.comodinInvertido&&it.comodinEstado!=="reverso"){
      html+='<div class="card-field" style="color:var(--gold2);font-style:italic;font-size:.7rem">'+COMODIN_INV_TEXT+'</div>';
    }
    if(comodinC&&it.comodinEstado==="reverso"){
      html+='<div class="card-field" style="color:var(--gold2);font-style:italic;font-size:.7rem">'+COMODIN_TEXTO_REVERSO+'</div>';
    }
    if(texto&&opts.mostrarTexto!==false&&!comodinC&&!window._ocultarReferencias) html+='<div class="card-field" style="font-size:.7rem">'+texto+'</div>';
    html+='</div>';
  });
  html+='</div>';
  html+=renderExtensionHTML(cartas);
  if(opts.mostrarQ!==false) html+=qHTML(cartas);
  document.getElementById(dest).innerHTML=html;
}

function guardarHist(tipo,cartas,descripcion,titulo){
  var h=JSON.parse(lsGet("bats-hist")||"[]");
  var sit=document.getElementById('situacion-'+window._lastPanel)?.value||'';
  var acc=document.getElementById('accion-'+window._lastPanel)?.value||'';
  var tipo_rel=document.getElementById('tipo-'+window._lastPanel)?.value||'';
  var anot=document.getElementById('anotaciones-'+window._lastPanel)?.value||'';
  var obs=document.getElementById('observado-'+window._lastPanel)?.value||'';
  h.unshift({fecha:new Date().toISOString(),tipo:tipo,descripcion:descripcion||"",titulo:titulo||"",situacion:sit,accion:acc,tipo_rel:tipo_rel,anotaciones:anot,observado:obs,_interp:cartas._interp||"",_ia:cartas._ia||"",_qtext:cartas._qtext||"",cartas:cartas.map(function(it){
    var obj={nombre:it.carta.nombre,img:it.carta.img,valor:it.carta.valor,tipo:it.carta.tipo,nucleo:it.carta.nucleo,letras:it.carta.letras,invertida:it.invertida,posicion:it.posicion,texto:it.texto||txt(it.carta,it.invertida)};
    if(esComodin(it.carta)){
      obj.comodin=true;obj.comodinInvertido=it.comodinInvertido;obj.comodinEstado=it.comodinEstado;
      if(it.extensionResuelta&&it.extension){
        obj.extensionResuelta=true;
        obj.extension=it.extension.map(function(ex){return {nombre:ex.carta.nombre,img:ex.carta.img,valor:ex.carta.valor,tipo:ex.carta.tipo,nucleo:ex.carta.nucleo,letras:ex.carta.letras,invertida:ex.invertida,posicion:ex.posicion,texto:ex.texto};});
      }
    }
    return obj;
  }),resumen:cartas.map(function(it){return it.carta.nombre+(it.invertida?"(inv)":"")}).join(", ")});
  if(h.length>50) h=h.slice(0,50);
  lsSet("bats-hist",JSON.stringify(h));
  toast("\u2713 Guardado en historial");
}

function exportarHist(){
  var h=lsGet("bats-hist");
  if(!h||h==="[]"){toast("No hay historial para exportar",true);return}
  var f=new Date(),fn=f.getFullYear()+"-"+z(f.getMonth()+1)+"-"+z(f.getDate());
  downloadBlob(h,"bats-historial-"+fn+".json","application/json");
  toast("Historial exportado");
}
function importarHist(){
  var inp=document.createElement("input");inp.type="file";inp.accept=".json";
  inp.onchange=function(e){
    var file=e.target.files[0];if(!file)return;
    var reader=new FileReader();
    reader.onload=function(ev){
      try{
        var data=JSON.parse(ev.target.result);
        if(!Array.isArray(data)){toast("Formato inv\u00e1lido",true);return}
        if(!confirm("\u00bfImportar "+data.length+" lectura(s)? Se a\u00f1adir\u00e1n al historial actual."))return;
        var h=JSON.parse(lsGet("bats-hist")||"[]");
        data.forEach(function(r){h.unshift(r)});
        if(h.length>100) h=h.slice(0,100);
        lsSet("bats-hist",JSON.stringify(h));
        cargarHist();
        toast("\u2713 "+data.length+" lectura(s) importadas");
      }catch(e){toast("Archivo inv\u00e1lido",true)}
    };
    reader.readAsText(file);
  };
  inp.click();
}

function isCap(){return !!(window.Capacitor&&Capacitor.Plugins)}
function downloadBlob(content,filename,type){
  if(isCap()&&Capacitor.Plugins.Filesystem&&Capacitor.Plugins.Share){
    var fs=Capacitor.Plugins.Filesystem;
    var sh=Capacitor.Plugins.Share;
    fs.writeFile({path:filename,data:content,directory:"CACHE",encoding:"utf8"}).then(function(r){
      return fs.getUri({path:filename,directory:"CACHE"});
    }).then(function(r){
      sh.share({title:filename,text:content,files:[r.uri]}).catch(function(){toast("Guardado en caché: "+filename)});
    }).catch(function(){toast("No se pudo guardar",true)});
  }else{
    var b=new Blob([content],{type:type+";charset=utf-8"});
    var u=URL.createObjectURL(b);
    var a=document.createElement("a");a.href=u;a.download=filename;
    document.body.appendChild(a);a.click();
    document.body.removeChild(a);URL.revokeObjectURL(u);
  }
}
function slugify(s){
  return s.toLowerCase().replace(/[^a-z0-9áéíóúüñ\s-]/g,'').replace(/\s+/g,'_').replace(/-+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')||"tirada";
}
function btnGuardar(tipo,cartas){
  return '<button class="btn btn-outline btn-sm" onclick="guardarHist(\''+tipo.replace(/'/g,"\\'")+'\',window._ult,document.getElementById(\'desc-\'+window._lastPanel)&&document.getElementById(\'desc-\'+window._lastPanel).value||\'\',document.getElementById(\'titulo-\'+window._lastPanel)&&document.getElementById(\'titulo-\'+window._lastPanel).value||\'\');return false">Guardar en historial</button>';
}
function btnMD(titulo,panelId){
  var esc=titulo.replace(/'/g,"\\'");
  return '<button class="btn btn-outline btn-sm" onclick="descargarMD(\''+esc+'\',window._ult,document.getElementById(\'desc-'+panelId+'\')&&document.getElementById(\'desc-'+panelId+'\').value||\'\',document.getElementById(\'situacion-'+panelId+'\')&&document.getElementById(\'situacion-'+panelId+'\').value||\'\',document.getElementById(\'accion-'+panelId+'\')&&document.getElementById(\'accion-'+panelId+'\').value||\'\',document.getElementById(\'tipo-'+panelId+'\')&&document.getElementById(\'tipo-'+panelId+'\').value||\'\',document.getElementById(\'anotaciones-'+panelId+'\')&&document.getElementById(\'anotaciones-'+panelId+'\').value||\'\',document.getElementById(\'observado-'+panelId+'\')&&document.getElementById(\'observado-'+panelId+'\').value||\'\')">Descargar MD</button>';
}
function btnHTML(titulo,panelId){
  var esc=titulo.replace(/'/g,"\\'");
  return '<button class="btn btn-outline btn-sm" onclick="descargarHTML(\''+esc+'\',window._ult,document.getElementById(\'desc-'+panelId+'\')&&document.getElementById(\'desc-'+panelId+'\').value||\'\',document.getElementById(\'situacion-'+panelId+'\')&&document.getElementById(\'situacion-'+panelId+'\').value||\'\',document.getElementById(\'accion-'+panelId+'\')&&document.getElementById(\'accion-'+panelId+'\').value||\'\',document.getElementById(\'tipo-'+panelId+'\')&&document.getElementById(\'tipo-'+panelId+'\').value||\'\',document.getElementById(\'anotaciones-'+panelId+'\')&&document.getElementById(\'anotaciones-'+panelId+'\').value||\'\',document.getElementById(\'observado-'+panelId+'\')&&document.getElementById(\'observado-'+panelId+'\').value||\'\')">Descargar HTML</button>';
}
function btnAI(titulo,panelId){
  var esc=titulo.replace(/'/g,"\\'");
  return '<button class="btn btn-outline btn-sm" onclick="descargarAI(\''+esc+'\',window._ult)">Descargar IA</button>';
}
function btnCompartir(titulo){
  return '<button class="btn btn-outline btn-sm" onclick="compartirTirada()">Compartir</button>';
}
function cuadernoHTML(panelId){
  var cntId='cnt-'+panelId;
  return '<div class="cuaderno-section"><h4 style="color:var(--gold);margin:0 0 8px;font-size:.9rem">Cuaderno de reflexiones</h4><div class="form-group"><label for="anotaciones-'+panelId+'">Anotaciones</label><div class="char-counter"><textarea id="anotaciones-'+panelId+'" class="input-desc" maxlength="300" placeholder="Escribe lo que consideres sobre esta tirada..." oninput="updateCounter(this,\''+cntId+'\')"></textarea><span class="counter-text" id="'+cntId+'">0/300</span></div></div><div class="form-group"><label for="observado-'+panelId+'">Lo observado</label><textarea id="observado-'+panelId+'" class="input-desc" maxlength="500" placeholder="Escribe después lo que has visto o vivido respecto a lo que entendiste..."></textarea></div></div>';
}
function ponerBotones(dest,titulo,panelId){
  var el=document.getElementById(dest);
  el.insertAdjacentHTML("beforeend",cuadernoHTML(panelId)+'<div class="btn-group mt-8">'+btnMD(titulo,panelId)+btnHTML(titulo,panelId)+btnAI(titulo,panelId)+btnCompartir(titulo)+btnGuardar(titulo)+'</div>');
}

var BATS_BASE="https://sugusdeborbon-glitch.github.io/bats-tarot/";
function descargarMD(titulo,cartas,descripcion,situacion,accion,tipo,anotaciones,observado){
  var f=new Date(),fs=f.toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});
  var fn=f.getFullYear()+"-"+z(f.getMonth()+1)+"-"+z(f.getDate())+"_"+z(f.getHours())+z(f.getMinutes());
  var slug=slugify(titulo);
  var md="# "+titulo+"\n\n_Fecha: "+fs+"_\n\n";
  if(descripcion) md+="*"+descripcion+"*\n\n";
  if(situacion) md+="**Situación:** "+situacion+"\n\n";
  if(tipo) md+="**Tipo de relación:** "+tipo+"\n\n";
  cartas.forEach(function(it){
    var c=it.carta,inv=it.invertida,pos=it.posicion;
    md+="### "+(pos?pos+": ":"")+c.nombre+(inv?" (invertida)":"")+"\n\n";
    md+=(it.texto||txt(c,inv)||"\u2014")+"\n\n";
  });
  md+=extensionMd(cartas);
  var q=calcQuinta(cartas);
  if(q){var p=parsearQuinta(cartas._qtext||textoQuinta(q.nombre)||txt(q,false));md+="### ✦ Quintaesencia\n\n**"+q.nombre+"**\n\n";if(p.lectura) md+=p.lectura+"\n\n";if(p.consejo) md+="**Consejo de acción BATS:** "+p.consejo+"\n\n";if(p.palabraClave) md+="**Palabra clave:** "+p.palabraClave+"\n\n";if(p.antipatron) md+="**Antipatrón:** "+p.antipatron+"\n\n";}
  if(cartas._interp) md+="### ✦ Interpretación\n\n"+cartas._interp+"\n\n";
  if(cartas._ia) md+="_IA que ha asistido la interpretación: "+cartas._ia+"_\n\n";
  if(accion) md+="**Acción recomendada:** "+accion+"\n\n";
  if(anotaciones) md+="**Anotaciones:** "+anotaciones+"\n\n";
  if(observado) md+="**Lo observado:** "+observado+"\n\n";
  md+="_Generado por BATS Tarot_";
  downloadBlob(md,"bats-"+slug+"-"+fn+".md","text/markdown");
}
function descargarHTML(titulo,cartas,descripcion,situacion,accion,tipo,anotaciones,observado){
  var f=new Date(),fs=f.toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});
  var fn=f.getFullYear()+"-"+z(f.getMonth()+1)+"-"+z(f.getDate())+"_"+z(f.getHours())+z(f.getMinutes());
  var slug=slugify(titulo);
  var esCruz=cartas.length===5;
  var clsCruz=["cross-center","cross-left","cross-right","cross-top","cross-bottom"];
  var cardsHTML="";
  cartas.forEach(function(it,i){
    var c=it.carta,inv=it.invertida,pos=it.posicion;
    var txts=it.texto||txt(c,inv)||"\u2014";
    if(esCruz) cardsHTML+='<div class="card '+(inv?"inv ":"")+clsCruz[i]+'">';
    else cardsHTML+='<div class="card'+(inv?" inv":"")+'">';
    cardsHTML+='<img src="'+BATS_BASE+c.img+'" alt="'+c.nombre+'">';
    cardsHTML+='<div class="cn">'+c.nombre+(inv?' <small>(inv)</small>':'')+'</div>';
    if(pos) cardsHTML+='<div class="cp">'+pos+'</div>';
    cardsHTML+='<div class="ct">'+txts+'</div></div>';
  });
  var q=calcQuinta(cartas);
  var qH="";
  if(q){
    var p=parsearQuinta(cartas._qtext||textoQuinta(q.nombre)||txt(q,false));
    qH='<div class="q"><div class="ql">✦ QUINTAESENCIA: '+q.nombre+'</div>';
    qH+='<img src="'+BATS_BASE+q.img+'" alt="'+q.nombre+'">';
    qH+='<div class="cn">'+q.nombre+'</div>';
    if(p.lectura) qH+='<div class="ct">'+p.lectura+'</div>';
    if(p.consejo) qH+='<div class="ct" style="margin-top:6px"><strong style="color:#f0d080;font-size:.75rem">CONSEJO DE ACCIÓN BATS:</strong> '+p.consejo+'</div>';
    if(p.palabraClave) qH+='<div class="ct" style="margin-top:4px"><strong style="color:#f0d080;font-size:.75rem">PALABRA CLAVE:</strong> '+p.palabraClave+'</div>';
    if(p.antipatron) qH+='<div class="ct" style="margin-top:4px"><strong style="color:#f0d080;font-size:.75rem">ANTIPATRÓN:</strong> '+p.antipatron+'</div>';
    qH+='</div>';
  }
  var wrap=esCruz?"cross-container":"cards";
  var extraCSS=esCruz?".cross-container{display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:auto auto auto;gap:12px;max-width:520px;margin:16px auto;justify-items:center;align-items:start}.cross-center{grid-column:2;grid-row:2}.cross-left{grid-column:1;grid-row:2}.cross-right{grid-column:3;grid-row:2}.cross-top{grid-column:2;grid-row:1}.cross-bottom{grid-column:2;grid-row:3}.cross-container .card{width:140px}":"";
  var interpH=cartas._interp?'<div class="interp"><div class="ql">✦ INTERPRETACIÓN</div><div class="ct">'+interpParaHTML(cartas._interp)+'</div></div>':"";
  var iaH=cartas._ia?'<p class="ia">IA que ha asistido la interpretaci\u00f3n: '+escHTML(cartas._ia)+'</p>':"";
  var html='<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>'+titulo+' - BATS</title>';
  html+='<style>body{font-family:sans-serif;background:#0d0a13;color:#e8dcc8;padding:20px;max-width:800px;margin:0 auto}h1{color:#d4a847}.cards{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;margin:16px 0}.card{width:160px;text-align:center;background:#1a1225;border-radius:8px;padding:8px;border:1px solid #2a1a3e}.card.inv img,.card.invertida img{transform:rotate(180deg)}.card img,.q img{width:100%;border-radius:6px}.cn{color:#d4a847;font-weight:600;margin-top:4px;font-size:.9rem}.cp{color:#f0d080;font-size:.75rem;margin-top:2px}.ct{color:#b8a898;font-size:.8rem;margin-top:4px;text-align:left}.q{margin:20px auto;padding:12px;background:#1a1225;border:1px solid #d4a847;border-radius:8px;text-align:center;max-width:320px}.ql{color:#f0d080;font-weight:600;margin-bottom:8px}.q img{width:80px}.interp{margin:20px auto;padding:12px;background:#1a1225;border:1px solid #d4a847;border-radius:8px;max-width:620px;text-align:left}.interp .ct{white-space:pre-wrap}.ia{color:#8a7f6a;font-size:.72rem;text-align:center;margin:4px auto 0;max-width:620px}.foot{color:#666;font-size:.8rem;text-align:center;margin-top:24px}'+extraCSS+'</style></head><body>';
  html+='<h1>'+titulo+'</h1><p style="color:#b8a898"><em>'+fs+'</em></p>';
  if(descripcion) html+='<p style="font-style:italic;color:#b8a898;margin-bottom:12px">'+descripcion+'</p>';
  if(tipo) html+='<p style="font-style:italic;color:#f0d080;margin-bottom:12px"><strong>Tipo de relación:</strong> '+tipo+'</p>';
  if(situacion) html+='<p style="font-style:italic;color:#f0d080;margin-bottom:12px"><strong>Situación:</strong> '+situacion+'</p>';
  html+='<div class="'+wrap+'">'+cardsHTML+'</div>'+extensionHtml(cartas)+qH+interpH+iaH;
  if(accion) html+='<p style="font-style:italic;color:#b8a898;margin-top:12px"><strong>Acción recomendada:</strong> '+accion+'</p>';
  if(anotaciones) html+='<p style="color:#b8a898;margin-top:8px"><strong>Anotaciones:</strong> '+anotaciones+'</p>';
  if(observado) html+='<p style="color:#b8a898;margin-top:8px"><strong>Lo observado:</strong> '+observado+'</p>';
  html+='<p class="foot">Generado por BATS Tarot</p></body></html>';
  downloadBlob(html,"bats-"+slug+"-"+fn+".html","text/html");
}
function descargarAI(titulo,cartas){
  var f=new Date(),fs=f.toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});
  var fn=f.getFullYear()+"-"+z(f.getMonth()+1)+"-"+z(f.getDate())+"_"+z(f.getHours())+z(f.getMinutes());
  var slug=slugify(titulo);
  var panelId=window._lastPanel;
  var desc=document.getElementById('desc-'+panelId)?.value||'';
  var sit=document.getElementById('situacion-'+panelId)?.value||'';
  var acc=document.getElementById('accion-'+panelId)?.value||'';
  var tipo=document.getElementById('tipo-'+panelId)?.value||'';
  var anot=document.getElementById('anotaciones-'+panelId)?.value||'';
  var obs=document.getElementById('observado-'+panelId)?.value||'';
  var md=PROMPT_AI+"\n\n";
  md+="Tirada: "+titulo+"\nFecha: "+fs+"\n";
  if(desc) md+="Descripción: "+desc+"\n";
  if(sit) md+="Situación: "+sit+"\n";
  if(tipo) md+="Tipo de relación: "+tipo+"\n";
  md+="\nPosiciones y cartas:\n";
  cartas.forEach(function(it,i){
    md+=(i+1)+". "+(it.posicion||"")+": "+it.carta.nombre+(it.invertida?" (invertida)":"")+"\n";
  });
  var ci=comodinEnCartas(cartas);
  if(ci&&ci.extensionResuelta&&ci.extension){
    md+="\nComodín extendido:\n";
    ci.extension.forEach(function(it){md+="  "+it.posicion+": "+it.carta.nombre+(it.invertida?" (invertida)":"")+"\n";});
  }
  var q=calcQuinta(cartas);
  if(q) md+="\nQuintaesencia: "+q.nombre+"\n";
  if(acc) md+="\nAcción recomendada: "+acc+"\n";
  if(anot) md+="\nAnotaciones: "+anot+"\n";
  if(obs) md+="\nLo observado: "+obs+"\n";
  downloadBlob(md,"ia-"+slug+"-"+fn+".md","text/markdown");
}

function cargarHist(){
  var h=JSON.parse(lsGet("bats-hist")||"[]");
  var c=document.getElementById("r-historial");
  var htm='<div class="priv-notice">Las lecturas se guardan solo en este navegador y no se sincronizan. Para conservarlas o trasladarlas a otro dispositivo, usa Exportar.</div>';
  htm+='<div class="hist-controls"><div class="hist-search-row"><input type="text" id="hist-search" placeholder="Palabra clave..." onkeydown="if(event.key===\'Enter\')buscarHist()"><button class="btn btn-outline btn-sm" onclick="buscarHist()">Buscar</button><button class="btn btn-outline btn-sm" onclick="limpiarFiltros()">Limpiar</button></div><div class="hist-filters-row"><select id="hist-tipo"><option value="">Todos los tipos</option><option value="Cruz Diaria">Cruz Diaria</option><option value="Tirada de la relación">Relación</option><option value="BATS Laboral">BATS Laboral</option><option value="El Aprendizaje">Aprendizaje</option><option value="Tirada Personalizada">Personalizada</option><option value="El Arcano Visitante">Arcano Visitante</option></select><label>Desde: <input type="date" id="hist-desde"></label><label>Hasta: <input type="date" id="hist-hasta"></label></div></div>';
  htm+='<div id="hist-listado"></div>';
  c.innerHTML=htm;
  renderHistCards(h);
}
function renderHistCards(arr,fullArr){
  fullArr=fullArr||arr;
  var c=document.getElementById("hist-listado");
  if(!c) return;
  if(!arr.length){c.innerHTML='<p class="subtle">No hay lecturas guardadas.</p>';return}
  var htm='<div class="historial-grid">';
  arr.forEach(function(hr){
    var origIdx=fullArr.indexOf(hr);
    var d=new Date(hr.fecha),fs=d.toLocaleDateString("es-ES",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
    var previewImgs=hr.cartas.slice(0,4).map(function(ca){return '<img src="'+ca.img+'" alt="" loading="lazy">'}).join("");
    htm+='<div class="historial-card" onclick="verHist('+origIdx+')">';
    if(previewImgs) htm+='<div class="hc-preview">'+previewImgs+'</div>';
    htm+='<div class="h-fecha">'+fs+'</div><div class="h-tipo">'+(hr.titulo||hr.tipo)+(hr.descripcion?' <span style="font-weight:normal;font-size:.75rem;opacity:.7"> · '+hr.descripcion+'</span>':'')+'</div><div class="h-cartas">'+hr.resumen+'</div></div>';
  });
  htm+='</div>';
  c.innerHTML=htm;
}
function buscarHist(){
  var q=document.getElementById('hist-search')?.value?.toLowerCase().trim()||'';
  var tipo=document.getElementById('hist-tipo')?.value||'';
  var desde=document.getElementById('hist-desde')?.value||'';
  var hasta=document.getElementById('hist-hasta')?.value||'';
  var h=JSON.parse(lsGet("bats-hist")||"[]");
  if(!h.length){renderHistCards([]);return}
  var filtered=h.filter(function(hr){
    if(tipo && (hr.titulo||hr.tipo)!==tipo) return false;
    if(desde||hasta){
      var d=new Date(hr.fecha);
      if(desde && d<new Date(desde+'T00:00:00')) return false;
      if(hasta && d>new Date(hasta+'T23:59:59')) return false;
    }
    if(q){
      var text=(hr.titulo||hr.tipo+" "+hr.descripcion+" "+hr.resumen+" "+(hr.situacion||"")+" "+(hr.accion||"")+" "+(hr.tipo_rel||"")+" "+(hr.anotaciones||"")+" "+(hr.observado||"")).toLowerCase();
      var d2=new Date(hr.fecha),fs=d2.toLocaleDateString("es-ES",{year:"numeric",month:"short",day:"numeric"});
      return text.indexOf(q)>=0||fs.indexOf(q)>=0;
    }
    return true;
  });
  renderHistCards(filtered,h);
}
function limpiarFiltros(){
  ['hist-search','hist-tipo','hist-desde','hist-hasta'].forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.value='';
  });
  buscarHist();
}
function verHist(i){
  var h=JSON.parse(lsGet("bats-hist")||"[]");
  var hr=h[i];if(!hr)return;
  var cartas=reconstruirCartasHist(hr);
  cartas._interp=hr._interp||"";
  cartas._ia=hr._ia||"";
  cartas._qtext=hr._qtext||"";
  var htm='<div class="result-box"><h3 style="color:var(--gold);margin-bottom:6px">'+(hr.titulo||hr.tipo)+'</h3>';
  var fs=new Date(hr.fecha).toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});
  htm+='<p style="color:var(--text-muted);margin-bottom:8px;font-size:.85rem">'+fs+'</p>';
  if(hr.descripcion) htm+='<p style="font-style:italic;color:var(--text-muted);margin-bottom:8px;font-size:.9rem">'+(hr.titulo?hr.tipo+": ":"")+hr.descripcion+'</p>';
  if(hr.tipo_rel) htm+='<p style="font-style:italic;color:var(--text-muted);margin-bottom:8px;font-size:.9rem"><strong>Tipo de relación:</strong> '+hr.tipo_rel+'</p>';
  if(hr.situacion) htm+='<p style="font-style:italic;color:var(--text-muted);margin-bottom:8px;font-size:.9rem"><strong>Situación:</strong> '+hr.situacion+'</p>';
  if(hr.accion) htm+='<p style="font-style:italic;color:var(--text-muted);margin-bottom:8px;font-size:.9rem"><strong>Acción:</strong> '+hr.accion+'</p>';
  if(hr.cartas[0]&&hr.cartas[0].posicion){
    cartas.forEach(function(it){
      var c=it.carta;
      htm+='<div class="card-result"><div class="pos-name">'+(it.posicion||"")+'</div>';
      htm+='<div class="card-name-r">'+c.nombre+(it.invertida?" (inv)":"")+'</div>';
      htm+='<div class="card-msg">'+(it.texto||"\u2014")+'</div></div>';
    });
  }else{
    htm+='<div class="card-container">';
    cartas.forEach(function(it){
      var c=it.carta,inv=it.invertida?" invertida":"";
      var ci=imgCard(c,esComodin(c)?it.comodinEstado:undefined,esComodin(c)?it.comodinInvertido:undefined);
      htm+='<div class="card-view'+inv+'">'+ci+'<div class="card-name">'+c.nombre+(it.invertida?' <span style="color:var(--danger);font-size:.7rem">(inv)</span>':'')+'</div>';
      if(it.texto) htm+='<div class="card-field">'+it.texto+'</div>';
      htm+='</div>';
    });
    htm+='</div>';
  }
  htm+=extensionHtml(cartas);
  htm+=qHTML(cartas);
  if(hr._interp){
    htm+='<div class="ai-interp-texto" style="margin-top:10px">'+interpParaHTML(hr._interp)+'</div>';
  }else{
    htm+='<p style="font-style:italic;color:var(--text-muted);margin-top:10px;font-size:.85rem">Lectura sin interpretación guardada.</p>';
  }
  if(hr._ia) htm+='<div class="ai-interp-ia">IA que ha asistido la interpretaci\u00f3n: '+escHTML(hr._ia)+'</div>';
  if(typeof vozSoporte==="function"&&vozSoporte()){
    htm+=vozBarHTML("hist-"+i);
    VOZ.textos["hist-"+i]=vozTextoDe(cartas,{guion:/arcano/i.test(hr.tipo||"")?"arcano":null});
  }
  htm+='<div class="cuaderno-section"><h4 style="color:var(--gold);margin:12px 0 6px;font-size:.9rem">Cuaderno de reflexiones</h4>';
  htm+='<div class="form-group"><label for="c-anot-'+i+'">Anotaciones</label><div class="char-counter"><textarea id="c-anot-'+i+'" class="input-desc" maxlength="300" oninput="var c=document.getElementById(\'cnt-'+i+'\');if(c)c.textContent=this.length+\'/300\'" placeholder="Escribe lo que consideres sobre esta tirada...">'+(hr.anotaciones||"")+'</textarea><span class="counter-text" id="cnt-'+i+'">'+(hr.anotaciones||"").length+'/300</span></div></div>';
  htm+='<div class="form-group"><label for="c-obs-'+i+'">Lo observado</label><textarea id="c-obs-'+i+'" class="input-desc" maxlength="500" placeholder="Escribe después lo que has visto o vivido respecto a lo que entendiste...">'+(hr.observado||"")+'</textarea></div>';
  htm+='<div class="btn-group"><button class="btn btn-outline btn-sm" onclick="guardarCuaderno('+i+')">Guardar cambios</button></div></div>';
  htm+='<div class="btn-group mt-8"><button class="btn btn-outline btn-sm" onclick="compartirHist('+i+')">Compartir</button><button class="btn btn-outline btn-sm" onclick="descargarHistMD('+i+')">MD</button><button class="btn btn-outline btn-sm" onclick="descargarHistHTML('+i+')">HTML</button><button class="btn btn-outline btn-sm" onclick="descargarHistAI('+i+')">IA</button><button class="btn btn-danger btn-sm" onclick="eliminarHist('+i+')">Eliminar</button><button class="btn btn-outline btn-sm" onclick="cargarHist()">← Volver</button></div></div>';
  document.getElementById("r-historial").innerHTML=htm;
  if(typeof vozSoporte==="function"&&vozSoporte()){
    var sel=document.querySelector("#r-historial .voz-select");
    if(sel) vozPoblarSelect(sel);
    vozActualizarBarras();
  }
}
function guardarCuaderno(i){
  var h=JSON.parse(lsGet("bats-hist")||"[]");
  if(!h[i])return;
  var anot=document.getElementById('c-anot-'+i)?.value||'';
  var obs=document.getElementById('c-obs-'+i)?.value||'';
  h[i].anotaciones=anot;
  h[i].observado=obs;
  lsSet("bats-hist",JSON.stringify(h));
  toast("Cuaderno actualizado");
}
function updateCounter(el,id){
  var cnt=document.getElementById(id);
  if(cnt)cnt.textContent=el.value.length+'/300';
}
function compartirHist(i){
  var h=JSON.parse(lsGet("bats-hist")||"[]");
  var hr=h[i];if(!hr)return;
  var cartas=hr.cartas;
  var fs=new Date(hr.fecha).toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});
  var md="# "+(hr.titulo||hr.tipo)+"\n\n_Fecha: "+fs+"_";
  if(hr.descripcion)md+="\n\n*"+hr.descripcion+"*";
  if(hr.tipo_rel)md+="\n\n**Tipo de relación:** "+hr.tipo_rel;
  if(hr.situacion)md+="\n\n**Situación:** "+hr.situacion;
  md+="\n\n";
  cartas.forEach(function(it,idx){
    md+="### "+(it.posicion?it.posicion+": ":"")+it.nombre+(it.invertida?" (invertida)":"")+"\n\n"+(it.texto||"—")+"\n\n";
    if(it.comodin&&it.extensionResuelta&&it.extension){
      md+="### ✦ Comodín ∞ → Extensión\n\n";
      it.extension.forEach(function(ex){md+="**"+ex.posicion+":** "+ex.nombre+(ex.invertida?" (invertida)":"")+"\n\n"+(ex.texto||"—")+"\n\n";});
    }
  });
  var q=calcQuinta(cartas);
  if(q){var p=parsearQuinta(textoQuinta(q.nombre)||txt(q,false));md+="### ✦ Quintaesencia\n\n**"+q.nombre+"**\n\n";if(p.lectura) md+=p.lectura+"\n\n";if(p.consejo) md+="**Consejo de acción BATS:** "+p.consejo+"\n\n";if(p.palabraClave) md+="**Palabra clave:** "+p.palabraClave+"\n\n";if(p.antipatron) md+="**Antipatrón:** "+p.antipatron+"\n\n";}
  if(hr.accion)md+="**Acción recomendada:** "+hr.accion+"\n\n";
  if(hr.anotaciones)md+="**Anotaciones:** "+hr.anotaciones+"\n\n";
  if(hr.observado)md+="**Lo observado:** "+hr.observado+"\n\n";
  if(hr._ia)md+="_IA que ha asistido la interpretación: "+hr._ia+"_\n\n";
  md+="_Generado por BATS Tarot_";
  if(isCap()&&Capacitor.Plugins.Share){
    Capacitor.Plugins.Share.share({title:hr.titulo||hr.tipo,text:md}).catch(function(){});
  }else if(navigator.share){
    navigator.share({title:hr.titulo||hr.tipo,text:md}).catch(function(){
      downloadBlob(md,"bats-"+slugify(hr.titulo||hr.tipo)+".md","text/markdown");
    });
  }else{
    downloadBlob(md,"bats-"+slugify(hr.titulo||hr.tipo)+".md","text/markdown");
  }
}
function compartirTirada(){
  if(!window._ult)return;
  var tit=window._lastPanelTitle||"Tirada BATS";
  var f=new Date(),fs=f.toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});
  var md="# "+tit+"\n\n_Fecha: "+fs+"_";
  var panelId=window._lastPanel;
  var desc=document.getElementById('desc-'+panelId)?.value||'';
  var sit=document.getElementById('situacion-'+panelId)?.value||'';
  var acc=document.getElementById('accion-'+panelId)?.value||'';
  var tipo=document.getElementById('tipo-'+panelId)?.value||'';
  if(desc)md+="\n\n*"+desc+"*";
  if(tipo)md+="\n\n**Tipo de relación:** "+tipo;
  if(sit)md+="\n\n**Situación:** "+sit;
  md+="\n\n";
  window._ult.forEach(function(it,i){
    md+="### "+(it.posicion?it.posicion+": ":"")+it.carta.nombre+(it.invertida?" (invertida)":"")+"\n\n"+(it.texto||txt(it.carta,it.invertida)||"—")+"\n\n";
  });
  md+=extensionMd(window._ult);
  var q=calcQuinta(window._ult);
  if(q){var p=parsearQuinta(textoQuinta(q.nombre)||txt(q,false));md+="### ✦ Quintaesencia\n\n**"+q.nombre+"**\n\n";if(p.lectura) md+=p.lectura+"\n\n";if(p.consejo) md+="**Consejo de acción BATS:** "+p.consejo+"\n\n";if(p.palabraClave) md+="**Palabra clave:** "+p.palabraClave+"\n\n";if(p.antipatron) md+="**Antipatrón:** "+p.antipatron+"\n\n";}
  if(window._ult._interp)md+="### ✦ Interpretación\n\n"+window._ult._interp+"\n\n";
  if(window._ult._ia)md+="_IA que ha asistido la interpretación: "+window._ult._ia+"_\n\n";
  if(acc)md+="**Acción recomendada:** "+acc+"\n\n";
  var anot=document.getElementById('anotaciones-'+panelId)?.value||'';
  var obs=document.getElementById('observado-'+panelId)?.value||'';
  if(anot)md+="**Anotaciones:** "+anot+"\n\n";
  if(obs)md+="**Lo observado:** "+obs+"\n\n";
  md+="_Generado por BATS Tarot_";
  if(isCap()&&Capacitor.Plugins.Share){
    Capacitor.Plugins.Share.share({title:tit,text:md}).catch(function(){});
  }else if(navigator.share){
    navigator.share({title:tit,text:md}).catch(function(){
      downloadBlob(md,"bats-"+slugify(tit)+".md","text/markdown");
    });
  }else{
    downloadBlob(md,"bats-"+slugify(tit)+".md","text/markdown");
  }
}
function descargarHistHTML(i){
  var h=JSON.parse(lsGet("bats-hist")||"[]");
  var hr=h[i];if(!hr)return;
  var cartas=reconstruirCartasHist(hr);
  cartas._interp=hr._interp||"";
  cartas._qtext=hr._qtext||"";
  cartas._ia=hr._ia||"";
  descargarHTML(hr.titulo||hr.tipo,cartas,hr.descripcion,hr.situacion,hr.accion,hr.tipo_rel,hr.anotaciones,hr.observado);
}
function descargarHistMD(i){
  var h=JSON.parse(lsGet("bats-hist")||"[]");
  var hr=h[i];if(!hr)return;
  var cartas=reconstruirCartasHist(hr);
  cartas._interp=hr._interp||"";
  cartas._qtext=hr._qtext||"";
  cartas._ia=hr._ia||"";
  descargarMD(hr.titulo||hr.tipo,cartas,hr.descripcion,hr.situacion,hr.accion,hr.tipo_rel,hr.anotaciones,hr.observado);
}
function descargarHistAI(i){
  var h=JSON.parse(lsGet("bats-hist")||"[]");
  var hr=h[i];if(!hr)return;
  var cartas=reconstruirCartasHist(hr);
  descargarAI(hr.titulo||hr.tipo,cartas);
}
function limpiarHist(){
  if(!confirm("\u00bfEliminar todo el historial?")) return;
  lsDel("bats-hist");
  cargarHist();
  toast("Historial eliminado");
}
function eliminarHist(i){
  var h=JSON.parse(lsGet("bats-hist")||"[]");
  if(!h[i]) return;
  var hr=h[i];
  var fs=new Date(hr.fecha).toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric"});
  var titulo=hr.titulo||hr.tipo||"lectura";
  if(!confirm("\u00bfEliminar la lectura \u00ab"+titulo+"\u00bb del "+fs+"?\n\nEsta acci\u00f3n no se puede deshacer.")) return;
  h.splice(i,1);
  lsSet("bats-hist",JSON.stringify(h));
  toast("Lectura eliminada");
  cargarHist();
}

function renderConIA(cartas,dest,renderFn,ctx){
  ctx=ctx||{};
  ctx.fecha=ctx.fecha||new Date().toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric"});
  window._lastCtx=ctx;
  if(typeof vozParar==="function"){try{vozParar()}catch(e){}}
  var panelId=ctx.panelId||window._lastPanel||"tirada";
  var titulo=ctx.titulo||window._lastPanelTitle||"Tirada";
  var modo=(typeof getAIMode==="function")?getAIMode():"off";
  var useCorta=modo!=="off"&&getFlagCorta(panelId);
  var useLarga=modo!=="off"&&getFlagLarga(panelId);
  function finSinIA(){
    window._ocultarReferencias=false;
    try{renderFn()}catch(e){console.error("renderFn:",e)}
    try{ponerBotones(dest,titulo,panelId)}catch(e){console.error("ponerBotones:",e)}
  }
  function falloIA(e){
    console.error("Error textos IA:",e);
    window._ocultarReferencias=false;
    toast((e&&e.message||"Error de IA")+". Se muestran los textos BATS.",true);
    try{renderFn()}catch(e2){console.error("renderFn:",e2)}
    if(useLarga){try{renderInterpLarga(dest,cartas,ctx)}catch(e3){console.error("renderInterpLarga:",e3);toast("Error al iniciar la interpretaci\u00f3n larga: "+(e3&&e3.message||e3),true)}}
    try{ponerBotones(dest,titulo,panelId)}catch(e4){console.error("ponerBotones:",e4)}
  }
  if(modo==="off"||(!useCorta&&!useLarga)){
    finSinIA();
    return;
  }
  if(comodinPendiente(cartas)){
    window._ocultarReferencias=true;
    try{renderFn()}catch(e){console.error("renderFn:",e)}
    try{ponerBotones(dest,titulo,panelId)}catch(e){console.error("ponerBotones:",e)}
    return;
  }
  if(useLarga){
    var el=document.getElementById(dest);
    if(useCorta){
      window._ocultarReferencias=true;
      if(el) el.innerHTML='<div class="ai-cargando"><span class="ai-spinner"></span>Interpretando con IA\u2026</div>';
      generarTextosIA(cartas,ctx).then(function(){
        window._ocultarReferencias=false;
        try{renderFn()}catch(e){console.error("renderFn:",e)}
        try{renderInterpLarga(dest,cartas,ctx)}catch(e){console.error("renderInterpLarga:",e);toast("Error al iniciar la interpretaci\u00f3n larga: "+(e&&e.message||e),true)}
        try{ponerBotones(dest,titulo,panelId)}catch(e){console.error("ponerBotones:",e)}
      }).catch(falloIA);
    } else {
      try{renderFn()}catch(e){console.error("renderFn:",e)}
      try{renderInterpLarga(dest,cartas,ctx)}catch(e){console.error("renderInterpLarga:",e);toast("Error al iniciar la interpretaci\u00f3n larga: "+(e&&e.message||e),true)}
      try{ponerBotones(dest,titulo,panelId)}catch(e){console.error("ponerBotones:",e)}
    }
    return;
  }
  window._ocultarReferencias=true;
  generarTextosIA(cartas,ctx).then(function(){
    window._ocultarReferencias=false;
    try{renderFn()}catch(e){console.error("renderFn:",e)}
    try{ponerBotones(dest,titulo,panelId)}catch(e){console.error("ponerBotones:",e)}
  }).catch(falloIA);
}
function renderInterpLarga(dest,cartas,ctx){
  ctx=ctx||{};
  var el=document.getElementById(dest);
  if(!el) return;
  var cont=document.getElementById("ai-interp-"+dest);
  if(!cont){
    cont=document.createElement("div");
    cont.className="ai-interp";
    cont.id="ai-interp-"+dest;
    el.parentNode.insertBefore(cont,el.nextSibling);
  }
  cont.style.display="";
  cont.innerHTML='<h4 class="ai-interp-title">\u2726 Interpretaci\u00f3n</h4><div class="ai-interp-body"><div class="ai-cargando"><span class="ai-spinner"></span>Generando interpretaci\u00f3n<span class="ai-interp-t"></span>\u2026 <span class="ai-interp-v" style="font-size:.75em;opacity:.6">v'+BATS_VERSION+'</span><span class="ai-interp-status" style="display:block;font-size:.72em;opacity:.75;margin-top:4px"></span></div></div>';
  var body=cont.querySelector(".ai-interp-body")||cont;
  var tEl=body.querySelector(".ai-interp-t");
  var sEl=body.querySelector(".ai-interp-status");
  var ini=Date.now(),tick=null,failsafe=null,acabado=false;
  function limpiar(){acabado=true;if(tick){clearInterval(tick);tick=null}if(failsafe){clearTimeout(failsafe);failsafe=null}}
  function mostrarError(e){
    limpiar();
    try{console.error("Error interpretacion larga:",e)}catch(_){}
    body.innerHTML='<p class="subtle">No se pudo generar la interpretaci\u00f3n'+(e&&e.message?": "+e.message:"")+'</p><div class="ai-interp-btns"><button class="btn btn-outline btn-sm" onclick="reintentarInterp(\''+dest+'\')">Reintentar</button></div>';
  }
  function mostrarOK(t){
    limpiar();
    cartas._interp=t;
    cartas._ia=etiquetaIA()||"";
    body.innerHTML='<div class="ai-interp-texto">'+interpParaHTML(t)+'</div>';
    if(cartas._ia) body.insertAdjacentHTML("beforeend",'<div class="ai-interp-ia">IA que ha asistido la interpretaci\u00f3n: '+escHTML(cartas._ia)+'</div>');
    if(typeof vozSoporte==="function"&&vozSoporte()){
      var vd=String(dest).replace(/"/g,"");
      body.insertAdjacentHTML("beforeend",vozBarHTML(vd));
      VOZ.textos[vd]=vozTextoDe(cartas,ctx);
      vozPoblarSelect(body.querySelector(".voz-select"));
      vozActualizarBarras();
    }
  }
  function tickS(){
    if(!acabado&&tEl) tEl.textContent=" ("+Math.round((Date.now()-ini)/1000)+" s)";
  }
  window._iaStatus=function(s){
    if(acabado) return;
    if(sEl) sEl.textContent=s;
    try{console.log("[BATS-IA]",s)}catch(_){}
  };
  tickS();
  tick=setInterval(tickS,1000);
  failsafe=setTimeout(function(){
    if(acabado) return;
    if(body&&body.querySelector(".ai-spinner")) mostrarError(new Error("La IA tard\u00f3 demasiado. Reintenta."));
  },30000);
  try{
    generarInterpretacionLarga(cartas,ctx).then(function(t){
      mostrarOK(t);
    }).catch(function(e){
      mostrarError(e);
    });
  }catch(e){
    mostrarError(e);
  }
}
function interpParaHTML(t){
  return (t||"").replace(/\*\*/g,"").replace(/^#{1,6}\s*/gm,"").replace(/\*([^*]+)\*/g,"$1").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/\n{3,}/g,"\n\n").replace(/\n/g,"<br>");
}
function escHTML(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function reintentarInterp(dest){
  if(window._ult) renderInterpLarga(dest,window._ult,window._lastCtx||{});
}
function valPanel(id){
  var el=document.getElementById(id);
  return el?el.value:"";
}

var PANELES_IA=["diaria","rel","laboral","pers","aprendizaje"];
function sincronizarFlagsPaneles(){
  PANELES_IA.forEach(function(p){
    var c1=document.getElementById("ia-corta-"+p),c2=document.getElementById("ia-larga-"+p);
    if(c1) c1.checked=getFlagCorta(p);
    if(c2) c2.checked=getFlagLarga(p);
  });
}
function cambiarFlagPanel(panelId,que,chk){
  var c=getFlagCorta(panelId),l=getFlagLarga(panelId);
  if(que==="corta") c=chk.checked; else l=chk.checked;
  setFlagPanel(panelId,c,l);
}
function restablecerFlagsPanel(panelId){
  try{localStorage.removeItem(STORE_PFX+"bats-ia-"+panelId)}catch(e){}
  var c1=document.getElementById("ia-corta-"+panelId),c2=document.getElementById("ia-larga-"+panelId);
  if(c1) c1.checked=getFlagCorta(panelId);
  if(c2) c2.checked=getFlagLarga(panelId);
}

function tirarDiaria(){hacerDiaria(false)}
function tirarDiariaInv(){hacerDiaria(true)}
function hacerDiaria(inv){
  var comodin=document.getElementById("diaria-comodin")&&document.getElementById("diaria-comodin").checked;
  var pos=["Centro: energ\u00eda del d\u00eda","Izquierda: qu\u00e9 frenar o minimizar","Derecha: qu\u00e9 impulsar o hacer","Arriba: ayuda disponible","Abajo: posible salida o resultado"];
  var esSombra=[false,true,false,false,false];
  var m=barajar(añadirComodin(BARAJA.slice(),comodin));
  if(m.length<5) return;
  var c=[];
  for(var i=0;i<5;i++){
    var invC=inv?Math.random()<.5:false;
    var it={carta:m[i],invertida:invC,posicion:pos[i],texto:txt(m[i],invC,esSombra[i])};
    if(esComodin(m[i])){it.comodinEstado="reverso";it.comodinInvertido=invC;it.comodinImg="comodin_reverso.png";if(invC){it.texto=COMODIN_INV_TEXT;}}
    c.push(it);
  }
  window._mazoRestante=m.slice(5);
  window._ult=c;
  window._lastPanel="diaria";
  window._lastPanelTitle="Cruz Diaria";
  renderConIA(c,"r-diaria",function(){
    mostrarCruz(c,"r-diaria",{posiciones:pos});
  },{titulo:"Cruz Diaria",descripcion:valPanel("desc-diaria"),guion:"diaria",panelId:"diaria"});
}

function tirarRelacion(){
  var p1=document.getElementById("rel-p1").value||"Persona 1",p2=document.getElementById("rel-p2").value||"Persona 2";
  lsSet("bats-rel-p1",p1);
  lsSet("bats-rel-p2",p2);
  var tipoRel=document.getElementById("tipo-rel").value||"";
  lsSet("bats-rel-tipo",tipoRel);
  var inv=document.getElementById("rel-inv").checked;
  var comodin=document.getElementById("rel-comodin")&&document.getElementById("rel-comodin").checked;
  var m=barajar(añadirComodin(BARAJA.slice(),comodin));
  if(m.length<4) return;
  var pos=["Energ\u00eda del momento de la relaci\u00f3n","Energ\u00eda de "+p1,"Energ\u00eda de "+p2,"Posible salida o direcci\u00f3n"];
  var c=[];
  for(var i=0;i<4;i++){
    var invC=inv?Math.random()<.5:false;
    var it={carta:m[i],invertida:invC,posicion:pos[i],texto:txt(m[i],invC,false)};
    if(esComodin(m[i])){it.comodinEstado="reverso";it.comodinInvertido=invC;it.comodinImg="comodin_reverso.png";if(invC){it.texto=COMODIN_INV_TEXT;}}
    c.push(it);
  }
  window._mazoRestante=m.slice(4);
  window._ult=c;
  window._lastPanel="rel";
  window._lastPanelTitle="Tirada de la relación";
  renderConIA(c,"r-relacion",function(){
    mostrarCompleto(c,"r-relacion",{posiciones:pos});
  },{titulo:"Tirada de la relaci\u00f3n",descripcion:valPanel("desc-rel"),p1:p1,p2:p2,tipoRel:tipoRel,guion:"rel",panelId:"rel"});
}
function tirarLaboral(){hacerLaboral(false)}
function tirarLaboralInv(){hacerLaboral(true)}
function hacerLaboral(inv){
  var comodin=document.getElementById("laboral-comodin")&&document.getElementById("laboral-comodin").checked;
  var pos=["Centro: energ\u00eda laboral del momento","Izquierda: qu\u00e9 frenar o minimizar en el trabajo","Derecha: qu\u00e9 impulsar o hacer en el trabajo","Arriba: ayuda disponible en el trabajo","Abajo: posible salida o resultado laboral"];
  var esSombra=[false,true,false,false,false];
  var m=barajar(añadirComodin(BARAJA.slice(),comodin));
  if(m.length<5) return;
  var c=[];
  for(var i=0;i<5;i++){
    var invC=inv?Math.random()<.5:false;
    var it={carta:m[i],invertida:invC,posicion:pos[i],texto:txt(m[i],invC,esSombra[i])};
    if(esComodin(m[i])){it.comodinEstado="reverso";it.comodinInvertido=invC;it.comodinImg="comodin_reverso.png";if(invC){it.texto=COMODIN_INV_TEXT;}}
    c.push(it);
  }
  window._mazoRestante=m.slice(5);
  window._ult=c;
  window._lastPanel="laboral";
  window._lastPanelTitle="BATS Laboral";
  renderConIA(c,"r-laboral",function(){
    mostrarCruz(c,"r-laboral",{posiciones:pos});
  },{titulo:"BATS Laboral",descripcion:valPanel("desc-laboral"),guion:"laboral",panelId:"laboral"});
}

function actPos(){  var n=parseInt(document.getElementById("pers-cant").value);
  var cont=document.getElementById("campos-posiciones"),h="",vals={};
  for(var i=1;i<=15;i++){var el=document.getElementById("pers-pos-"+i);if(el) vals[i]=el.value}
  for(var i=1;i<=n;i++) h+='<div class="pos-field"><span class="pos-num">'+(i<10?"0":"")+i+'</span><input type="text" id="pers-pos-'+i+'" value="'+(vals[i]||'Posici\u00f3n '+i)+'"></div>';
  cont.innerHTML=h;
}
actPos();
function configurarComodinCorte(subsetId,comodinId){
  var radios=document.querySelectorAll('input[name="'+subsetId+'"]');
  var chk=document.getElementById(comodinId);
  if(!chk) return;
  radios.forEach(function(r){r.addEventListener("change",function(){
    if(r.value==="corte"&&r.checked){chk.checked=false;chk.disabled=true;}
    else chk.disabled=false;
  });});
}
configurarComodinCorte("aprendizaje-subset","aprendizaje-comodin");
configurarComodinCorte("pers-subset","pers-comodin");
function tirarPers(){
  var n=parseInt(document.getElementById("pers-cant").value);
  var sub=document.querySelector('input[name="pers-subset"]:checked');
  var modo=sub?sub.value:"completo";
  var inv=document.getElementById("pers-inv").checked;
  var comodin=document.getElementById("pers-comodin")&&document.getElementById("pers-comodin").checked;
  var titulo=document.getElementById("pers-titulo").value.trim()||"Tirada Personalizada";
  var mazo=crearSub(modo);
  mazo=barajar(añadirComodin(mazo,comodin));
  var c=[];
  var dealt=mazo.slice(0,n);
  for(var i=0;i<n;i++){
    var invC=inv?Math.random()<.5:false;
    var el=document.getElementById("pers-pos-"+(i+1));
    var it={carta:dealt[i],invertida:invC,posicion:el?el.value:"Posici\u00f3n "+(i+1),texto:txt(dealt[i],invC,false)};
    if(esComodin(dealt[i])){it.comodinEstado="reverso";it.comodinInvertido=invC;it.comodinImg="comodin_reverso.png";if(invC){it.texto=COMODIN_INV_TEXT;}}
    c.push(it);
  }
  window._mazoRestante=mazo.slice(n);
  window._ult=c;
  window._lastPanel="pers";
  window._lastPanelTitle=titulo;
  renderConIA(c,"r-pers",function(){
    mostrarCompleto(c,"r-pers");
  },{titulo:titulo,descripcion:valPanel("desc-pers"),guion:"pers",panelId:"pers"});
}

function tirarAprendizaje(){hacerAprendizaje(document.getElementById("aprendizaje-inv").checked)}
function hacerAprendizaje(inv){
  var sub=document.querySelector('input[name="aprendizaje-subset"]:checked');
  var modo=sub?sub.value:"completo";
  var comodin=document.getElementById("aprendizaje-comodin")&&document.getElementById("aprendizaje-comodin").checked;
  var mazo=crearSub(modo);
  var sit=document.getElementById("situacion-aprendizaje").value.trim();
  if(!sit){toast("Describe la situación que quieres comprender",true);return}
  var m=barajar(añadirComodin(mazo,comodin));
  if(m.length<6) return;
  var pos=[
    "El Hecho — ¿Qué ha ocurrido realmente?",
    "El Maestro — ¿Qué me está mostrando realmente esta experiencia?",
    "El Punto Ciego — ¿Qué no estoy viendo o qué interpretación me impide aprender?",
    "La Integración — ¿Qué comprensión quiere integrarse en mí?",
    "El Don Transformador — ¿Qué capacidad, virtud o cambio nace cuando integro esta verdad?",
    "El Resultado Posible — ¿Qué transformación ocurrirá en mi experiencia si integro la lección?"
  ];
  var esSom=[false,false,true,false,false,false];
  var c=[];
  for(var i=0;i<6;i++){
    var invC=inv?Math.random()<.5:false;
    var it={carta:m[i],invertida:invC,posicion:pos[i],texto:txt(m[i],invC,esSom[i])};
    if(esComodin(m[i])){it.comodinEstado="reverso";it.comodinInvertido=invC;it.comodinImg="comodin_reverso.png";if(invC){it.texto=COMODIN_INV_TEXT;}}
    c.push(it);
  }
  window._mazoRestante=m.slice(6);
  window._ult=c;
  window._lastPanel="aprendizaje";
  window._lastPanelTitle="El Aprendizaje";
  renderConIA(c,"r-aprendizaje",function(){
    mostrarCompleto(c,"r-aprendizaje",{posiciones:pos});
  },{titulo:"El Aprendizaje",situacion:sit,guion:"aprendizaje",panelId:"aprendizaje"});
}

function tirarVisitante(){
  var fnac=document.getElementById("av-fecha-nac").value.trim();
  var nombre=document.getElementById("av-nombre").value.trim();
  if(!fnac){toast("Introduce tu fecha de nacimiento (DD/MM/AAAA)",true);return}
  if(!nombre){toast("Introduce tu nombre completo",true);return}
  var fnacParts=fnac.split("/");
  if(fnacParts.length!==3||fnacParts[0].length!==2||fnacParts[1].length!==2||fnacParts[2].length!==4){
    toast("Formato de fecha: DD/MM/AAAA",true);return;
  }
  var testDate=new Date(fnacParts[2],fnacParts[1]-1,fnacParts[0]);
  if(isNaN(testDate.getTime())||testDate.getDate()!=fnacParts[0]||testDate.getMonth()!=fnacParts[1]-1){
    toast("Fecha de nacimiento no válida",true);return;
  }
  lsSet("av-nacimiento",fnac);
  lsSet("av-nombre",nombre);
  var hoy=new Date();
  var dd=z(hoy.getDate())+"/"+z(hoy.getMonth()+1)+"/"+hoy.getFullYear();
  var num=calcArcanoNum(fnac,dd,nombre);
  if(!num){toast("No se pudo calcular el arcano",true);return}
  var carta=TABLA_78[num-1];
  if(!carta){toast("Error en la tabla de arcanos",true);return}
  var d=batsDe(carta);
  var pos="El Arcano Visitante del día";
  var c=[{carta:carta,invertida:false,posicion:pos,texto:txt(carta,false)}];
  window._ult=c;
  window._lastPanel="arcano-visitante";
  window._lastPanelTitle="El Arcano Visitante";
  window._lastCtx={guion:"arcano",titulo:"El Arcano Visitante",fecha:new Date().toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric"}),numero:num};
  if(typeof getAIMode!=="undefined"&&getAIMode()!=="off"){
    var rres=document.getElementById("r-arcano-visitante");
    rres.innerHTML='<div class="ai-cargando"><span class="ai-spinner"></span>Interpretando con IA\u2026</div>';
    generarIAVisitante(carta).then(function(t){
      c._avtexts=t;
      renderAV(carta,num,d,fnac,nombre,dd,t);
      try{renderInterpLarga("r-arcano-visitante",c,window._lastCtx)}catch(e){console.error("renderInterpLarga AV:",e);toast("Error al iniciar la interpretaci\u00f3n larga: "+(e&&e.message||e),true)}
    }).catch(function(e){
      toast((e&&e.message||"Error de IA")+". Se muestran los textos BATS.",true);
      renderAV(carta,num,d,fnac,nombre,dd,null);
      try{renderInterpLarga("r-arcano-visitante",c,window._lastCtx)}catch(e2){console.error("renderInterpLarga AV:",e2)}
    });
  }else{
    renderAV(carta,num,d,fnac,nombre,dd,null);
  }
}
function renderAV(carta,num,d,fnac,nombre,dd,texts){
  texts=texts||null;
  var res=document.getElementById("r-arcano-visitante");
  var html='<div class="result-box">';
  html+='<div class="q-box"><div class="q-label">✦ TU ARCANO DEL DÍA</div><div class="q-inner">'+imgCard(carta)+'<div><div class="q-name">'+(num<=21?"XIIII".substring(0,num).replace(/^(X*)(I{0,3})(IV|V|VI{0,3})$/,"$1$2$3"):num===22?"0/XXII":num)+" — "+carta.nombre+'</div></div></div></div>';
  html+='<div class="av-calc"><strong>Cálculo:</strong> '+fnac.replace(/\//g,"+").replace(/\+/g," + ")+" + "+dd.replace(/\//g,"+").replace(/\+/g," + ")+" + "+normalizarNombre(nombre)+" = <strong>"+num+"</strong></div>";
  html+='<div class="av-questions">';
  html+='<div class="card-result"><div class="pos-name">¿Qué vienes a mostrarme hoy?</div><div class="card-msg">'+(texts?(texts.q1||"—"):(d?d.normal:"—"))+'</div></div>';
  html+='<div class="card-result"><div class="pos-name">¿Qué patrón conocido me estás ayudando a no repetir hoy?</div><div class="card-msg">'+(texts?(texts.q2||"—"):(d?d.sombra||d.normal:"—"))+'</div></div>';
  html+='<div class="card-result"><div class="pos-name">¿Qué acción consciente me ayuda a escucharte?</div><div class="card-msg">'+(texts?(texts.q3||"—"):(d?d.ayuda||d.normal:"—"))+'</div></div>';
  html+='</div>';
  html+='<div class="ai-interp" id="ai-interp-r-arcano-visitante"></div>';
  html+='<div class="cuaderno-section"><h4 style="color:var(--gold);margin:12px 0 6px;font-size:.9rem">Cuaderno de reflexiones</h4>';
  html+='<div class="form-group"><label for="anotaciones-arcano-visitante">Anotaciones</label><div class="char-counter"><textarea id="anotaciones-arcano-visitante" class="input-desc" maxlength="300" placeholder="Escribe lo que consideres..." oninput="var c=document.getElementById(\'cnt-av\');if(c)c.textContent=this.length+\'/300\'"></textarea><span class="counter-text" id="cnt-av">0/300</span></div></div>';
  html+='<div class="form-group"><label for="observado-arcano-visitante">Lo observado</label><textarea id="observado-arcano-visitante" class="input-desc" maxlength="500" placeholder="Escribe después lo que has visto o vivido..."></textarea></div>';
  html+='</div>';
  html+='<div class="av-disclaimer">El tarot no predice el futuro. Muestra patrones. La decisión siempre es tuya.</div>';
  html+='</div>';
  res.innerHTML=html;
  var btns='<div class="btn-group mt-8">';
  btns+='<button class="btn btn-outline btn-sm" onclick="descargarAV(\'md\')">Descargar MD</button>';
  btns+='<button class="btn btn-outline btn-sm" onclick="descargarAV(\'html\')">Descargar HTML</button>';
  btns+='<button class="btn btn-outline btn-sm" onclick="compartirAV()">Compartir</button>';
  btns+='<button class="btn btn-outline btn-sm" onclick="guardarHist(\'El Arcano Visitante\',window._ult,\'\',\'El Arcano Visitante\')">Guardar</button>';
  btns+='</div>';
  res.insertAdjacentHTML("beforeend",btns);
}
function descargarAV(fmt){
  var anot=document.getElementById('anotaciones-arcano-visitante')?.value||'';
  var obs=document.getElementById('observado-arcano-visitante')?.value||'';
  if(!window._ult||!window._ult[0])return;
  var c=window._ult[0].carta;
  var num=null;
  for(var i=0;i<TABLA_78.length;i++){if(TABLA_78[i]===c){num=i+1;break}}
  var d=batsDe(c);
  var f=new Date(),fs=f.toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});
  var fnac=document.getElementById("av-fecha-nac")?.value||lsGet("av-nacimiento")||"";
  var nombre=document.getElementById("av-nombre")?.value||lsGet("av-nombre")||"";
  var inAV=window._ult._interp||"";
  if(fmt==="md"){
    var md="# El Arcano Visitante\n\n_Fecha: "+fs+"_";
    md+="\n\n**Arcano:** "+num+" — "+c.nombre;
    md+="\n\n**Fecha de nacimiento:** "+fnac;
    md+="\n\n**Nombre:** "+nombre;
    md+="\n\n---\n\n";
    var ts=c._avtexts||null;
    md+="### ¿Qué vienes a mostrarme hoy?\n\n"+(ts&&ts.q1?ts.q1:(d?d.normal:"—"))+"\n\n";
    md+="### ¿Qué patrón conocido me estás ayudando a no repetir hoy?\n\n"+(ts&&ts.q2?ts.q2:(d?d.sombra||d.normal:"—"))+"\n\n";
    md+="### ¿Qué acción consciente me ayuda a escucharte?\n\n"+(ts&&ts.q3?ts.q3:(d?d.ayuda||d.normal:"—"))+"\n\n";
    if(inAV)md+="### ✦ Interpretación\n\n"+inAV+"\n\n";
    if(window._ult._ia)md+="_IA que ha asistido la interpretación: "+window._ult._ia+"_\n\n";
    if(anot)md+="**Anotaciones:** "+anot+"\n\n";
    if(obs)md+="**Lo observado:** "+obs+"\n\n";
    md+="_Generado por BATS Tarot_";
    downloadBlob(md,"bats-arcano-visitante.md","text/markdown");
  }else{
    var html='<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>El Arcano Visitante - BATS</title>';
    html+='<style>body{font-family:sans-serif;background:#0d0a13;color:#e8dcc8;padding:20px;max-width:800px;margin:0 auto}h1{color:#d4a847}h3{color:#d4a847;margin-top:16px}.ct{color:#b8a898;font-size:.9rem;line-height:1.5;margin:4px 0 12px}.ia{color:#8a7f6a;font-size:.72rem;margin:4px 0 12px}.foot{color:#666;font-size:.8rem;text-align:center;margin-top:24px}img{width:120px;border-radius:8px;border:2px solid #2a1a3e}</style></head><body>';
    html+='<h1>El Arcano Visitante</h1><p style="color:#b8a898"><em>'+fs+'</em></p>';
    html+='<p><strong>'+num+" — "+c.nombre+'</strong></p><p style="color:#b8a898">Nacimiento: '+fnac+' · Nombre: '+nombre+'</p>';
    html+='<img src="'+BATS_BASE+c.img+'" alt="'+c.nombre+'">';
    var ts=c._avtexts||null;
    html+='<h3>¿Qué vienes a mostrarme hoy?</h3><div class="ct">'+(ts&&ts.q1?ts.q1:(d?d.normal:"—"))+'</div>';
    html+='<h3>¿Qué patrón conocido me estás ayudando a no repetir hoy?</h3><div class="ct">'+(ts&&ts.q2?ts.q2:(d?d.sombra||d.normal:"—"))+'</div>';
    html+='<h3>¿Qué acción consciente me ayuda a escucharte?</h3><div class="ct">'+(ts&&ts.q3?ts.q3:(d?d.ayuda||d.normal:"—"))+'</div>';
    if(inAV)html+='<h3>✦ Interpretación</h3><div class="ct">'+interpParaHTML(inAV)+'</div>';
    if(window._ult._ia)html+='<p class="ia">IA que ha asistido la interpretación: '+escHTML(window._ult._ia)+'</p>';
    if(anot)html+='<h3>Anotaciones</h3><div class="ct">'+anot+'</div>';
    if(obs)html+='<h3>Lo observado</h3><div class="ct">'+obs+'</div>';
    html+='<p class="foot">Generado por BATS Tarot</p></body></html>';
    downloadBlob(html,"bats-arcano-visitante.html","text/html");
  }
}
function compartirAV(){
  var anot=document.getElementById('anotaciones-arcano-visitante')?.value||'';
  var obs=document.getElementById('observado-arcano-visitante')?.value||'';
  if(!window._ult||!window._ult[0])return;
  var c=window._ult[0].carta;
  var num=null;
  for(var i=0;i<TABLA_78.length;i++){if(TABLA_78[i]===c){num=i+1;break}}
  var d=batsDe(c);
  var f=new Date(),fs=f.toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});
  var md="# El Arcano Visitante\n\n_Fecha: "+fs+"_";
  md+="\n\n**Arcano:** "+num+" — "+c.nombre;
  md+="\n\n### ¿Qué vienes a mostrarme hoy?\n\n"+(c._avtexts&&c._avtexts.q1?c._avtexts.q1:(d?d.normal:"—"))+"\n\n";
  md+="### ¿Qué patrón conocido me estás ayudando a no repetir hoy?\n\n"+(c._avtexts&&c._avtexts.q2?c._avtexts.q2:(d?d.sombra||d.normal:"—"))+"\n\n";
  md+="### ¿Qué acción consciente me ayuda a escucharte?\n\n"+(c._avtexts&&c._avtexts.q3?c._avtexts.q3:(d?d.ayuda||d.normal:"—"))+"\n\n";
  if(window._ult._interp)md+="### ✦ Interpretación\n\n"+window._ult._interp+"\n\n";
  if(window._ult._ia)md+="_IA que ha asistido la interpretación: "+window._ult._ia+"_\n\n";
  if(anot)md+="**Anotaciones:** "+anot+"\n\n";
  if(obs)md+="**Lo observado:** "+obs+"\n\n";
  md+="_Generado por BATS Tarot_";
  if(isCap()&&Capacitor.Plugins.Share){Capacitor.Plugins.Share.share({title:"El Arcano Visitante",text:md}).catch(function(){})}
  else if(navigator.share){navigator.share({title:"El Arcano Visitante",text:md}).catch(function(){downloadBlob(md,"bats-arcano-visitante.md","text/markdown")})}
  else{downloadBlob(md,"bats-arcano-visitante.md","text/markdown")}
}

function buscarAyuda(){
  var q=document.getElementById("ayuda-q").value.toLowerCase().trim();
  var cont=document.getElementById("r-ayuda");
  if(!q){mostrarTodas();return}
  var res=[];
  BARAJA.forEach(function(c){
    var d=batsDe(c);if(!d)return;
    var txts=(c.nombre+" "+(c.nucleo||"")+" "+c.tipo).toLowerCase();
    var enc=txts.indexOf(q)>=0;
    if(!enc) enc=!!(["normal","sombra","ayuda","invertida"].filter(function(cp){return d[cp]&&d[cp].toLowerCase().indexOf(q)>=0}).length);
    if(enc) res.push({carta:c,datos:d});
  });
  if(!res.length){cont.innerHTML='<p class="subtle">No se encontraron cartas con "'+q+'".</p>';return}
  var htm='<p class="subtle">'+res.length+' carta(s):</p>';
  res.forEach(function(r){
    var c=r.carta,d=r.datos;
    htm+='<div class="resultado-ayuda-item"><div style="display:flex;gap:10px;align-items:start;margin-bottom:6px">'+imgCard(c)+'<div><h3>'+c.nombre+'</h3><span class="subtle">'+(c.tipo==="arcano"?"Arcano Mayor":c.nucleo)+'</span></div></div>';
    if(d.normal) htm+='<div class="campo"><strong>Normal</strong><p>'+d.normal+'</p></div>';
    if(d.sombra) htm+='<div class="campo"><strong>Sombra</strong><p>'+d.sombra+'</p></div>';
    if(d.ayuda) htm+='<div class="campo"><strong>Ayuda</strong><p>'+d.ayuda+'</p></div>';
    if(d.invertida) htm+='<div class="campo"><strong>Invertida</strong><p>'+d.invertida+'</p></div>';
    htm+='</div>';
  });
  cont.innerHTML=htm;
}
function mostrarTodas(){
  var cont=document.getElementById("r-ayuda"),htm="";
  var grps={arcano:"Arcanos Mayores",bastos:"Bastos",copas:"Copas",espadas:"Espadas",oros:"Oros"};
  Object.keys(grps).forEach(function(tipo){
    var cartas=BARAJA.filter(function(c){return tipo==="arcano"?c.tipo==="arcano":c.tipo===tipo});
    if(!cartas.length) return;
    htm+='<h3 style="color:var(--gold);margin:12px 0 6px;font-size:1rem">'+grps[tipo]+'</h3>';
    cartas.forEach(function(c){
      var d=batsDe(c);if(!d)return;
      htm+='<div class="resultado-ayuda-item"><div style="display:flex;gap:10px;align-items:start;margin-bottom:6px">'+imgCard(c)+'<div><h3>'+c.nombre+'</h3></div></div>';
      if(d.normal) htm+='<div class="campo"><strong>Normal</strong><p>'+d.normal+'</p></div>';
      if(d.sombra) htm+='<div class="campo"><strong>Sombra</strong><p>'+d.sombra+'</p></div>';
      if(d.ayuda) htm+='<div class="campo"><strong>Ayuda</strong><p>'+d.ayuda+'</p></div>';
      if(d.invertida) htm+='<div class="campo"><strong>Invertida</strong><p>'+d.invertida+'</p></div>';
      htm+='</div>';
    });
  });
  cont.innerHTML=htm;
}

function compVersiones(a,b){
  var pa=a.split(".").map(Number),pb=b.split(".").map(Number);
  for(var i=0;i<3;i++){
    var x=pa[i]||0,y=pb[i]||0;
    if(x!==y) return x>y?1:-1;
  }
  return 0;
}
function checkNovedades(){
  fetch('novedades.json?t='+Date.now()).then(function(r){return r.json()}).then(function(d){
    var visto=lsGet('bats-novedades-vista')||'';
    if(!d.ultima||d.ultima===visto) return;
    var texto='';
    if(d.historial){
      var claves=Object.keys(d.historial).sort(function(a,b){return compVersiones(b,a)});
      var contado=0;
      claves.forEach(function(v){
        if(contado>=2) return;
        if(visto===''||compVersiones(v,visto)>0){
          var h=d.historial[v];
          if(contado>0) texto+='<div class="nov-sep"></div>';
          texto+='<h4>'+h.titulo+'</h4><div>'+h.texto+'</div>';
          contado++;
        }
      });
    }
    if(!texto) texto=d.texto||'';
    var m=document.createElement('div');
    m.className='novedades-modal';
    m.innerHTML='<div class="novedades-box"><h3>'+(d.titulo||'Novedades')+'</h3><div class="novedades-texto">'+texto+'</div><button class="btn btn-gold" onclick="this.closest(\'.novedades-modal\').remove();marcarNovedadesVista(\''+d.ultima+'\')">Entendido</button></div>';
    document.body.appendChild(m);
  }).catch(function(){});
}

function marcarNovedadesVista(v){lsSet("bats-novedades-vista",v)}

function initSW(){
  checkNovedades();
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('service-worker.js').then(function(reg){
      reg.addEventListener('updatefound', function(){
        var sw = reg.installing;
        sw.addEventListener('statechange', function(){
          if(sw.state === 'installed' && navigator.serviceWorker.controller){
            var banner = document.createElement('div');
            banner.className = 'update-banner';
            banner.innerHTML = 'Nueva versi\u00f3n disponible <button onclick="location.reload()">Actualizar</button>';
            document.body.appendChild(banner);
          }
        });
      });
    });
  }
}

var ADMIN_URL_KEY="b3a2b557191caaaf8e5c246b";
var _adminState={config:null,defaults:null,available:null,providerInfo:null,providerHealth:null,systemDefaults:null,draft:null,maxProviders:null,aiFlags:null};
var ADMIN_SISTEMAS_CFGKEY={
  diaria:"systemDiaria",
  rel:"systemRel",
  laboral:"systemLaboral",
  aprendizaje:"systemAprendizaje",
  pers:"systemPers",
  av:"systemAV",
  larga:"systemLarga"
};

function initAdmin(){
  var box=document.getElementById("admin-box");
  if(!box) return;
  var params=new URLSearchParams(location.search);
  if(params.get("admin")!==ADMIN_URL_KEY) return;
  box.style.display="block";
  var tok=adminGetToken();
  if(tok) adminEntrar(tok);
}
function adminDesbloquear(){
  var pass=document.getElementById("admin-pass").value.trim();
  if(!pass){adminMsg("Escribe la contrase\u00f1a de administrador.",true);return}
  adminEntrar(pass);
}
function adminEntrar(token){
  adminMsg("Entrando\u2026");
  adminGetConfig(token).then(function(data){
    adminSetToken(token);
    _adminState.config=data.config||{};
    _adminState.defaults=data.defaults||["groq","google","openrouter","mistral"];
    _adminState.available=data.available||[];
    _adminState.providerInfo=data.providerInfo||[];
    _adminState.providerHealth=data.providerHealth||{};
    _adminState.systemDefaults=data.systemDefaults||{};
    _adminState.aiFlags=data.aiFlags||{useCorta:true,useLarga:true};
    _adminState.maxProviders=data.maxProviders||5;
    adminSembrarDraft();
    document.getElementById("admin-box").style.display="none";
    document.getElementById("admin-pass").value="";
    document.getElementById("admin-panel").style.display="block";
    adminPoblar();
    adminMsg("Sesi\u00f3n iniciada como administradora. Edita y pulsa \u00abGuardar cambios\u00bb.");
  },function(e){
    adminClearToken();
    adminMsg((e&&e.message)||"No se pudo entrar. Comprueba la contrase\u00f1a.",true);
  });
}
function adminCerrar(){
  adminClearToken();
  _adminState.config=null;
  _adminState.draft=null;
  document.getElementById("admin-panel").style.display="none";
  document.getElementById("admin-box").style.display="block";
  adminMsg("");
  toast("Sesi\u00f3n de administraci\u00f3n cerrada");
}
function adminMsg(msg,err){
  var el=document.getElementById("admin-msg");
  if(!el) return;
  el.textContent=msg;
  el.style.color=err?"var(--danger,#e74c3c)":"var(--gold,#c9a45c)";
}
function adminTab(id){
  var bas=id==="basico";
  document.getElementById("admin-tab-basico").style.display=bas?"block":"none";
  document.getElementById("admin-tab-avanzado").style.display=bas?"none":"block";
  document.getElementById("admin-tab-btn-basico").classList.toggle("active",bas);
  document.getElementById("admin-tab-btn-avanzado").classList.toggle("active",!bas);
}
function adminTempVal(){
  var el=document.getElementById("admin-temp");
  var v=parseFloat(el.value);
  document.getElementById("admin-temp-val").textContent=v.toFixed(1);
}
function adminNombres(){
  var names={};
  (_adminState.available||[]).forEach(function(p){names[p.id]=p.nombre||p.name||p.id});
  return names;
}
/* ============ ESTADO EDITABLE DEL PROVIDER MANAGER ============
   _adminState.draft es la ÚNICA fuente de verdad editable.
   - Se siembra desde providerInfo en cada carga válida (adminEntrar / adminRefresh)
     y se reemplaza EXPLÍCITAMENTE por el snapshot nuevo en cada refresh.
   - Los inputs escriben directamente en el draft (sin re-render destructivo).
   - Guardar y Probar serializan el draft; ninguna función de render lo reconstruye.
================================================================ */
function adminDraft(){
  return _adminState.draft||[];
}
/* Contrato de credenciales: secretRef es el NOMBRE del Cloudflare Secret en
   MAYÚSCULAS (ej: GROQ_API_KEY). Un valor de credencial real (gsk_, sk-...)
   nunca es un identificador válido y jamás debe persistirse ni mostrarse. */
var _SECRET_REF_PATTERN=/^[A-Z][A-Z0-9_]{1,63}$/;
function _patronSecretRefOK(v){return typeof v==="string"&&_SECRET_REF_PATTERN.test(v)}
function adminClonProvider(p){
  p=p||{};
  var enabled=typeof p.enabled==="boolean"?p.enabled:(p.active!==false);
  return {
    id:p.id||("custom_"+Date.now()+"_"+Math.random().toString(36).slice(2,6)),
    name:p.name||"",
    url:p.url||"",
    model:p.model||"",
    secretRef:_patronSecretRefOK(p.secretRef)?p.secretRef:"",
    enabled:enabled,
    hasKey:p.hasKey===true,
    extra:(p.extra&&typeof p.extra==="object")?Object.assign({},p.extra):{}
  };
}
/* El draft es una copia de trabajo: nunca comparte referencias con providerInfo. */
function adminSembrarDraft(){
  var info=Array.isArray(_adminState.providerInfo)?_adminState.providerInfo:[];
  _adminState.draft=info.map(adminClonProvider);
  return _adminState.draft;
}
function adminProviderConfig(p){
  var sref=(p.secretRef||"").trim();
  return {
    id:p.id,
    name:(p.name||"").trim(),
    url:(p.url||"").trim(),
    model:(p.model||"").trim(),
    secretRef:_patronSecretRefOK(sref)?sref:"",
    extra:p.extra||{}
  };
}
/* Serializa el draft para el Worker. NUNCA descarta filas en silencio.
   Un secretRef que no sea un identificador válido nunca viaja al Worker. */
function adminSerializarDraft(){
  return adminDraft().map(function(p){
    var sref=(p.secretRef||"").trim();
    var o={
      id:p.id,
      name:(p.name||"").trim(),
      url:(p.url||"").trim(),
      model:(p.model||"").trim(),
      secretRef:_patronSecretRefOK(sref)?sref:"",
      enabled:p.enabled!==false
    };
    if(p.extra&&Object.keys(p.extra).length) o.extra=Object.assign({},p.extra);
    return o;
  });
}
/* Devuelve null si el draft es guardable, o el mensaje exacto del problema.
   La credencial: los proveedores por defecto no necesitan nombre (el Worker
   usa el de fábrica); un nombre escrito debe ser un identificador válido. */
function adminValidarDraft(){
  var d=adminDraft();
  if(!d.length) return "Debe haber al menos un proveedor";
  var defs=_adminState.defaults||[];
  for(var i=0;i<d.length;i++){
    var p=d[i];
    if(p.enabled===false) continue;
    var falt=[];
    if(!(p.url||"").trim()||!/^https:\/\//i.test((p.url||"").trim())) falt.push("URL (https)");
    if(!(p.model||"").trim()) falt.push("Modelo");
    var sref=(p.secretRef||"").trim();
    if(sref&&!_patronSecretRefOK(sref)){
      return "Proveedor "+(i+1)+" ("+(p.name||p.id)+"): el «Nombre del Cloudflare Secret» solo admite MAYÚSCULAS, números y _ (ej: GROQ_API_KEY). El valor de la clave no se introduce aquí.";
    }
    if(!sref&&defs.indexOf(p.id)===-1) falt.push("Credencial");
    if(falt.length) return "Proveedor "+(i+1)+" ("+(p.name||p.id)+"): falta "+falt.join(", ");
  }
  return null;
}
/* Escribe un campo del draft y refresca SOLO el label de estado de ese card. */
function adminCambio(i,campo,valor){
  var p=adminDraft()[i];
  if(!p) return;
  if(campo) p[campo]=valor;
  adminPintarEstado(i);
}
/* Pinta el label de estado del card i. Acepta el elemento para poder usarse
   también durante el render (cuando el nodo aún no está en el documento). */
function adminPintarEstado(i,el){
  var p=adminDraft()[i];
  if(!p) return;
  var statusEl=el||document.getElementById("prov-status-"+i);
  if(!statusEl) return;
  var health=(_adminState.providerHealth||{})[p.id]||{};
  var hasKey=p.hasKey||false;
  var lastOk=health.ok===true;
  var hasTest=!!health.lastTest;
  var txt,color;
  if(!hasKey){txt="\u2718 sin key";color="var(--danger,#e74c3c)"}
  else if(p.enabled===false){txt="off";color="var(--muted,#888)"}
  else if(hasTest&&lastOk){txt="\u2713 OK";color="#2ecc71"}
  else if(hasTest&&!lastOk){txt="\u2718 fallo";color="var(--danger,#e74c3c)"}
  else{txt="sin probar";color="var(--muted,#888)"}
  statusEl.textContent=txt;
  statusEl.style.color=color;
}
function adminMover(i,dir){
  var providers=adminDraft().slice();
  var j=i+dir;
  if(j<0||j>=providers.length) return;
  var t=providers[i];providers[i]=providers[j];providers[j]=t;
  _adminState.draft=providers;
  adminPoblar();
}
function adminQuitar(i){
  var providers=adminDraft().slice();
  if(providers.length<=1){adminMsg("Debe haber al menos un proveedor",true);return}
  providers.splice(i,1);
  _adminState.draft=providers;
  adminPoblar();
}
function adminAnadir(){
  var providers=adminDraft().slice();
  var maxP=_adminState.maxProviders||5;
  if(providers.length>=maxP){adminMsg("M\u00e1ximo "+maxP+" proveedores",true);return}
  var n=providers.length+1;
  providers.push({id:"custom_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:"Proveedor "+n,url:"https://",model:"",secretRef:"",enabled:false,extra:{}});
  _adminState.draft=providers;
  adminPoblar();
}
function adminGuardar(){
  var err=adminValidarDraft();
  if(err){adminMsg(err,true);return}
  var cfg={};
  cfg.providers=adminSerializarDraft();
  cfg.temperature=parseFloat(document.getElementById("admin-temp").value);
  cfg.maxTokens=parseInt(document.getElementById("admin-maxtok").value,10)||4096;
  cfg.lenDefault=document.getElementById("admin-len").value;
  var elUC=document.getElementById("admin-use-corta"),elUL=document.getElementById("admin-use-larga");
  cfg.useCorta=elUC?elUC.checked:true;
  cfg.useLarga=elUL?elUL.checked:true;
  for(var g in ADMIN_SISTEMAS_CFGKEY){
    var elS=document.getElementById("admin-sys-"+g);
    if(!elS) continue;
    var val=elS.value;
    if(val!==(_adminState.systemDefaults||{})[g]) cfg[ADMIN_SISTEMAS_CFGKEY[g]]=val;
  }
  var tok=adminGetToken();
  adminMsg("Guardando\u2026");
  adminSaveConfig(tok,cfg).then(function(data){
    _adminState.config=(data&&data.config)||cfg;
    if(data&&data.config){
      _adminState.aiFlags={useCorta:data.config.useCorta!==false,useLarga:data.config.useLarga!==false};
    }
    if(typeof setAIFlagsLocal==="function") setAIFlagsLocal(_adminState.aiFlags);
    var warns=(data&&data.warnings)||[];
    adminRefresh();
    var msg="\u2713 Cambios guardados. Ya est\u00e1n aplicados para todas las tiradas.";
    if(warns.length) msg+=" \u26a0 El servidor descart\u00f3 "+warns.length+" proveedor(es): "+adminResumenWarnings(warns);
    adminMsg(msg,warns.length>0);
  },function(e){
    var extra=(e&&e.details&&e.details.length)?" "+adminResumenWarnings(e.details):"";
    adminMsg(((e&&e.message)||"No se pudieron guardar los cambios.")+extra,true);
  });
}
/* Nada se descarta en silencio: el Worker devuelve el detalle de lo rechazado. */
function adminResumenWarnings(warns){
  return (warns||[]).map(function(w){
    var id=w&&w.id?w.id:("\u00edndice "+(w&&w.index));
    return id+": "+((w&&w.reason)||"descartado");
  }).join("; ");
}
function adminRestaurarSistema(g){
  var el=document.getElementById("admin-sys-"+g);
  if(el){el.value=(_adminState.systemDefaults||{})[g]||"";toast("Instrucciones originales restauradas")}
}
function adminRestaurarTodo(){
  if(!confirm("\u00bfVolver a los valores originales de f\u00e1brica para la IA de todos los usuarios?")) return;
  var tok=adminGetToken();
  adminSaveConfig(tok,{}).then(function(){
    _adminState.config={};
    _adminState.aiFlags={useCorta:true,useLarga:true};
    if(typeof setAIFlagsLocal==="function") setAIFlagsLocal({useCorta:true,useLarga:true});
    adminRefresh();
    adminMsg("\u2713 Valores originales restaurados.");
  },function(e){
    adminMsg((e&&e.message)||"No se pudieron restaurar los valores.",true);
  });
}

/* ============ PROVIDER MANAGEMENT v2 ============ */

function adminRefresh(){
  var tok=adminGetToken();
  if(!tok) return;
  adminGetConfig(tok).then(function(data){
    _adminState.config=data.config||{};
    _adminState.defaults=data.defaults||["groq","google","openrouter","mistral"];
    _adminState.available=data.available||[];
    _adminState.providerInfo=data.providerInfo||[];
    _adminState.providerHealth=data.providerHealth||{};
    _adminState.maxProviders=data.maxProviders||5;
    adminSembrarDraft();
    adminPoblar();
  },function(){});
}
function adminTestProvider(idx){
  var tok=adminGetToken();
  if(!tok){adminMsg("Sesi\u00f3n no v\u00e1lida",true);return}
  var p=adminDraft()[idx];
  if(!p){adminMsg("Proveedor no encontrado",true);return}
  adminMsg("Probando "+(p.name||p.id)+"\u2026");
  adminFetch("POST",tok,{endpoint:"/api/provider-test",body:{providerConfig:adminProviderConfig(p)}}).then(function(data){
    var ok=data.ok;
    var msg=(ok?"\u2713":"\u2718")+" "+(p.name||p.id)+": ";
    if(ok){
      msg+=data.status+" OK \u2014 "+data.latency+"ms";
      if(data.modelReal) msg+=" \u2014 modelo: "+data.modelReal;
    }else{
      msg+=(data.error||data.status||"fallo")+" ("+(data.category||"")+")";
    }
    adminMsg(msg,!ok);
    if(!_adminState.providerHealth) _adminState.providerHealth={};
    _adminState.providerHealth[p.id]=data;
    adminPoblar();
  },function(e){
    adminMsg("Error al probar "+(p.name||p.id)+": "+(e&&e.message||"desconocido"),true);
  });
}
function adminTestAll(){
  if(!confirm("\u00bfProbar todos los proveedores activos? Esto realizar\u00e1 llamadas a la IA y puede consumir cuota.")) return;
  var tok=adminGetToken();
  if(!tok){adminMsg("Sesi\u00f3n no v\u00e1lida",true);return}
  var providers=adminDraft();
  var active=providers.filter(function(p){return p.enabled!==false});
  if(!active.length){adminMsg("No hay proveedores activos para probar",true);return}
  adminMsg("Probando 0/"+active.length+"\u2026");
  var idx=0;
  function testNext(){
    if(idx>=active.length){adminMsg("\u2713 Prueba completada");adminPoblar();return}
    var p=active[idx];
    idx++;
    adminMsg("Probando "+(p.name||p.id)+" ("+idx+"/"+active.length+")\u2026");
    adminFetch("POST",tok,{endpoint:"/api/provider-test",body:{providerConfig:adminProviderConfig(p)}}).then(function(data){
      if(!_adminState.providerHealth) _adminState.providerHealth={};
      _adminState.providerHealth[p.id]=data;
      testNext();
    },function(){
      testNext();
    });
  }
  testNext();
}
function adminPoblar(){
  var cfg=_adminState.config||{};
  var providers=adminDraft();
  var maxP=_adminState.maxProviders||5;
  var cont=document.getElementById("admin-proveedores");
  if(!cont) return;
  cont.innerHTML="";
  providers.forEach(function(p,i){
    var isActive=p.enabled!==false;
    var row=document.createElement("div");
    row.className="admin-prov";
    row.style.cssText="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.1)";
    var header=document.createElement("div");
    header.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:6px";
    var num=document.createElement("span");
    num.style.cssText="opacity:.5;width:18px;font-size:.85em";
    num.textContent=(i+1)+".";
    header.appendChild(num);
    var chk=document.createElement("input");
    chk.type="checkbox";
    chk.id="prov-enabled-"+i;
    if(isActive) chk.checked=true;
    chk.style.width="auto";
    chk.onchange=(function(ii){return function(){adminCambio(ii,"enabled",chk.checked)}})(i);
    header.appendChild(chk);
    var nameInp=document.createElement("input");
    nameInp.type="text";
    nameInp.id="prov-name-"+i;
    nameInp.value=p.name||"";
    nameInp.placeholder="Nombre";
    nameInp.style.cssText="flex:1;font-size:.85em;min-width:80px";
    nameInp.oninput=(function(ii){return function(){adminCambio(ii,"name",nameInp.value)}})(i);
    header.appendChild(nameInp);
    var statusEl=document.createElement("span");
    statusEl.id="prov-status-"+i;
    statusEl.style.cssText="font-size:.75em;min-width:60px;text-align:center";
    adminPintarEstado(i,statusEl);
    header.appendChild(statusEl);
    var keyEl=document.createElement("span");
    keyEl.id="prov-key-"+i;
    keyEl.style.cssText="font-size:.7em;min-width:90px;text-align:center;opacity:.75";
    keyEl.textContent=(p.hasKey===true)?"configurada":"no configurada";
    header.appendChild(keyEl);
    row.appendChild(header);
    var fields=document.createElement("div");
    fields.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;font-size:.8em";
    var urlInp=document.createElement("input");
    urlInp.type="text";
    urlInp.id="prov-url-"+i;
    urlInp.value=p.url||"";
    urlInp.placeholder="URL API (HTTPS)";
    urlInp.style.cssText="font-size:.85em";
    urlInp.oninput=(function(ii){return function(){adminCambio(ii,"url",urlInp.value)}})(i);
    var urlLbl=document.createElement("label");
    urlLbl.style.cssText="opacity:.6;font-size:.75em";
    urlLbl.textContent="URL";
    fields.appendChild(urlLbl);
    fields.appendChild(urlInp);
    var modelInp=document.createElement("input");
    modelInp.type="text";
    modelInp.id="prov-model-"+i;
    modelInp.value=p.model||"";
    modelInp.placeholder="Modelo";
    modelInp.style.cssText="font-size:.85em";
    modelInp.oninput=(function(ii){return function(){adminCambio(ii,"model",modelInp.value)}})(i);
    var modelLbl=document.createElement("label");
    modelLbl.style.cssText="opacity:.6;font-size:.75em";
    modelLbl.textContent="Modelo";
    fields.appendChild(modelLbl);
    fields.appendChild(modelInp);
    var secretInp=document.createElement("input");
    secretInp.type="text";
    secretInp.id="prov-secret-"+i;
    secretInp.value=_patronSecretRefOK(p.secretRef)?p.secretRef:"";
    secretInp.placeholder="Nombre del Cloudflare Secret (ej: GROQ_API_KEY)";
    secretInp.style.cssText="font-size:.85em";
    secretInp.oninput=(function(ii){return function(){adminCambio(ii,"secretRef",secretInp.value)}})(i);
    var secretLbl=document.createElement("label");
    secretLbl.style.cssText="opacity:.6;font-size:.75em";
    secretLbl.textContent="Nombre del Secret";
    fields.appendChild(secretLbl);
    fields.appendChild(secretInp);
    row.appendChild(fields);
    var btns=document.createElement("div");
    btns.style.cssText="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap";
    var testBtn=document.createElement("button");
    testBtn.className="btn btn-outline btn-sm";
    testBtn.textContent="Probar";
    testBtn.onclick=(function(ii){return function(){adminTestProvider(ii)}})(i);
    btns.appendChild(testBtn);
    var upBtn=document.createElement("button");
    upBtn.className="btn btn-outline btn-sm";
    upBtn.textContent="\u25B2";
    upBtn.disabled=i===0;
    upBtn.onclick=(function(ii){return function(){adminMover(ii,-1)}})(i);
    btns.appendChild(upBtn);
    var dnBtn=document.createElement("button");
    dnBtn.className="btn btn-outline btn-sm";
    dnBtn.textContent="\u25BC";
    dnBtn.disabled=i===providers.length-1;
    dnBtn.onclick=(function(ii){return function(){adminMover(ii,1)}})(i);
    btns.appendChild(dnBtn);
    if(providers.length>1){
      var rmBtn=document.createElement("button");
      rmBtn.className="btn btn-outline btn-sm";
      rmBtn.textContent="Quitar";
      rmBtn.style.color="var(--danger,#e74c3c)";
      rmBtn.onclick=(function(ii){return function(){adminQuitar(ii)}})(i);
      btns.appendChild(rmBtn);
    }
    row.appendChild(btns);
    cont.appendChild(row);
  });
  var addCont=document.createElement("div");
  addCont.style.cssText="padding:8px 0;text-align:center";
  if(providers.length<maxP){
    var addBtn=document.createElement("button");
    addBtn.className="btn btn-outline btn-sm";
    addBtn.textContent="+ A\u00f1adir API ("+providers.length+"/"+maxP+")";
    addBtn.onclick=adminAnadir;
    addCont.appendChild(addBtn);
  }else{
    var fullEl=document.createElement("span");
    fullEl.style.cssText="opacity:.5;font-size:.85em";
    fullEl.textContent=providers.length+"/"+maxP+" (m\u00e1ximo alcanzado)";
    addCont.appendChild(fullEl);
  }
  cont.appendChild(addCont);
  document.getElementById("admin-temp").value=cfg.temperature!=null?cfg.temperature:0.7;
  adminTempVal();
  document.getElementById("admin-len").value=cfg.lenDefault||"media";
  document.getElementById("admin-maxtok").value=cfg.maxTokens||4096;
  var af=_adminState.aiFlags||{useCorta:true,useLarga:true};
  var elUC=document.getElementById("admin-use-corta"),elUL=document.getElementById("admin-use-larga");
  if(elUC) elUC.checked=af.useCorta!==false;
  if(elUL) elUL.checked=af.useLarga!==false;
  for(var g in ADMIN_SISTEMAS_CFGKEY){
    var elS=document.getElementById("admin-sys-"+g);
    if(!elS) continue;
    elS.value=cfg[ADMIN_SISTEMAS_CFGKEY[g]]!=null?cfg[ADMIN_SISTEMAS_CFGKEY[g]]:((_adminState.systemDefaults||{})[g]||"");
  }
}

/* ============ LECTURA POR VOZ (Web Speech API) ============ */
var VOZ={estado:"idle",idx:0,partes:[],utter:null,dest:null,textos:{},voz:null,tasa:1,cargado:false};
var VOZ_RATE_KEY="bats-voz-tasa";
var VOZ_VOZ_KEY="bats-voz-voice";
function vozSoporte(){return typeof window!=="undefined"&&("speechSynthesis" in window)&&("SpeechSynthesisUtterance" in window)}
function vozVozes(){try{return window.speechSynthesis.getVoices()||[]}catch(e){return []}}
function vozEsVoz(v){return v&&/^es\b|^es-/i.test(v.lang||"")}
function vozTieneES(){return vozVozes().some(vozEsVoz)}
function vozVozesES(){
  var vs=vozVozes().filter(vozEsVoz);
  vs.sort(function(a,b){
    var ea=(a.lang||"").toLowerCase()==="es-es"?0:1;
    var eb=(b.lang||"").toLowerCase()==="es-es"?0:1;
    return (ea-eb)||(a.name||"").localeCompare(b.name||"");
  });
  return vs;
}
function vozVozPorURI(uri){
  var vs=vozVozes();
  for(var i=0;i<vs.length;i++) if(vs[i].voiceURI===uri) return vs[i];
  return null;
}
function vozVozActual(){
  if(VOZ.voz) return VOZ.voz;
  var saved=lsGet(VOZ_VOZ_KEY);
  if(saved){var v=vozVozPorURI(saved);if(v)return v}
  return vozVozesES()[0]||null;
}
function vozTextoDe(cartas,ctx){
  ctx=ctx||window._lastCtx||{};
  var partes=[];
  if(cartas&&cartas.length){
    cartas.forEach(function(it,i){
      var c=it.carta;
      if(!c) return;
      var pos=(it.posicion||"").replace(/\s+/g," ").trim();
      var nm=c.nombre||"";
      if(it.invertida) nm+=" (invertida)";
      var t=(it.texto||"").replace(/\s+/g," ").trim();
      var seg=(pos?pos+": ":"")+nm;
      if(t) seg+=". "+t;
      if(seg) partes.push(seg);
    });
    var extVoz=extensionVoz(cartas);
    if(extVoz) partes.push(extVoz);
    if(ctx.guion!=="arcano"){
      var q=calcQuinta(cartas);
      if(q){
        var raw=(cartas._qtext||textoQuinta(q.nombre)||txt(q,false)||"");
        var p=parsearQuinta(raw);
        var qt="Quintaesencia: "+q.nombre;
        if(p.lectura) qt+=". "+p.lectura;
        if(p.consejo) qt+=". Consejo: "+p.consejo;
        if(p.palabraClave) qt+=". Palabra clave: "+p.palabraClave;
        if(p.antipatron) qt+=". Antipatrón: "+p.antipatron;
        partes.push(qt);
      }
    }
  }
  if(cartas&&cartas._interp){var li=String(cartas._interp).replace(/\s+/g," ").trim();if(li)partes.push(li)}
  return partes.join(". ");
}
function vozDividir(texto,max){
  max=max||300;
  var s=String(texto||"").replace(/[#*_~`>]/g,"").replace(/\s+/g," ").trim();
  if(!s) return [];
  var chunks=[],rest=s;
  while(rest.length>max){
    var slice=rest.substring(0,max);
    var cut=slice.lastIndexOf(". ");
    if(cut<max*0.5) cut=slice.lastIndexOf(" ");
    if(cut<=0) cut=max;
    var piece=slice.substring(0,cut).trim();
    if(piece) chunks.push(piece);
    rest=rest.substring(cut).trim();
  }
  if(rest) chunks.push(rest);
  return chunks;
}
function vozPoblarSelect(sel){
  if(!sel) return;
  var es=vozVozesES();
  var saved=lsGet(VOZ_VOZ_KEY);
  sel.innerHTML="";
  if(!es.length){
    var opt=document.createElement("option");
    opt.value="";opt.textContent="Sin voz en español";
    sel.appendChild(opt);sel.disabled=true;
    return;
  }
  sel.disabled=false;
  var selIdx=0;
  es.forEach(function(v,i){
    var o=document.createElement("option");
    o.value=v.voiceURI;
    o.textContent=v.name+" ("+v.lang+")";
    sel.appendChild(o);
    if(saved&&v.voiceURI===saved) selIdx=i;
  });
  sel.selectedIndex=selIdx;
}
function vozBarHTML(dest){
  var d=String(dest||"").replace(/"/g,"");
  var h='<div class="voz-bar" id="voz-'+d+'" data-dest="'+d+'">';
  h+='<span class="voz-label">Leer</span>';
  h+='<button class="btn btn-outline btn-sm voz-play" onclick="vozLeer(\''+d+'\')">\u25B6 Escuchar</button>';
  h+='<button class="btn btn-outline btn-sm voz-pause" onclick="vozPausa()" disabled>\u23F8 Pausa</button>';
  h+='<button class="btn btn-outline btn-sm voz-stop" onclick="vozParar()" disabled>\u23F9 Parar</button>';
  h+='<span class="voz-tasa-group">';
  [0.75,1,1.25].forEach(function(t){
    h+='<button class="btn btn-outline btn-sm voz-tasa'+(t===1?" active":"")+'" data-t="'+t+'" onclick="vozTasa('+t+')">'+t+'\u00D7</button>';
  });
  h+='</span>';
  h+='<select class="voz-select" onchange="vozCambiarVoz(\''+d+'\',this.value)"></select>';
  h+='<button class="btn btn-outline btn-sm voz-mp3" data-mp3="'+d+'" onclick="vozDescargarMP3(\''+d+'\')">\u2B07 MP3</button>';
  h+='<span class="voz-notice" style="display:none"></span>';
  h+='</div>';
  return h;
}
function vozActualizarBarras(){
  if(typeof document==="undefined") return;
  var bars=document.querySelectorAll(".voz-bar");
  for(var i=0;i<bars.length;i++){
    var bar=bars[i];
    var dest=bar.getAttribute("data-dest")||(bar.id||"").replace(/^voz-/,"");
    var play=bar.querySelector(".voz-play"),pause=bar.querySelector(".voz-pause"),stop=bar.querySelector(".voz-stop");
    var notice=bar.querySelector(".voz-notice");
    if(!play) continue;
    if(!vozSoporte()){
      if(notice){notice.style.display="block";notice.textContent="Este dispositivo no soporta lectura por voz."}
      play.disabled=true;if(pause)pause.disabled=true;if(stop)stop.disabled=true;
      continue;
    }
    if(!vozTieneES()&&VOZ.cargado){
      if(notice){notice.style.display="block";notice.textContent="No hay voz en español instalada en este dispositivo"}
      play.disabled=true;if(pause)pause.disabled=true;if(stop)stop.disabled=true;
      continue;
    }
    if(!VOZ.cargado){
      if(notice){notice.style.display="none"}
      play.disabled=true;play.textContent="\u2026 Cargando voces";
      if(pause)pause.disabled=true;if(stop)stop.disabled=true;
      continue;
    }
    if(notice){notice.style.display="none"}
    play.disabled=false;play.textContent="\u25B6 Escuchar";
    if(VOZ.estado==="hablando"&&VOZ.dest===dest){
      play.textContent="\u25B6 Leyendo\u2026";if(pause)pause.disabled=false;if(stop)stop.disabled=false;
    }else if(VOZ.estado==="pausado"&&VOZ.dest===dest){
      play.textContent="\u25B6 Reanudar";if(pause)pause.disabled=true;if(stop)stop.disabled=false;
    }else{
      if(pause)pause.disabled=true;if(stop)stop.disabled=true;
    }
  }
}
function vozHablar(){
  if(!VOZ.partes||VOZ.idx>=VOZ.partes.length){vozTerminar();return}
  var u=new SpeechSynthesisUtterance(VOZ.partes[VOZ.idx]);
  var v=vozVozActual();
  if(v){u.voice=v;u.lang=v.lang}else{u.lang="es-ES"}
  u.rate=VOZ.tasa;u.pitch=1;
  u.onend=function(){VOZ.idx++;if(VOZ.idx<VOZ.partes.length)vozHablar();else vozTerminar();};
  u.onerror=function(){vozTerminar();};
  VOZ.utter=u;VOZ.estado="hablando";vozActualizarBarras();
  try{window.speechSynthesis.speak(u)}catch(e){vozTerminar()}
}
function vozLeer(dest){
  if(!vozSoporte()){toast("Este dispositivo no soporta lectura por voz",true);return}
  var texto=VOZ.textos[dest]||(window._ult?vozTextoDe(window._ult):"");
  if(!texto){toast("No hay texto que leer",true);return}
  if(VOZ.estado==="pausado"&&VOZ.dest===dest){vozReanudar();return}
  vozParar(false);
  vozConVoices(function(){
    if(!vozTieneES()){
      VOZ.cargado=true;vozActualizarBarras();
      toast("No hay voz en español instalada en este dispositivo",true);return;
    }
    VOZ.partes=vozDividir(texto);
    VOZ.idx=0;VOZ.dest=dest;VOZ.tasa=vozTasaActual();
    vozHablar();
  });
}
function vozPausa(){
  if(!vozSoporte()||VOZ.estado!=="hablando")return;
  try{window.speechSynthesis.pause()}catch(e){}
  VOZ.estado="pausado";vozActualizarBarras();
}
function vozReanudar(){
  if(!vozSoporte()||VOZ.estado!=="pausado")return;
  try{window.speechSynthesis.resume()}catch(e){}
  VOZ.estado="hablando";vozActualizarBarras();
}
function vozParar(actualizar){
  actualizar=(actualizar===undefined)?true:actualizar;
  if(vozSoporte()){try{window.speechSynthesis.cancel()}catch(e){}}
  VOZ.estado="idle";VOZ.idx=0;VOZ.partes=[];VOZ.utter=null;VOZ.dest=null;
  if(actualizar) vozActualizarBarras();
}
function vozTerminar(){
  VOZ.estado="idle";VOZ.idx=0;VOZ.partes=[];VOZ.utter=null;VOZ.dest=null;
  vozActualizarBarras();
}
function vozTasaActual(){
  var t=parseFloat(lsGet(VOZ_RATE_KEY));
  return (t===0.75||t===1||t===1.25)?t:1;
}
function vozTasa(t){
  if(t!==0.75&&t!==1&&t!==1.25)return;
  VOZ.tasa=t;lsSet(VOZ_RATE_KEY,String(t));
  var btns=document.querySelectorAll(".voz-tasa");
  for(var i=0;i<btns.length;i++) btns[i].classList.toggle("active",parseFloat(btns[i].getAttribute("data-t"))===t);
  if(VOZ.estado==="hablando"||VOZ.estado==="pausado"){
    if(vozSoporte()){try{window.speechSynthesis.cancel()}catch(e){}}
    VOZ.estado="idle";
    if(VOZ.partes&&VOZ.idx<VOZ.partes.length){VOZ.estado="hablando";var _v=VOZ;setTimeout(function(){vozHablar()},30)}
  }
}
function vozCambiarVoz(dest,uri){
  var v=uri?vozVozPorURI(uri):null;
  if(!v)return;
  VOZ.voz=v;lsSet(VOZ_VOZ_KEY,v.voiceURI);
  if(VOZ.estado==="hablando"||VOZ.estado==="pausado"){
    var actual=VOZ.idx;
    if(vozSoporte()){try{window.speechSynthesis.cancel()}catch(e){}}
    VOZ.estado="idle";VOZ.idx=actual;VOZ.estado="hablando";
    setTimeout(function(){vozHablar()},30);
  }
}
var VOZ_ULTIMA_FIRMA="";
function vozFirma(){
  try{return vozVozes().map(function(v){return (v.voiceURI||"")+"|"+(v.lang||"")}).join(";")}catch(e){return ""}
}
function vozCalentar(){
  try{
    var u=new SpeechSynthesisUtterance(" ");
    u.volume=0;u.rate=1;u.pitch=1;
    window.speechSynthesis.speak(u);
    setTimeout(function(){try{window.speechSynthesis.cancel()}catch(e){}},60);
  }catch(e){}
}
function vozCargar(){
  if(!vozSoporte())return;
  var marco=Date.now();
  var detenido=false;
  function revisar(){
    if(detenido) return;
    var vs=vozVozes();
    if(vs.length) VOZ.cargado=true;
    else if(Date.now()-marco>=10000) VOZ.cargado=true;
    var firma=vozFirma();
    if(firma!==VOZ_ULTIMA_FIRMA){
      VOZ_ULTIMA_FIRMA=firma;
      var sels=document.querySelectorAll(".voz-select");
      for(var i=0;i<sels.length;i++) vozPoblarSelect(sels[i]);
    }
    vozActualizarBarras();
  }
  try{window.speechSynthesis.addEventListener("voiceschanged",revisar)}catch(e){}
  try{window.speechSynthesis.onvoiceschanged=revisar}catch(e){}
  vozCalentar();
  revisar();
  var iv=setInterval(revisar,500);
  setTimeout(function(){detenido=true;clearInterval(iv)},60000);
}
function vozConVoices(cb){
  if(vozVozes().length){cb();return}
  vozCalentar();
  var intentos=0;
  var iv=setInterval(function(){
    intentos++;
    if(vozVozes().length||intentos>=10){
      clearInterval(iv);
      cb();
    }
  },300);
}
function vozDescargarMP3(dest){
  var texto=VOZ.textos[dest]||(window._ult?vozTextoDe(window._ult):"");
  if(!texto){toast("No hay texto que descargar",true);return}
  if(typeof getWorkerURL!=="function"||typeof AI_WORKER_TOKEN==="undefined"){toast("Servicio de voz no disponible",true);return}
  var btn=document.querySelector('[data-mp3="'+dest+'"]');
  if(btn){btn.disabled=true;btn.textContent="Generando MP3\u2026"}
  var voz=vozVozActual();
  var lang=(voz&&voz.lang)?String(voz.lang):"es-ES";
  var tl=/^es-US$/i.test(lang)?"es-US":"es";
  var url=getWorkerURL()+"/api/tts";
  fetch(url,{
    method:"POST",
    headers:{"Content-Type":"application/json","X-BATS-Token":AI_WORKER_TOKEN},
    body:JSON.stringify({text:texto,voice:tl})
  }).then(function(r){
    if(!r.ok) return r.json().catch(function(){return{}}).then(function(j){throw new Error(j.error||("Error del servidor ("+r.status+")"))});
    return r.blob();
  }).then(function(blob){
    var u=URL.createObjectURL(blob);
    var a=document.createElement("a");
    a.href=u;a.download="lectura-bats.mp3";
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(u)},4000);
    toast("MP3 descargado");
  }).catch(function(e){
    toast("No se pudo generar el MP3: "+(e&&e.message||"error"),true);
  }).finally(function(){
    if(btn){btn.disabled=false;btn.textContent="\u2B07 MP3"}
  });
}

setTimeout(function(){
  var vd=document.getElementById("vers-app");
  if(vd) vd.textContent="BATS Tarot v"+BATS_VERSION;
  console.log("[BATS] version cargada:",BATS_VERSION);
  var rp1=document.getElementById("rel-p1"),rp2=document.getElementById("rel-p2");
  if(rp1){rp1.value=lsGet("bats-rel-p1")||"Persona 1"}
  if(rp2){rp2.value=lsGet("bats-rel-p2")||"Persona 2"}
  var rtipo=document.getElementById("tipo-rel");
  if(rtipo){rtipo.value=lsGet("bats-rel-tipo")||""}
  var avFNac=document.getElementById("av-fecha-nac"),avNom=document.getElementById("av-nombre");
  if(avFNac){avFNac.value=lsGet("av-nacimiento")||""}
  if(avNom){avNom.value=lsGet("av-nombre")||""}
  if(document.getElementById("r-ayuda")) mostrarTodas();
  if(document.getElementById("r-historial")) cargarHist();
  if(typeof actualizarUI_AI==="function") actualizarUI_AI();
  if(document.getElementById("cfg-provider")) cargarPanelConfig();
  if(typeof cargarAIFlags==="function") cargarAIFlags(sincronizarFlagsPaneles);
  if(typeof initAdmin==="function") initAdmin();
  if(typeof vozCargar==="function"){vozCargar();vozTasa(vozTasaActual())}
  initSW();
},100);
