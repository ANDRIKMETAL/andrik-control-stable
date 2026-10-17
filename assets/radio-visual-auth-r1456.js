(()=>{'use strict';
// Shared by fetch and XHR uploads. The marker is not an ADMIN_KEY.
const sentinel='__ANDRIK_OWNER_SESSION_R197__',tokenHeader='x-andrik-owner-token';
const stored=(type,key)=>{try{return String(window[type].getItem(key)||'').trim()}catch(_){return ''}};
const real=value=>{value=String(value||'').trim();return value&&value!==sentinel?value:''};
function rawKey(){
 if(window.AndrikOwnerSession?.isActive?.())return '';
 const entered=real(document.getElementById('key')?.value);if(entered)return entered;
 return [window.AndrikOwnerSession?.runtimeKey?.(),
  stored('sessionStorage','andrik-r655-admin-key'),stored('sessionStorage','andrik-radio-visuals-key-r620'),
  stored('localStorage','andrik-comments-admin-key-persistent'),stored('sessionStorage','andrik-comments-admin-key')].map(real).find(Boolean)||'';
}
function token(){return window.AndrikOwnerSession?.signedToken?.()||stored('localStorage','andrik-owner-session-token-r197')||stored('sessionStorage','andrik-owner-session-token-r197')}
function headers(extra={}){const key=rawKey(),signed=token();return {accept:'application/json',...(key?{authorization:'Bearer '+key}:{}),...(signed?{[tokenHeader]:signed}:{}),...extra}}
function status(){const msg=document.getElementById('authMsg');if(msg&&window.AndrikOwnerSession?.isActive?.())msg.textContent='Вход подтверждён. Повторно вводить ADMIN_KEY не нужно.'}
async function ensure(){
 const owner=window.AndrikOwnerSession;
 if(owner?.ready)await owner.ready().catch(()=>null);
 if(owner?.ensure){try{await owner.ensure(owner.isActive?.()?'':rawKey());status();return}catch(error){if(error.status===401){const e=Error('Сессия входа не подтверждена. Открой контрольку и войди снова.');e.status=401;throw e}throw error}}
 // The signed header and same-origin cookie are still usable if the helper failed to load.
}
function error(data,status){return status===401?'Сессия входа не подтверждена. Открой контрольку и войди снова.':data.message||data.error||('HTTP '+status)}
window.AndrikRadioVisualAuth={headers,ensure,error,status};
window.addEventListener('andrik-owner-session',status);
document.addEventListener('DOMContentLoaded',()=>{window.AndrikOwnerSession?.ready?.().then(status).catch(()=>{})});
})();
