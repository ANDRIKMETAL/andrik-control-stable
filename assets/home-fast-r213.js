(()=>{
  const body=document.body;
  if(!body)return;
  const sync=()=>body.classList.toggle('is-page-hidden',document.hidden);
  document.addEventListener('visibilitychange',sync,{passive:true});
  sync();
})();
