(() => {
  'use strict';
  const apply = () => {
    const body = document.body;
    if (!body) return;
    body.classList.add('unified-glow-ready');
    const params = new URLSearchParams(location.search);
    if (params.get('embed') === '1') body.classList.add('unified-glow-embed');
    const page = (params.get('page') || '').toLowerCase();
    const path = location.pathname.replace(/\/+$/, '/');
    const isMap = body.classList.contains('analytics-admin-page') && (page === '' || page === 'map' || path.endsWith('/admin/'));
    if (isMap) body.classList.add('unified-glow-map-view');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, {once:true});
  else apply();
})();
