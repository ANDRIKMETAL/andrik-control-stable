(()=>{
  const hero=document.querySelector('.lyra-hero-r562');
  const img=document.getElementById('lyraHeroPoster');
  if(!hero||!img||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let start=performance.now(),raf=0,visible=true;
  const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(visible&&!raf)raf=requestAnimationFrame(tick)},{threshold:.01});
  io.observe(hero);
  function tick(now){
    raf=0;
    if(!visible)return;
    const t=(now-start)/1000;
    const x=Math.sin(t*.42)*2.2;
    const y=Math.cos(t*.33)*1.6;
    const scale=1.035+Math.sin(t*.48)*.0045;
    hero.style.setProperty('--lyra-x',x.toFixed(2)+'px');
    hero.style.setProperty('--lyra-y',y.toFixed(2)+'px');
    hero.style.setProperty('--lyra-scale',scale.toFixed(4));
    hero.style.setProperty('--lyra-glow-x',(52+Math.sin(t*.27)*3).toFixed(1)+'%');
    hero.style.setProperty('--lyra-glow-y',(34+Math.cos(t*.31)*2).toFixed(1)+'%');
    raf=requestAnimationFrame(tick);
  }
  raf=requestAnimationFrame(tick);
})();
