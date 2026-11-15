"use client";
import { useEffect, useRef, useState } from "react";
import * as ml from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function WorldMap({ onCountry, onArea, aoi }: { onCountry: (iso3: string)=>void; onArea:(bbox:string)=>void; aoi?:string }) {
  const el=useRef<HTMLDivElement>(null);
  const mapRef=useRef<ml.Map|null>(null);
  const callbacks=useRef({onCountry,onArea}); callbacks.current={onCountry,onArea};
  const drawing=useRef(false), first=useRef<ml.LngLat|null>(null);
  const [draw,setDraw]=useState(false), [message,setMessage]=useState('');
  useEffect(()=>{
    if(!el.current)return;
    ml.setWorkerUrl(`${location.origin}/vendor/maplibre-gl-worker.mjs`);
    const map=new ml.Map({container:el.current,locale:{"NavigationControl.ZoomIn":"Acercar","NavigationControl.ZoomOut":"Alejar","NavigationControl.ResetBearing":"Orientar al norte","AttributionControl.ToggleAttribution":"Mostrar atribuciones","Map.Title":"Mapa mundial"},center:[-35,20],zoom:1.4,style:{version:8,sources:{},layers:[{id:'ocean',type:'background',paint:{'background-color':'#e4edf0'}}]}});
    mapRef.current=map;
    map.addControl(new ml.NavigationControl(),'top-right');
    const ctrl=new AbortController();
    map.on('load',async()=>{
      map.addSource('area',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
      map.addLayer({id:'area',type:'fill',source:'area',paint:{'fill-color':'#066d85','fill-opacity':.25}});
      try {const r=await fetch('/geo/world.geojson',{signal:ctrl.signal});if(!r.ok)throw new Error();const data=await r.json();if(ctrl.signal.aborted)return;
        map.addSource('world',{type:'geojson',data});map.addLayer({id:'countries',type:'fill',source:'world',paint:{'fill-color':'#c6d0bd','fill-outline-color':'#6c7b70'}},'area');
        map.on('click','countries',e=>{if(drawing.current||e.originalEvent.defaultPrevented)return;const p=e.features?.[0]?.properties;const iso=p?.iso3??p?.ISO_A3??p?.ADM0_A3??p?.adm0_a3;if(iso)callbacks.current.onCountry(String(iso));});
      }catch{if(!ctrl.signal.aborted)setMessage('Límites mundiales no disponibles todavía. Puedes usar el selector y las coordenadas.');}
    });
    map.on('click',e=>{if(!drawing.current)return;e.originalEvent.preventDefault();if(!first.current){first.current=e.lngLat;setMessage('Marca la esquina opuesta del área.');return;}const p=first.current;callbacks.current.onArea([Math.min(p.lng,e.lngLat.lng),Math.min(p.lat,e.lngLat.lat),Math.max(p.lng,e.lngLat.lng),Math.max(p.lat,e.lngLat.lat)].join(','));first.current=null;drawing.current=false;setDraw(false);setMessage('Área seleccionada.');});
    const ro=new ResizeObserver(()=>map.resize());ro.observe(el.current);
    return()=>{ctrl.abort();ro.disconnect();map.remove();mapRef.current=null;};
  },[]);
  useEffect(()=>{const map=mapRef.current;if(!map)return;const update=()=>{const b=aoi?.split(',').map(Number);const source=map.getSource('area') as ml.GeoJSONSource|undefined;source?.setData({type:'FeatureCollection',features:b?.length===4?[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]]]}}]:[]});};if(map.isStyleLoaded())update();else map.once('load',update);return()=>{map.off('load',update);};},[aoi]);
  return <section aria-label="Mapa mundial"><div className="relative"><div ref={el} className="h-[420px] w-full"/><button className="btn absolute top-3 left-3" aria-pressed={draw} onClick={()=>{drawing.current=!draw;first.current=null;setDraw(!draw);setMessage(!draw?'Marca dos esquinas en el mapa. También puedes escribir los límites debajo.':'Dibujo cancelado.');}}>{draw?'Cancelar dibujo':'Dibujar área rectangular'}</button></div><p role="status" className="p-2 text-sm">{message || 'Elige un país. Para delimitar un área, marca dos esquinas o escribe las coordenadas.'}</p></section>;
}
