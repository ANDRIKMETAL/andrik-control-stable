
(function(){
  function unlock(){
    var auth=document.getElementById('analyticsAuthText');
    if(auth && /Проверяем доступ|обновляем данные/i.test(auth.textContent||'')){
      auth.textContent='Сервер отвечает медленно · потяните вниз для повтора';
      var row=auth.closest('.control-auth-state,.analytics-auth-state,.control-access-state');
      if(row){row.classList.remove('is-ok');row.classList.add('is-warning');}
    }
    var map=document.getElementById('worldMap');
    var state=map && map.querySelector('.world-map-state');
    if(state && /Обновляем|Получаем|Загружаем/i.test(state.textContent||'')){
      state.textContent='Повторите обновление свайпом вниз';
      state.classList.add('is-warning');
    }
  }
  setTimeout(unlock,12000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)setTimeout(unlock,1500);});
})();
