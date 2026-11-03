import type { RoutePoint, PickupCheck } from "@dike/api-client-ts";

export type RouteMapMember = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

export type RouteMapViewport = { topInset: number; bottomInset: number };

export type RouteMapPresentation = {
  topInset?: number;
  showLabels?: boolean;
  allowSatellite?: boolean;
  memberColors?: boolean;
  directionMarkers?: boolean;
  owner?: RouteMapMember;
  requester?: RouteMapMember;
  extraStops?: (RoutePoint & {
    displayLabel?: string;
    kind?: "origin" | "destination";
  })[];
  extraGeometry?: RoutePoint[];
  bottomInset?: number;
  style?: "positron" | "liberty";
  labels?: { origin: string; destination: string };
  request?: Pick<
    PickupCheck,
    "pickup" | "dropoff" | "pickupIndex" | "dropoffIndex"
  >;
};

// Same renderer, basemap and saved geometry used by the web feed.
// Coordinates and escaped display labels cross into this document; credentials remain in native API calls.
export function routeMapHtml(
  geometry: RoutePoint[],
  selectable = false,
  interactive = false,
  passenger = false,
  presentation?: RouteMapPresentation,
) {
  const topInset = Math.max(0, presentation?.topInset ?? 0);
  const bottomInset = Math.max(0, presentation?.bottomInset ?? 0);
  const labelData = JSON.stringify(presentation?.labels ?? null).replaceAll(
    "<",
    "\\u003c",
  );
  const requestData = JSON.stringify(presentation?.request ?? null).replaceAll(
    "<",
    "\\u003c",
  );
  const extraStops = JSON.stringify(presentation?.extraStops ?? []).replaceAll(
    "<",
    "\\u003c",
  );
  const extraCoordinates = JSON.stringify(
    (presentation?.extraGeometry ?? []).map((p) => [p.longitude, p.latitude]),
  );
  const members = JSON.stringify({
    owner: presentation?.owner,
    requester: presentation?.requester,
  }).replaceAll("<", "\\u003c");
  const requesterAccent = passenger ? "#00866e" : "#e9bd52";
  const routeAccent = passenger ? "#d4a125" : "#00866e";
  const coordinates = JSON.stringify(
    geometry.map((p) => [p.longitude, p.latitude]),
  );
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.14.0/dist/maplibre-gl.css">
<style>
html,body,#map{margin:0;width:100%;height:100%;overflow:hidden;background:#edf1ee}
.maplibregl-ctrl-attrib{font-size:8px!important;line-height:12px!important}
.maplibregl-ctrl-bottom-right{bottom:${bottomInset}px;right:0}
.maplibregl-ctrl-top-right{top:${topInset + 12}px;right:12px;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.maplibregl-ctrl-group{border-radius:12px!important;box-shadow:0 4px 14px rgba(0,0,0,0.12)!important;border:1px solid rgba(0,0,0,0.06)!important;overflow:hidden;background:#ffffff!important;margin:0!important}
.maplibregl-ctrl-group button{width:38px!important;height:38px!important;display:flex!important;align-items:center!important;justify-content:center!important}
.maplibregl-ctrl-group button:active{background-color:#eef4f1!important}
.dike-fit-btn{display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;border:none!important;cursor:pointer!important;background:#ffffff!important}
.dike-fit-btn:active{background:#eef4f1!important}
.dike-member-pin{position:absolute;width:32px;height:42px;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.18))}
.dike-pin-shape{position:absolute;inset:0;width:32px;height:42px;display:block}
.dike-marker-face{position:absolute;left:4px;top:4px;width:24px;height:24px;border-radius:50%;background:#fff;display:flex;overflow:hidden}
.dike-marker-person{display:flex;flex:1;min-width:0;align-items:center;justify-content:center;background:#fff}
.dike-marker-person img,.dike-marker-person svg{width:100%;height:100%;object-fit:cover;display:block}
.dike-map-label{max-width:132px;padding:7px 9px;border-radius:10px;background:rgba(255,255,255,0.94);color:#12342d;font:600 12px/17px sans-serif;box-shadow:0 2px 12px rgba(18,52,45,0.10);pointer-events:none}
</style></head>
<body data-state="loading"><div id="map"></div>
<script>
function signal(type,point){document.body.dataset.state=type;var message=JSON.stringify({source:'dike-route-map',type:type,point:point});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else window.parent.postMessage(message,'*');}
var settled=false;
var timeout=setTimeout(failed,30000);
function failed(){if(settled)return;settled=true;clearTimeout(timeout);signal('error');}
function ready(){if(settled)return;settled=true;clearTimeout(timeout);signal('ready');}
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
 var request=${requestData};
 var members=${members};
 var directionMarkers=${presentation?.directionMarkers ?? false};
 var extraStops=${extraStops};
 var extraCoordinates=${extraCoordinates};
 var bounds=new maplibregl.LngLatBounds();coordinates.forEach(function(p){bounds.extend(p)});
 [request?.pickup,request?.dropoff].filter(Boolean).forEach(function(p){if(Number.isFinite(p.longitude)&&Number.isFinite(p.latitude))bounds.extend([p.longitude,p.latitude]);});
 extraStops.forEach(function(p){bounds.extend([p.longitude,p.latitude])});
 extraCoordinates.forEach(function(p){bounds.extend(p)});
 var viewport={topInset:${topInset},bottomInset:${bottomInset}};
 var selectable=${selectable};
 var isInteractive=${interactive || selectable};
 function fitOptions(){
  var container=document.getElementById('map');
  var vertical=Math.min(48,Math.max(24,container.clientHeight*0.16));
  var horizontal=Math.min(48,Math.max(24,container.clientWidth*0.08));
  return {absolutePadding:true,padding:{top:Math.max(vertical,viewport.topInset+(directionMarkers?48:24)),bottom:Math.max(vertical,viewport.bottomInset+24),left:horizontal,right:horizontal},maxZoom:isInteractive?15:14.5,duration:0};
 }
 var map=new maplibregl.Map({
  container:'map',
  style:'https://tiles.openfreemap.org/styles/${presentation?.style ?? "positron"}',
  ...(selectable?{center:coordinates[0],zoom:16}:{bounds:bounds,fitBoundsOptions:fitOptions()}),
  interactive:isInteractive,
  attributionControl:{compact:true},
  renderWorldCopies:false
 });
 // Update overlay padding on the existing map instead of replacing its document.
 window.dikeSetViewport=function(next){
  viewport={topInset:Math.max(0,Number.isFinite(next?.topInset)?next.topInset:0),bottomInset:Math.max(0,Number.isFinite(next?.bottomInset)?next.bottomInset:0)};
  document.body.dataset.viewportTop=String(viewport.topInset);
  var controls=document.querySelector('.maplibregl-ctrl-top-right');if(controls)controls.style.top=(viewport.topInset+12)+'px';
  var attribution=document.querySelector('.maplibregl-ctrl-bottom-right');if(attribution)attribution.style.bottom=viewport.bottomInset+'px';
  if(!selectable)map.fitBounds(bounds,fitOptions());
 };
 window.addEventListener('message',function(event){if(event.source===window.parent&&event.data?.source==='dike-map-controls'&&event.data.type==='viewport')window.dikeSetViewport(event.data.viewport);});
 // A failed tile must not discard an otherwise usable map.
 map.on('error',function(event){if(!event.sourceId && !event.tile && !map.isStyleLoaded())failed();});
 if(!selectable){map.on('resize',function(){map.fitBounds(bounds,fitOptions())});}
 var resizeObserver=new ResizeObserver(function(){map.resize()});
 resizeObserver.observe(document.getElementById('map'));
 map.on('remove',function(){resizeObserver.disconnect()});
 function collapseAttribution(){
  var attribution=document.querySelector('.maplibregl-ctrl-attrib');
  if(attribution){attribution.classList.remove('maplibregl-compact-show');attribution.removeAttribute('open');}
 }
 map.on('load',collapseAttribution);
 if(!selectable)map.on('click',function(){var message=JSON.stringify({source:'dike-route-map',type:'tap'});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else window.parent.postMessage(message,'*');});
 map.once('style.load',function(){
  if(!selectable){map.resize();map.fitBounds(bounds,fitOptions());}
  if(selectable){
   var pin=new maplibregl.Marker({color:'${routeAccent}'}).setLngLat(coordinates[0]).addTo(map);
   var previousCenter=coordinates[0];
   map.on('move',function(){pin.setLngLat(map.getCenter())});
   map.on('moveend',function(){var c=map.getCenter();if(Math.abs(c.lng-previousCenter[0])<0.0000001&&Math.abs(c.lat-previousCenter[1])<0.0000001)return;previousCenter=[c.lng,c.lat];signal('pick',{latitude:c.lat,longitude:c.lng})});
   map.on('click',function(e){map.easeTo({center:e.lngLat,duration:0})});
   map.once('render',function(){collapseAttribution();ready()});map.triggerRepaint();
   return;
  }
  var segments=[{points:coordinates,color:'${routeAccent}'}];
  if(request && Number.isInteger(request.pickupIndex) && request.pickupIndex>=0 && request.pickupIndex<coordinates.length){
   var pi=request.pickupIndex;var di=Number.isInteger(request.dropoffIndex)?request.dropoffIndex:coordinates.length-1;
   if(di>=pi && di<coordinates.length){
    segments=[{points:coordinates.slice(0,pi+1),color:'${presentation?.memberColors ? routeAccent : "#e9bd52"}'},{points:coordinates.slice(pi,di+1),color:'${presentation?.memberColors ? requesterAccent : "#2563eb"}'},{points:coordinates.slice(di),color:'${presentation?.memberColors ? routeAccent : "#00866e"}'}];
   }
  }
  if(extraCoordinates.length>=2)segments.push({points:extraCoordinates,color:'${requesterAccent}'});
  map.addSource('post-route',{type:'geojson',data:{type:'FeatureCollection',features:segments.filter(function(s){return s.points.length>=2}).map(function(s){return {type:'Feature',properties:{color:s.color},geometry:{type:'LineString',coordinates:s.points}}})}});
  map.addLayer({id:'route-outline',type:'line',source:'post-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ffffff','line-width':5}});
  map.addLayer({id:'route-line',type:'line',source:'post-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':['get','color'],'line-width':3}});
  var endpointLabels=${labelData};
  var stops=[{point:coordinates[0],label:endpointLabels?.origin,kind:'origin',members:members.owner?[members.owner]:[],color:'#e9bd52'},{point:coordinates[coordinates.length-1],label:endpointLabels?.destination,kind:'destination',members:members.owner?[members.owner]:[],color:'#00866e'}];
  function addStop(place,color,kind,routePoint){
   if(!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude))return;
   var point=routePoint||[place.longitude,place.latitude];
   var same=stops.find(function(s){var lat=(s.point[1]-point[1])*111320;var lng=(s.point[0]-point[0])*111320*Math.cos(point[1]*Math.PI/180);return (!directionMarkers||s.kind===kind)&&Math.hypot(lat,lng)<15});
   if(!same)stops.push({point:point,label:place.displayLabel,kind:kind,members:members.requester?[members.requester]:[],color:directionMarkers?(kind==='origin'?'#e9bd52':'#00866e'):color});
   else if(members.requester&&!same.members.some(function(m){return m.id===members.requester.id}))same.members.push(members.requester);
  }
  if(request){addStop(request.pickup,'${presentation?.memberColors ? requesterAccent : "#e9bd52"}','origin',coordinates[request.pickupIndex]);addStop(request.dropoff,'${presentation?.memberColors ? requesterAccent : "#2563eb"}','destination',coordinates[request.dropoffIndex]);}
  extraStops.forEach(function(p,index){var kind=p.kind||(index===0?'origin':'destination');addStop(p,'${requesterAccent}',kind,extraCoordinates.length>=2?extraCoordinates[kind==='origin'?0:extraCoordinates.length-1]:undefined)});
  function memberPin(stop){
   var element=document.createElement('div');element.className='dike-member-pin';element.style.setProperty('--pin-color',stop.color);element.dataset.kind=stop.kind;
   element.setAttribute('role','img');element.setAttribute('aria-label',(stop.kind==='origin'?'Điểm đi: ':'Điểm đến: ')+stop.members.map(function(m){return m.name}).join(' & '));
   var shape=document.createElementNS('http://www.w3.org/2000/svg','svg');shape.setAttribute('viewBox','0 0 32 42');shape.classList.add('dike-pin-shape');shape.setAttribute('aria-hidden','true');
   var outline=document.createElementNS('http://www.w3.org/2000/svg','path');outline.setAttribute('d','M16 0C7.16 0 0 7.16 0 16C0 27 16 42 16 42S32 27 32 16C32 7.16 24.84 0 16 0Z');outline.setAttribute('fill',stop.color);shape.appendChild(outline);element.appendChild(shape);
   var face=document.createElement('div');face.className='dike-marker-face';
   stop.members.forEach(function(member){
    var person=document.createElement('span');person.className='dike-marker-person';person.dataset.member=member.id;
    function fallback(){person.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" fill="#edf2ef"/><circle cx="12" cy="8" r="4" fill="#78928a"/><path d="M3 24v-3a9 9 0 0 1 18 0v3" fill="#78928a"/></svg>';}
    fallback();
    if(member.avatarUrl&&/^(https?:|data:image\\/)/.test(member.avatarUrl)){
     var photo=document.createElement('img');photo.src=member.avatarUrl;photo.alt=member.name;photo.referrerPolicy='no-referrer';photo.onerror=fallback;person.replaceChildren(photo);
    }
    person.setAttribute('role','link');person.setAttribute('aria-label','Xem trang cá nhân '+member.name);person.tabIndex=0;person.style.cursor='pointer';
    function openProfile(event){event.stopPropagation();var message=JSON.stringify({source:'dike-route-map',type:'profile',userId:member.id});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else window.parent.postMessage(message,'*');}
    person.addEventListener('click',openProfile);person.addEventListener('keydown',function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();openProfile(event);}});
    face.appendChild(person);
   });
   element.appendChild(face);return element;
  }
  document.body.dataset.markerCount=stops.length;
  var placedLabels=[];
  stops.forEach(function(stop){
   // The default SVG is 41px high, with its visible tip at y=35.25.
   // MapLibre's default -14px offset is not scaled with the half-size SVG.
   // Anchor the visible tip (not the shadow or SVG box) to the route endpoint.
   new maplibregl.Marker(directionMarkers&&stop.members.length?{element:memberPin(stop),anchor:'bottom',offset:[0,0]}:{color:stop.color,scale:0.5,anchor:'center',offset:[0,-(35.25-41/2)*0.5],subpixelPositioning:true}).setLngLat(stop.point).addTo(map);
   if(stop.label && ${presentation?.showLabels !== false}){
    var label=document.createElement('div');label.className='dike-map-label';label.textContent=stop.label.split(',')[0];
    var onRight=map.project(stop.point).x>map.getContainer().clientWidth*0.55;
    var marker=new maplibregl.Marker({element:label,anchor:onRight?'right':'left',offset:[onRight?-16:16,-18]}).setLngLat(stop.point).addTo(map);
    var rect=label.getBoundingClientRect();
    if(rect.width && rect.height){
     var shifts=[0,-56,56,-112,112];
     for(var shift of shifts){
      var box={left:rect.left,right:rect.right,top:rect.top+shift,bottom:rect.bottom+shift};
      var overlaps=placedLabels.some(function(b){return box.left<b.right+6&&box.right>b.left-6&&box.top<b.bottom+6&&box.bottom>b.top-6});
      if(!overlaps && box.top>${topInset} && box.bottom<map.getContainer().clientHeight-${bottomInset}){
       marker.setOffset([onRight?-16:16,-18+shift]);placedLabels.push(box);break;
      }
     }
    }
   }
  });
  if(isInteractive){
   var nav=new maplibregl.NavigationControl({showCompass:false});
   map.addControl(nav,'top-right');
   var fitBtn=document.createElement('button');
   fitBtn.type='button';
   fitBtn.className='dike-fit-btn';
   fitBtn.title='Xem toàn bộ lộ trình';
   fitBtn.setAttribute('aria-label','Xem toàn bộ lộ trình');
   fitBtn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#087d61" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
   fitBtn.onclick=function(){map.fitBounds(bounds,{...fitOptions(),duration:500})};
   var fitContainer=document.createElement('div');
   fitContainer.className='maplibregl-ctrl maplibregl-ctrl-group';
   fitContainer.appendChild(fitBtn);
   var topRight=document.querySelector('.maplibregl-ctrl-top-right');
   if(topRight){topRight.prepend(fitContainer);}
   if(${presentation?.allowSatellite ?? false}){
    var satelliteAdded=false;var satelliteVisible=false;
    var layerBtn=document.createElement('button');layerBtn.type='button';layerBtn.className='dike-layer-btn';
    layerBtn.textContent='Vệ tinh';layerBtn.setAttribute('aria-label','Xem bản đồ vệ tinh');layerBtn.setAttribute('aria-pressed','false');
    layerBtn.style.cssText='width:auto!important;min-width:72px;padding:0 10px;color:#087d61;font:600 12px sans-serif';
    layerBtn.onclick=function(){
     if(!satelliteAdded){
      map.addSource('satellite',{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'});
      map.addLayer({id:'satellite',type:'raster',source:'satellite',layout:{visibility:'none'}},'route-outline');satelliteAdded=true;
     }
     satelliteVisible=!satelliteVisible;map.setLayoutProperty('satellite','visibility',satelliteVisible?'visible':'none');
     document.body.dataset.layer=satelliteVisible?'satellite':'map';layerBtn.setAttribute('aria-pressed',String(satelliteVisible));
     layerBtn.textContent=satelliteVisible?'Bản đồ':'Vệ tinh';
    };
    var layerContainer=document.createElement('div');layerContainer.className='maplibregl-ctrl maplibregl-ctrl-group';layerContainer.appendChild(layerBtn);if(topRight)topRight.appendChild(layerContainer);
   }
  }
  var attribution=document.querySelector('.maplibregl-ctrl-attrib');if(attribution){attribution.classList.remove('maplibregl-compact-show');attribution.removeAttribute('open');}
  map.once('render',function(){collapseAttribution();ready()});map.triggerRepaint();
 });
}catch(error){failed();}
</script></body></html>`;
}
