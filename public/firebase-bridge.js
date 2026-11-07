(() => {
"use strict";
const RENDER_BACKEND="https://manager-bot-1-6167.onrender.com";
const isRenderBackend=/(^|\.)onrender\.com$/i.test(location.hostname);
// Use the Render API from Firebase Hosting and all Firebase custom domains.
const backendOrigin=isRenderBackend?location.origin:RENDER_BACKEND;
const sessionKey="starry_dashboard_session";
function safeGet(storageName,key){try{return window[storageName].getItem(key)}catch(_){return null}}
function safeSet(storageName,key,value){try{window[storageName].setItem(key,value);return true}catch(_){return false}}
function safeRemove(storageName,key){try{window[storageName].removeItem(key)}catch(_){}}
function getStoredSession(){return safeGet("localStorage",sessionKey)||safeGet("sessionStorage",sessionKey)}
function storeSession(token){
 const tabSaved=safeSet("sessionStorage",sessionKey,token);
 const durableSaved=safeSet("localStorage",sessionKey,token);
 if(!durableSaved)safeRemove("localStorage",sessionKey);
 return durableSaved||tabSaved
}
function clearStoredSession(){safeRemove("localStorage",sessionKey);safeRemove("sessionStorage",sessionKey)}
(function captureSessionFromUrl(){
 let params;try{params=new URLSearchParams(window.location.search)}catch(_){return}
 if(!params.has("session"))return;
 const token=params.get("session");
 if(token)storeSession(token);
 params.delete("session");const cleanQuery=params.toString();
 // OAuth currently returns to dashboard.html. Store the token, then return to
 // the homepage so its Discord profile controls can render immediately.
 if(window.location.pathname.endsWith("/dashboard.html")){
  try{window.location.replace("/"+(cleanQuery?"?"+cleanQuery:"")+window.location.hash);return}catch(_){}
 }
 try{window.history.replaceState(window.history.state,document.title,window.location.pathname+(cleanQuery?"?"+cleanQuery:"")+window.location.hash)}catch(_){}
})();
function isBackendPath(pathname){return pathname.startsWith("/api/")||pathname.startsWith("/auth/")||pathname==="/setup"||pathname.startsWith("/verify")||pathname==="/vote"||pathname==="/health"||pathname==="/ping"}
const nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init){
 let rawUrl=typeof input==="string"?input:(input instanceof URL?input.href:input.url),parsed;
 try{parsed=new URL(rawUrl,location.href)}catch(_){return nativeFetch(input,init)}
 if(parsed.origin!==location.origin||!isBackendPath(parsed.pathname))return nativeFetch(input,init);
 const target=backendOrigin+parsed.pathname+parsed.search+parsed.hash;
 const headers=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined));
 const token=getStoredSession();if(token)headers.set("Authorization","Bearer "+token);
 const requestInput=input instanceof Request?new Request(target,input):target;
 return nativeFetch(requestInput,{...(init||{}),headers,mode:"cors"}).then(response=>{
  // Only a failed canonical session check may invalidate the saved login.
  if(response.status===401&&parsed.pathname==="/auth/user")clearStoredSession();
  if(parsed.pathname==="/auth/logout"&&response.ok)clearStoredSession();
  if(parsed.pathname==="/auth/user"&&response.ok)response.clone().json().then(data=>{if(data&&data.authenticated===false)clearStoredSession()}).catch(()=>{});
  return response
 })
};
function rewriteBackendLinks(root){(root||document).querySelectorAll("a[href], form[action]").forEach(element=>{
 const attr=element.tagName==="FORM"?"action":"href",value=element.getAttribute(attr);if(!value||!value.startsWith("/"))return;
 const parsed=new URL(value,location.origin);
 if(isBackendPath(parsed.pathname))element.setAttribute(attr,backendOrigin+parsed.pathname+parsed.search+parsed.hash)
})}
document.addEventListener("DOMContentLoaded",()=>rewriteBackendLinks());
document.addEventListener("click",event=>{
 const link=event.target.closest&&event.target.closest("a[href]");if(!link)return;
 const parsed=new URL(link.href,location.href);
 if(parsed.origin===location.origin&&isBackendPath(parsed.pathname)){event.preventDefault();location.href=backendOrigin+parsed.pathname+parsed.search+parsed.hash}
},true);
})();