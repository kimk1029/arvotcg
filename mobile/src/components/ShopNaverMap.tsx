import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { WebView } from 'react-native-webview';

/**
 * Shop 지도 — 네이버 지도(NCP Web Dynamic Map v3)를 WebView 로 렌더 (웹 ShopNaverMap 과 페어).
 * Client ID(EXPO_PUBLIC_NCP_MAP_CLIENT_ID) 미설정이면 HAS_NAVER_MAP_KEY=false —
 * 부모(CommunityShop)가 일러스트 지도로 폴백한다.
 * baseUrl 은 NCP 콘솔에 등록된 웹 서비스 URL 이어야 SDK 도메인 인증을 통과한다.
 */

export interface ShopMapPin {
  id: string;
  name: string;
  emoji: string;
  addr: string;
  lat: number;
  lng: number;
}

const CLIENT_ID = process.env.EXPO_PUBLIC_NCP_MAP_CLIENT_ID ?? '';
export const HAS_NAVER_MAP_KEY = CLIENT_ID.length > 0;
const BASE_URL = process.env.EXPO_PUBLIC_NCP_MAP_BASE_URL ?? 'https://poke-30.com';

/** 지역 탭 포커스 — 핀이 없을 때 지도를 옮길 중심/줌 (정본 shared/shopRegions.REGION_FOCUS). */
export interface MapFocus {
  lat: number;
  lng: number;
  zoom: number;
}

function buildHtml(pins: ShopMapPin[], initialSelId: string, focus: MapFocus | null): string {
  return `<!doctype html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#E8EDE6;overflow:hidden;}</style>
</head><body><div id="map"></div><script>
var PINS=${JSON.stringify(pins)};
var SEL=${JSON.stringify(initialSelId)};
var FOCUS=${JSON.stringify(focus)};
var FIT_MAX_ZOOM=16;
var markers={};
var geo={};
var map=null;
function post(m){if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(m));}}
function pinHtml(p,sel){
  var label=p.name.split(' ')[0];
  return '<div style="position:relative;width:0;height:0;">'
    +'<div style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;">'
    +'<span style="display:inline-flex;align-items:center;gap:4px;background:'+(sel?'#16161a':'#fff')+';border:2px solid #fff;border-radius:16px;padding:4px 9px;box-shadow:0 4px 10px rgba(0,0,0,.22);white-space:nowrap;">'
    +'<span style="font-size:11px;line-height:1;">'+p.emoji+'</span>'
    +'<span style="font-size:11px;font-weight:800;color:'+(sel?'#fff':'#16161a')+';">'+label+'</span>'
    +'</span>'
    +'<span style="display:block;width:2px;height:7px;background:'+(sel?'#16161a':'#fff')+';"></span>'
    +'</div></div>';
}
function fitAll(){
  if(!map||!window.naver)return;
  var naver=window.naver.maps;
  var keys=Object.keys(markers);
  if(keys.length>0){
    var b=new naver.LatLngBounds();
    keys.forEach(function(k){b.extend(markers[k].getPosition());});
    map.fitBounds(b,{top:46,right:50,bottom:30,left:50});
    if(map.getZoom()>FIT_MAX_ZOOM){map.setZoom(FIT_MAX_ZOOM);}
  }else if(FOCUS){
    map.setCenter(new naver.LatLng(FOCUS.lat,FOCUS.lng));
    map.setZoom(FOCUS.zoom);
  }
}
/* 핀 목록을 마커와 동기화(전부 교체) → Geocoder 보정(캐시) → 프레이밍. 지역 탭 전환 시 RN 이 주입. */
function setPins(list,focus){
  if(!map||!window.naver)return;
  var naver=window.naver.maps;
  PINS=list;FOCUS=focus||null;
  Object.keys(markers).forEach(function(k){markers[k].setMap(null);});
  markers={};
  PINS.forEach(function(p){
    var g=geo[p.id];
    var m=new naver.Marker({
      position:new naver.LatLng(g?g.lat:p.lat,g?g.lng:p.lng),map:map,
      icon:{content:pinHtml(p,p.id===SEL),size:new naver.Size(0,0),anchor:new naver.Point(0,0)},
      zIndex:p.id===SEL?6:5
    });
    naver.Event.addListener(m,'click',function(){post({type:'select',id:p.id});});
    markers[p.id]=m;
  });
  fitAll();
  var todo=PINS.filter(function(p){return !geo[p.id];});
  if(todo.length===0||!(naver.Service&&naver.Service.geocode))return;
  var pending=todo.length;
  todo.forEach(function(p){
    naver.Service.geocode({query:p.addr},function(s,res){
      if(s===naver.Service.Status.OK){
        var a=res&&res.v2&&res.v2.addresses&&res.v2.addresses[0];
        if(a){
          var la=Number(a.y),ln=Number(a.x);
          if(isFinite(la)&&isFinite(ln)){geo[p.id]={lat:la,lng:ln};if(markers[p.id]){markers[p.id].setPosition(new naver.LatLng(la,ln));}}
        }
      }
      pending--;
      if(pending===0){fitAll();}
    });
  });
}
function init(){
  var naver=window.naver.maps;
  var opts={minZoom:9,maxZoom:19,mapTypeControl:false,logoControl:false,mapDataControl:false,scaleControl:false,zoomControl:false};
  if(PINS.length>0){
    var b=new naver.LatLngBounds();
    PINS.forEach(function(p){b.extend(new naver.LatLng(p.lat,p.lng));});
    opts.bounds=b;
  }else{
    opts.center=new naver.LatLng(FOCUS?FOCUS.lat:37.5665,FOCUS?FOCUS.lng:126.978);
    opts.zoom=FOCUS?FOCUS.zoom:12;
  }
  map=new naver.Map('map',opts);
  setPins(PINS,FOCUS);
  window.__setPins=setPins;
  window.__setSel=function(id){
    SEL=id;
    var naver=window.naver.maps;
    PINS.forEach(function(p){
      var m=markers[p.id];if(!m)return;
      m.setIcon({content:pinHtml(p,p.id===id),size:new naver.Size(0,0),anchor:new naver.Point(0,0)});
      m.setZIndex(p.id===id?6:5);
    });
  };
  window.__refit=fitAll;
  post({type:'ready'});
}
var s=document.createElement('script');
s.src='https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${CLIENT_ID}&submodules=geocoder';
s.async=true;
s.onload=function(){if(window.naver&&window.naver.maps){init();}else{post({type:'error',detail:'naver.maps undefined'});}};
s.onerror=function(){post({type:'error',detail:'sdk load failed'});};
document.head.appendChild(s);
</script></body></html>`;
}

