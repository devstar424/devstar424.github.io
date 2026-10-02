(async()=>{
  const grid=QD.q('#studyGrid'), empty=QD.q('#emptyState'), search=QD.q('#searchInput'), sort=QD.q('#sortSelect'), count=QD.q('#studyCount');
  let studies=[];
  try{studies=await (await fetch('data/library.json')).json()}catch(e){grid.innerHTML='<div class="empty-state">Library manifest could not be loaded. Open this folder through a local web server rather than file://.</div>';return}
  count.textContent=studies.length;
  function render(){
    const term=search.value.trim().toLowerCase();
    let list=studies.filter(x=>[x.pdf_id,x.surah_name,x.ayah_range].join(' ').toLowerCase().includes(term));
    list.sort((a,b)=>sort.value==='surah'?a.surah_number-b.surah_number||a.ayah_start-b.ayah_start:a.pdf_id.localeCompare(b.pdf_id,undefined,{numeric:true}));
    grid.innerHTML=list.map(x=>`<article class="study-card"><div class="card-top"><span class="pdf-id">${QD.escape(x.pdf_id)}</span><span class="range-badge">${QD.escape(x.ayah_range)}</span></div><h3>${QD.escape(x.surah_name)}</h3><p class="subtitle">${QD.escape(x.subtitle||'Deep Quran study')}</p><div class="card-bottom"><small>${QD.escape(x.file_name)}</small><button class="open-link" data-file="${QD.escape(x.file_name)}">Open Study →</button></div></article>`).join('');
    empty.classList.toggle('hidden',list.length>0);
    grid.querySelectorAll('.open-link').forEach(btn=>btn.addEventListener('click',()=>location.href=`study.html?file=${encodeURIComponent(btn.dataset.file)}`));
  }
  search.addEventListener('input',render);sort.addEventListener('change',render);render();
})();
