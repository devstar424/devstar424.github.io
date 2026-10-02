window.QD = window.QD || {};
QD.q = (s,root=document) => root.querySelector(s);
QD.escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
QD.getParam = name => new URLSearchParams(location.search).get(name);
QD.go = url => { location.href = url; };
QD.page = (content, meta, extra='') => `<article class="paper ${extra}"><div class="page-content">${content}</div><footer class="page-footer"><span>${QD.escape(meta.pdf_id)} · ${QD.escape(meta.surah_name)} · ${QD.escape(meta.range)}</span><span class="page-number"></span></footer></article>`;
QD.numberPages = root => [...root.querySelectorAll('.paper')].forEach((p,i)=>{const n=p.querySelector('.page-number');if(n)n.textContent=`Page ${i+1}`});
QD.loadJSON = async file => {const r=await fetch(`data/${encodeURIComponent(file)}`);if(!r.ok)throw new Error(`Could not load ${file} (${r.status})`);return r.json()};
