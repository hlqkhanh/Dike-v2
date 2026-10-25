import type { RoutePoint } from "@dike/api-client-ts";

// Same renderer, basemap and saved geometry used by the web feed.
// Only numeric coordinates cross into this document; credentials remain in native API calls.
export function routeMapHtml(geometry: RoutePoint[], selectable = false) {
  const coordinates = JSON.stringify(
    geometry.map((p) => [p.longitude, p.latitude]),
  );
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.14.0/dist/maplibre-gl.css">
<style>html,body,#map{margin:0;width:100%;height:100%;overflow:hidden;background:#edf1ee}.maplibregl-ctrl-attrib{font-size:8px!important;line-height:12px!important}.maplibregl-ctrl-bottom-right{bottom:0;right:0}</style></head>
<body data-state="loading"><div id="map"></div>
<script>
function signal(type,point){document.body.dataset.state=type;var message=JSON.stringify({source:'dike-route-map',type:type,point:point});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else window.parent.postMessage(message,'*');}
var timeout=setTimeout(function(){signal('error')},20000);
function failed(){clearTimeout(timeout);signal('error');}
</script>
<script type="module">
try {
 var maplibregl = await import("https://unpkg.com/maplibre-gl@6.14.0/dist/maplibre-gl.mjs");
 // A remote module-worker import fails in inline WebViews/opaque-origin frames.
 // Fetch the self-contained worker and start it from this document's blob origin.
 var workerResponse = await fetch('https://unpkg.com/maplibre-gl@6.14.0/dist/maplibre-gl-worker.mjs');
 if (!workerResponse.ok) throw new Error('Map worker unavailable');
 var workerUrl = URL.createObjectURL(new Blob([await workerResponse.text()],{type:'text/javascript'}));
 maplibregl.setWorkerUrl(workerUrl);
 maplibregl.setWorkerCount(1);
 var coordinates=${coordinates};
 var bounds=new maplibregl.LngLatBounds();coordinates.forEach(function(p){bounds.extend(p)});
 var selectable=${selectable};
 var map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/positron',...(selectable?{center:coordinates[0],zoom:16}:{bounds:bounds,fitBoundsOptions:{padding:18,maxZoom:15,duration:0}}),interactive:selectable,attributionControl:{compact:true},renderWorldCopies:false});
 map.on('error',failed);
 map.on('load',function(){
  if(selectable){
   var pin=new maplibregl.Marker({color:'#00866e'}).setLngLat(coordinates[0]).addTo(map);
   var previousCenter=coordinates[0];
   map.on('move',function(){pin.setLngLat(map.getCenter())});
   map.on('moveend',function(){var c=map.getCenter();if(Math.abs(c.lng-previousCenter[0])<0.0000001&&Math.abs(c.lat-previousCenter[1])<0.0000001)return;previousCenter=[c.lng,c.lat];signal('pick',{latitude:c.lat,longitude:c.lng})});
   map.on('click',function(e){map.easeTo({center:e.lngLat,duration:0})});
   map.once('idle',function(){clearTimeout(timeout);signal('ready')});
   return;
  }
  map.addSource('post-route',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coordinates}}});
  map.addLayer({id:'route-outline',type:'line',source:'post-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ffffff','line-width':5}});
  map.addLayer({id:'route-line',type:'line',source:'post-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#00866e','line-width':3}});
  new maplibregl.Marker({color:'#00866e',scale:0.5}).setLngLat(coordinates[0]).addTo(map);
  new maplibregl.Marker({color:'#f6b737',scale:0.5}).setLngLat(coordinates[coordinates.length-1]).addTo(map);
  var attribution=document.querySelector('.maplibregl-ctrl-attrib');if(attribution){attribution.classList.remove('maplibregl-compact-show');attribution.removeAttribute('open');}
  map.once('idle',function(){clearTimeout(timeout);signal('ready')});
 });
}catch(error){failed();}
</script></body></html>`;
}