interface Props {
  pins: ShopMapPin[];
  /** 지역 탭 중심. null 이면 핀 전체 프레이밍. */
  focus?: MapFocus | null;
  selId: string;
  onSelect: (id: string) => void;
}

export function ShopNaverMap({ pins, focus = null, selId, onSelect }: Props) {
  const webRef = useRef<WebView>(null);
  // HTML 은 마운트 시 1회 생성 — 선택/지역(핀·포커스) 변경은 JS 주입으로 반영 (리로드 방지)
  const [html] = useState(() => buildHtml(pins, selId, focus));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    webRef.current?.injectJavaScript(`window.__setSel&&window.__setSel(${JSON.stringify(selId)});true;`);
  }, [selId]);

  // 지역 탭 전환 → 핀 교체 + 프레이밍 (웹 ShopNaverMap 의 syncMarkers 와 동일 동작)
  const pinsKey = pins.map((p) => p.id).join(',');
  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(
      `window.__setPins&&window.__setPins(${JSON.stringify(pins)},${JSON.stringify(focus)});true;`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pinsKey, focus?.lat, focus?.lng, focus?.zoom]);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <WebView
        ref={webRef}
        source={{ html, baseUrl: BASE_URL }}
        originWhitelist={['*']}
        style={{ flex: 1, backgroundColor: '#E8EDE6' }}
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        setSupportMultipleWindows={false}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data) as { type?: string; id?: string };
            if (msg.type === 'select' && msg.id) onSelect(msg.id);
            if (msg.type === 'ready') setReady(true);
          } catch {
            /* ignore */
          }
        }}
      />
      <Pressable
        onPress={() => webRef.current?.injectJavaScript('window.__refit&&window.__refit();true;')}
        style={{ position: 'absolute', right: 12, bottom: 12, width: 36, height: 36, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 3 }}
      >
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#16161a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={3} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </Svg>
      </Pressable>
    </View>
  );
}
