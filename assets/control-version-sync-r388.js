(()=>{
  const apply=()=>{
    document.querySelectorAll('.control-version-footer strong').forEach(el=>{if(el.textContent.includes('R388')) return;});
    document.querySelectorAll('.control-version-footer').forEach(el=>{
      const strong=el.querySelector('strong');
      const span=el.querySelector('span');
      if(strong && /LIVE WEB AI FINAL/i.test(strong.textContent)) strong.textContent='Live Web AI · профиль ANDRIK · v55.00 LIVE WEB AI FINAL R388';
      if(span && !span.textContent.includes('R388') && !/История/.test(span.textContent)) span.textContent='R388';
    });
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  window.addEventListener('pageshow',apply,{passive:true});
})();
