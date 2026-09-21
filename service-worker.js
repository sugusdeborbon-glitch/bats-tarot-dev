var CACHE = "bats-v28";
var STATIC_CACHE = CACHE + "-static";
var IMG_CACHE = CACHE + "-img";

var ARCHIVOS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "ai.js",
  "manifest.json",
  "datos_bats.js",
  "quintaesencia_bats.js",
  "icono-512.png",
  "offline.html",
  "cartas/00-TheFool.jpg",
  "cartas/01-TheMagician.jpg",
  "cartas/02-TheHighPriestess.jpg",
  "cartas/03-TheEmpress.jpg",
  "cartas/04-TheEmperor.jpg",
  "cartas/05-TheHierophant.jpg",
  "cartas/06-TheLovers.jpg",
  "cartas/07-TheChariot.jpg",
  "cartas/08-Strength.jpg",
  "cartas/09-TheHermit.jpg",
  "cartas/10-WheelOfFortune.jpg",
  "cartas/11-Justice.jpg",
  "cartas/12-TheHangedMan.jpg",
  "cartas/13-Death.jpg",
  "cartas/14-Temperance.jpg",
  "cartas/15-TheDevil.jpg",
  "cartas/16-TheTower.jpg",
  "cartas/17-TheStar.jpg",
  "cartas/18-TheMoon.jpg",
  "cartas/19-TheSun.jpg",
  "cartas/20-Judgement.jpg",
  "cartas/21-TheWorld.jpg",
  "cartas/CardBacks.jpg",
  "cartas/Cups01.jpg","cartas/Cups02.jpg","cartas/Cups03.jpg","cartas/Cups04.jpg",
  "cartas/Cups05.jpg","cartas/Cups06.jpg","cartas/Cups07.jpg","cartas/Cups08.jpg",
  "cartas/Cups09.jpg","cartas/Cups10.jpg","cartas/Cups11.jpg","cartas/Cups12.jpg",
  "cartas/Cups13.jpg","cartas/Cups14.jpg",
  "cartas/Pentacles01.jpg","cartas/Pentacles02.jpg","cartas/Pentacles03.jpg","cartas/Pentacles04.jpg",
  "cartas/Pentacles05.jpg","cartas/Pentacles06.jpg","cartas/Pentacles07.jpg","cartas/Pentacles08.jpg",
  "cartas/Pentacles09.jpg","cartas/Pentacles10.jpg","cartas/Pentacles11.jpg","cartas/Pentacles12.jpg",
  "cartas/Pentacles13.jpg","cartas/Pentacles14.jpg",
  "cartas/Swords01.jpg","cartas/Swords02.jpg","cartas/Swords03.jpg","cartas/Swords04.jpg",
  "cartas/Swords05.jpg","cartas/Swords06.jpg","cartas/Swords07.jpg","cartas/Swords08.jpg",
  "cartas/Swords09.jpg","cartas/Swords10.jpg","cartas/Swords11.jpg","cartas/Swords12.jpg",
  "cartas/Swords13.jpg","cartas/Swords14.jpg",
  "cartas/Wands01.jpg","cartas/Wands02.jpg","cartas/Wands03.jpg","cartas/Wands04.jpg",
  "cartas/Wands05.jpg","cartas/Wands06.jpg","cartas/Wands07.jpg","cartas/Wands08.jpg",
  "cartas/Wands09.jpg","cartas/Wands10.jpg","cartas/Wands11.jpg","cartas/Wands12.jpg",
  "cartas/Wands13.jpg","cartas/Wands14.jpg",
  "comodin_reverso.png","comodin_anverso_umbral_cerrado.png","comodin_anverso_umbral_abierto.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(function(c){ return c.addAll(ARCHIVOS); }),
      caches.open(IMG_CACHE)
    ]).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.map(function(k){
          if(k !== STATIC_CACHE && k !== IMG_CACHE) return caches.delete(k);
        })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

function isImage(req){
  return req.headers.get("Accept").indexOf("image") !== -1;
}

function isStatic(req){
  var url = new URL(req.url);
  if (url.pathname.indexOf("novedades.json") !== -1) return false;
  return url.pathname.match(/\.(js|css|json|png|jpg|jpeg|gif|svg|ico|webp)$/);
}

self.addEventListener("fetch", function(e){
  var req = e.request;

  if (req.method !== "GET") return;

  if (isImage(req)) {
    e.respondWith(staleWhileRevalidate(req, IMG_CACHE));
    return;
  }

  if (isStatic(req)) {
    e.respondWith(cacheFirst(req));
    return;
  }

  e.respondWith(networkFirst(req));
});

function cacheFirst(req){
  return caches.match(req).then(function(resp){
    return resp || fetch(req).then(function(netResp){
      return netResp;
    }).catch(function(){
      return caches.match("offline.html");
    });
  });
}

function networkFirst(req){
  return fetch(req).then(function(resp){
    if (resp && resp.ok) {
      var clone = resp.clone();
      caches.open(STATIC_CACHE).then(function(c){ c.put(req, clone); });
    }
    return resp;
  }).catch(function(){
    return caches.match(req).then(function(r){ return r || caches.match("offline.html"); });
  });
}

function staleWhileRevalidate(req, cacheName){
  return caches.open(cacheName).then(function(cache){
    return cache.match(req).then(function(cached){
      var fetchPromise = fetch(req).then(function(netResp){
        if (netResp && netResp.ok) cache.put(req, netResp.clone());
        return netResp;
      }).catch(function(){ return cached; });
      return cached || fetchPromise;
    });
  });
}
