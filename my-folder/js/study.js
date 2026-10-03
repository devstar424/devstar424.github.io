(async()=>{
  const root = QD.q('#paperRoot');
  const error = QD.q('#errorBox');
  const file = QD.getParam('file');

  QD.q('#backBtn').onclick = () =>
    history.length > 1 ? history.back() : QD.go('index.html');

  QD.q('#homeBtn').onclick = () => QD.go('index.html');

  QD.q('#printBtn').onclick = () => window.print();

  if(!file){
    error.textContent = 'No study file selected. Go back to the library.';
    error.classList.remove('hidden');
    return;
  }

  try{
    const s = await QD.loadJSON(file + '.json');
    await render(s);
  }catch(e){
    console.error(e);
    error.textContent = e.message || 'Unable to load this study.';
    error.classList.remove('hidden');
  }


  /* =========================================================
     CONFIG
     ========================================================= */

  const PAGE_WIDTH_MM = 210;
  const PAGE_HEIGHT_MM = 297;

  /*
   * Keep the same dimensions as the CSS.
   * Footer occupies its own protected area.
   */
  const PAGE_PADDING_TOP_MM = 16;
  const PAGE_PADDING_RIGHT_MM = 16;
  const PAGE_PADDING_BOTTOM_MM = 18;
  const PAGE_PADDING_LEFT_MM = 16;

  const FOOTER_HEIGHT_MM = 7;
  const FOOTER_BOTTOM_MM = 7;

  /*
   * Small safety buffer prevents a browser rounding error
   * from pushing the last line onto another physical page.
   */
  const SAFETY_PX = 6;


  /* =========================================================
     BASIC HELPERS
     ========================================================= */

  function esc(value){
    return QD.escape(
      value === null || value === undefined ? '' : String(value)
    );
  }

  function safeArray(value){
    return Array.isArray(value) ? value : [];
  }

  function safeText(value, fallback = ''){
    return value === null || value === undefined
      ? fallback
      : String(value);
  }

  function safeHTML(value){
    return value === null || value === undefined ? '' : String(value);
  }


  /* =========================================================
     PAGE CREATOR
     ========================================================= */

  function createEmptyPaper(pageNumber, meta){
    const page = document.createElement('section');

    page.className = 'paper';

    page.innerHTML = `
      <div class="paper-content"></div>

      <footer class="page-footer">
        <span>${esc(meta.pdf_id)} · ${esc(meta.surah_name)} ${esc(meta.range)}</span>
        <span>Page ${pageNumber}</span>
      </footer>
    `;

    return page;
  }


  /* =========================================================
     PAGE CONTENT HEIGHT
     ========================================================= */

  function getUsableHeight(page){
    const content = page.querySelector('.paper-content');

    if(!content) return 0;

    /*
     * The CSS already reserves bottom padding.
     * We additionally protect the footer area.
     */
    const pageHeight = page.clientHeight;

    const computed = window.getComputedStyle(page);

    const paddingTop = parseFloat(computed.paddingTop) || 0;
    const paddingBottom = parseFloat(computed.paddingBottom) || 0;

    const footerSpace =
      mmToPx(FOOTER_HEIGHT_MM + FOOTER_BOTTOM_MM);

    return Math.max(
      0,
      pageHeight -
      paddingTop -
      paddingBottom -
      footerSpace -
      SAFETY_PX
    );
  }


  function mmToPx(mm){
    const probe = document.createElement('div');

    probe.style.width = `${mm}mm`;
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';

    document.body.appendChild(probe);

    const px = probe.getBoundingClientRect().width;

    probe.remove();

    return px;
  }


  /* =========================================================
     WAIT FOR BROWSER LAYOUT
     ========================================================= */

  function nextFrame(){
    return new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );
  }


  /* =========================================================
     MEASURE A PAGE
     ========================================================= */

  function contentFits(page){
    const content = page.querySelector('.paper-content');

    if(!content) return true;

    const usableHeight = getUsableHeight(page);

    return content.scrollHeight <= usableHeight + SAFETY_PX;
  }


  /* =========================================================
     ADD BLOCK WITH AUTOMATIC PAGE BREAK
     ========================================================= */

  async function addBlock(blockHTML, state){
    const temp = document.createElement('div');

    temp.innerHTML = blockHTML.trim();

    const nodes = Array.from(temp.childNodes);

    for(const node of nodes){

      if(
        node.nodeType === Node.TEXT_NODE &&
        !node.textContent.trim()
      ){
        continue;
      }

      const currentPage = state.currentPage;
      const content = currentPage.querySelector('.paper-content');

      const clone = node.cloneNode(true);

      content.appendChild(clone);

      await nextFrame();

      /*
       * If it fits, continue.
       */
      if(contentFits(currentPage)){
        continue;
      }

      /*
       * Remove overflowing block.
       */
      clone.remove();

      /*
       * Create next A4 page.
       */
      state.pageNumber++;

      const newPage = createEmptyPaper(
        state.pageNumber,
        state.meta
      );

      state.pages.appendChild(newPage);

      state.currentPage = newPage;

      const newContent =
        newPage.querySelector('.paper-content');

      /*
       * If the block itself fits on a fresh page,
       * place it there.
       */
      newContent.appendChild(node.cloneNode(true));

      await nextFrame();

      /*
       * If even a single block is taller than one A4 page,
       * we cannot safely split arbitrary HTML.
       *
       * Instead mark it so the user knows which block
       * needs smaller typography/content grouping.
       */
      if(!contentFits(newPage)){
        const oversized =
          newContent.lastElementChild;

        if(oversized){
          oversized.classList.add('oversized-content');
        }
      }
    }
  }


  /* =========================================================
     ADD A COMPLETE SECTION
     ========================================================= */

  async function addSection(html, state){
    await addBlock(html, state);
  }


  /* =========================================================
     RENDER
     ========================================================= */

  async function render(s){

    document.title =
      `${s.project.pdf_id} · ${s.study_range.surah_name} ${s.study_range.range}`;

    QD.q('#toolbarTitle').textContent =
      `${s.project.pdf_id} · ${s.study_range.surah_name} · ${s.study_range.range}`;

    const meta = {
      pdf_id: s.project.pdf_id,
      surah_name: s.study_range.surah_name,
      range: s.study_range.range
    };

    /*
     * We first create a temporary hidden measurement root.
     * This allows the browser to calculate actual A4 heights
     * before the user sees the final result.
     */
    const measurementRoot = document.createElement('div');

    measurementRoot.id = 'a4MeasurementRoot';

    measurementRoot.style.position = 'absolute';
    measurementRoot.style.left = '-100000px';
    measurementRoot.style.top = '0';
    measurementRoot.style.width = '210mm';
    measurementRoot.style.visibility = 'hidden';
    measurementRoot.style.pointerEvents = 'none';

    document.body.appendChild(measurementRoot);

    const state = {
      pages: measurementRoot,
      currentPage: null,
      pageNumber: 0,
      meta
    };


    /* =======================================================
       PAGE 1 — COVER
       ======================================================= */

    state.pageNumber++;

    state.currentPage =
      createEmptyPaper(state.pageNumber, meta);

    measurementRoot.appendChild(state.currentPage);

    await addSection(`
      <div class="cover">
        <div class="page-content">

          <div class="page-kicker">
            ${esc(s.project.name)}
          </div>

          <h1 class="page-title">
            ${esc(s.study_range.surah_name)}
          </h1>

          <div class="range">
            Ayat ${esc(s.study_range.ayah_start)}
            –
            ${esc(s.study_range.ayah_end)}
          </div>

          <div class="cover-rule"></div>

          <p class="lead">
            ${esc(s.surah_info.name_meaning || 'Deep Quran study')}
          </p>

          <div class="meta-grid">

            <div class="meta-item">
              <b>PDF ID</b>
              <span>${esc(s.project.pdf_id)}</span>
            </div>

            <div class="meta-item">
              <b>Revelation</b>
              <span>
                ${esc(
                  s.surah_info.classification?.makki_or_madani || ''
                )}
              </span>
            </div>

            <div class="meta-item">
              <b>Ayat</b>
              <span>${esc(s.study_range.range)}</span>
            </div>

            <div class="meta-item">
              <b>Language</b>
              <span>Natural Hinglish</span>
            </div>

          </div>

        </div>
      </div>
    `, state);


    /* =======================================================
       PAGE 2 — CONTENTS
       ======================================================= */

    state.pageNumber++;

    state.currentPage =
      createEmptyPaper(state.pageNumber, meta);

    measurementRoot.appendChild(state.currentPage);

    const sectionTOC = safeArray(s.sections)
      .map((x,i)=>`
        <li>
          <span>
            ${esc(x.title)} · ${esc(x.ayah_range)}
          </span>
          <b>${String(i + 3).padStart(2,'0')}</b>
        </li>
      `)
      .join('');

    await addSection(`
      <div class="section-label">
        📚 Study Library
      </div>

      <h1 class="page-title">
        Contents
      </h1>

      <p class="lead">
        Is PDF mein pehle poora passage, phir section-wise flow
        aur ayat-by-ayat deep study hai.
      </p>

      <ul class="toc-list">

        <li>
          <span>Surah Introduction</span>
          <b>01</b>
        </li>

        <li>
          <span>Complete Passage</span>
          <b>02</b>
        </li>

        ${sectionTOC}

        <li>
          <span>PDF Range Conclusion</span>
          <b>End</b>
        </li>

        <li>
          <span>Surah Conclusion</span>
          <b>End</b>
        </li>

        <li>
          <span>Sources & Quality Control</span>
          <b>End</b>
        </li>

      </ul>

      <div class="callout">
        💡
        <b>Reading rule:</b>
        Arabic → transliteration → Roman Urdu →
        English meaning → Simple → Deep.
        Modern application ko tafsir ka substitute nahi samjho.
      </div>
    `, state);


    /* =======================================================
       SURAH INTRODUCTION
       ======================================================= */

    state.pageNumber++;

    state.currentPage =
      createEmptyPaper(state.pageNumber, meta);

    measurementRoot.appendChild(state.currentPage);

    const themes = safeArray(s.surah_info.themes)
      .map(x=>`
        <span class="badge">${esc(x)}</span>
      `)
      .join(' ');

    await addSection(`
      <div class="section-label">
        🧭 Surah Introduction
      </div>

      <h1 class="page-title">
        ${esc(s.study_range.surah_name)} · Background
      </h1>

      <p class="lead">
        ${esc(s.surah_info.introduction)}
      </p>

      <div class="two-col">

        <div class="depth-box">
          <h3>Kya?</h3>
          <p>${esc(s.surah_info.what)}</p>
        </div>

        <div class="depth-box">
          <h3>Kyun?</h3>
          <p>${esc(s.surah_info.why)}</p>
        </div>

        <div class="depth-box">
          <h3>Kab / Kahan?</h3>
          <p>${esc(s.surah_info.when_where)}</p>
        </div>

        <div class="depth-box">
          <h3>Kaise padhna?</h3>
          <p>${esc(s.surah_info.how_to_study)}</p>
        </div>

      </div>

      <div class="callout gold">
        <b>Known vs debated:</b>
        ${esc(s.surah_info.known_vs_debated)}
      </div>

      <h3>Main themes</h3>

      <p>${themes}</p>
    `, state);


    /* =======================================================
       COMPLETE PASSAGE
       ======================================================= */

    for(const a of safeArray(s.complete_passage?.ayahs)){

      await addSection(`
        <div class="depth-box">

          <div class="ayah-header">
            <h3>Ayat ${esc(a.ayah)}</h3>

            <span class="ayah-number">
              ${esc(a.reference)}
            </span>
          </div>

          <div class="arabic">
            ${safeHTML(a.arabic)}
          </div>

          <p class="translit">
            ${esc(a.transliteration)}
          </p>

          <p class="meaning">
            <strong>Roman Urdu:</strong>
            ${esc(a.roman_urdu)}
          </p>

          <p class="meaning">
            <strong>English:</strong>
            ${esc(a.english_meaning)}
          </p>

        </div>
      `, state);
    }


    /* =======================================================
       SECTIONS
       ======================================================= */

    for(const sec of safeArray(s.sections)){

      await addSection(`
        <div class="section-label">
          🧩 Section
        </div>

        <h1 class="page-title">
          ${esc(sec.title)}
        </h1>

        <div class="pill">
          Ayat ${esc(sec.ayah_range)}
        </div>

        <p class="lead">
          ${esc(sec.theme)}
        </p>

        <div class="depth-box">
          <h3>Flow</h3>
          <p>${esc(sec.flow)}</p>
        </div>

        <div class="depth-box">
          <h3>Section summary</h3>
          <p>${esc(sec.summary)}</p>
        </div>

        <div class="callout">
          ${esc(sec.study_note)}
        </div>
      `, state);
    }


    /* =======================================================
       AYAT STUDY
       ======================================================= */

    for(const a of safeArray(s.ayahs)){

      const words =
        safeArray(a.important_arabic_words)
          .map(w=>`
            <tr>

              <td dir="rtl" lang="ar">
                ${safeHTML(w.arabic)}
              </td>

              <td>${esc(w.transliteration)}</td>

              <td>${esc(w.meaning)}</td>

              <td>${esc(w.root)}</td>

              <td>${esc(w.word_form)}</td>

              <td>${esc(w.literal_meaning)}</td>

              <td>${esc(w.contextual_meaning)}</td>

            </tr>
          `)
          .join('');


      /* ---------- AYAT CORE ---------- */

      await addSection(`
        <div class="section-label">
          📝 Ayat-by-ayat Study
        </div>

        <div class="ayah-header">

          <h1 class="page-title">
            Ayat ${esc(a.ayah)}
          </h1>

          <span class="ayah-number">
            ${esc(a.reference)}
          </span>

        </div>

        <div class="arabic">
          ${safeHTML(a.arabic)}
        </div>

        <p class="translit">
          <b>Transliteration:</b>
          ${esc(a.transliteration)}
        </p>

        <p class="meaning">
          <strong>Roman Urdu:</strong>
          ${esc(a.roman_urdu)}
        </p>

        <p class="meaning">
          <strong>English:</strong>
          ${esc(a.english_meaning)}
        </p>

        <div class="depth-box">
          <h3>🟢 Simple</h3>
          <p>${esc(a.simple)}</p>
        </div>

        <div class="depth-box">
          <h3>🔎 Deep</h3>
          <p>${esc(a.deep)}</p>
        </div>

        <div class="two-col">

          <div class="depth-box">
            <h3>Main message</h3>
            <p>${esc(a.main_message)}</p>
          </div>

          <div class="depth-box">
            <h3>Why it matters</h3>
            <p>${esc(a.why_it_matters)}</p>
          </div>

        </div>
      `, state);


      /* ---------- WORDS / LANGUAGE ---------- */

      await addSection(`
        <div class="section-label">
          🔬 Ayat ${esc(a.ayah)} · Detail
        </div>

        <h1 class="page-title">
          Arabic words & language
        </h1>

        <div class="word-table-wrap">

          <table class="word-table">

            <thead>
              <tr>
                <th>Arabic</th>
                <th>Transliteration</th>
                <th>Meaning</th>
                <th>Root</th>
                <th>Form</th>
                <th>Literal</th>
                <th>Context</th>
              </tr>
            </thead>

            <tbody>
              ${words}
            </tbody>

          </table>

        </div>

        <div class="two-col">

          <div class="depth-box">
            <h3>Grammar / rhetoric</h3>
            <p>${esc(a.grammar_rhetoric)}</p>
          </div>

          <div class="depth-box">
            <h3>Context</h3>
            <p>${esc(a.historical_context)}</p>
          </div>

        </div>

        <div class="callout">
          <b>Common misunderstanding:</b>
          ${esc(a.common_misunderstandings)}
        </div>

        <div class="callout gold">
          <b>What it does not mean:</b>
          ${esc(a.what_it_does_not_mean)}
        </div>
      `, state);


      /* ---------- CONNECTIONS ---------- */

      await addSection(`
        <div class="section-label">
          🌍 Connections
        </div>

        <h1 class="page-title">
          Ayat ${esc(a.ayah)} · Connections & application
        </h1>

        <div class="two-col">

          <div class="depth-box">
            <h3>Quran connections</h3>
            <p>${esc(a.connected_ayat)}</p>
          </div>

          <div class="depth-box">

            <h3>Hadith</h3>

            <p>
              ${esc(
                a.hadith?.summary ||
                'No specific Hadith added.'
              )}
            </p>

            ${
              a.hadith?.reference
              ? `
                <small>
                  ${esc(a.hadith.reference)}
                  ·
                  ${esc(a.hadith.status || '')}
                </small>
              `
              : ''
            }

          </div>

          <div class="depth-box">

            <h3>History / archaeology</h3>

            <p>
              ${esc(
                a.history_evidence ||
                'Not central to this ayah; no forced historical claim.'
              )}
            </p>

          </div>

          <div class="depth-box">

            <h3>Science</h3>

            <p>
              ${esc(
                a.science?.summary ||
                'No scientific claim needed for this ayah.'
              )}
            </p>

            ${
              a.science?.status
              ? `
                <span class="badge ${esc(
                  a.science.status_class || ''
                )}">
                  ${esc(a.science.status)}
                </span>
              `
              : ''
            }

          </div>

        </div>

        <div class="depth-box">
          <h3>Real-life example</h3>
          <p>${esc(a.real_life_example)}</p>
        </div>

        <div class="depth-box">

          <h3>
            Modern Life Connection
            <small>(application, tafsir nahi)</small>
          </h3>

          <p>
            ${esc(a.modern_world_connection)}
          </p>

        </div>
      `, state);


      /* ---------- REFLECTION ---------- */

      await addSection(`
        <div class="section-label">
          🧠 Reflection
        </div>

        <h1 class="page-title">
          Ayat ${esc(a.ayah)} · Think → Act
        </h1>

        <div class="two-col">

          <div class="depth-box">

            <h3>Known / debated / unknown</h3>

            <p>
              ${esc(a.knowledge_status)}
            </p>

          </div>

          <div class="depth-box">

            <h3>Future / forward-looking context</h3>

            <p>
              ${esc(a.future_or_forward_looking_context)}
            </p>

          </div>

        </div>

        <div class="depth-box">

          <h3>Q&A</h3>

          <div>

            ${
              safeArray(a.qa)
                .map(q=>`
                  <p>
                    <b>Q:</b> ${esc(q.q)}
                    <br>
                    <b>A:</b> ${esc(q.a)}
                  </p>
                `)
                .join('')
            }

          </div>

        </div>

        <div class="two-col">

          <div class="depth-box">
            <h3>Night reflection</h3>
            <p>${esc(a.night_reflection)}</p>
          </div>

          <div class="depth-box">
            <h3>Personal action</h3>
            <p>${esc(a.personal_action)}</p>
          </div>

        </div>

        <div class="notes-box"></div>

        <small>
          Personal notes
        </small>
      `, state);

    }


    /* =======================================================
       PDF RANGE CONCLUSION
       ======================================================= */

    await addSection(`
      <div class="section-label">
        🎯 PDF-range Conclusion
      </div>

      <h1 class="page-title">
        ${esc(s.study_range.range)}
        · What should stay with me?
      </h1>

      <div class="conclusion-card">

        <p>
          ${esc(
            s.pdf_range_conclusion.complete_summary
          )}
        </p>

      </div>

      <div
        class="action-grid"
        style="margin-top:14px"
      >

        ${
          [
            ['What', s.pdf_range_conclusion.what_it_teaches],
            ['Why', s.pdf_range_conclusion.why_it_matters],
            ['What to do', s.pdf_range_conclusion.what_i_should_do],
            ['How', s.pdf_range_conclusion.how_to_apply],
            ['What to avoid', s.pdf_range_conclusion.what_to_avoid],
            ['One-line reminder', s.pdf_range_conclusion.one_sentence_reminder]
          ]
          .map(x=>`
            <div class="depth-box">

              <h3>${esc(x[0])}</h3>

              <p>
                ${esc(x[1])}
              </p>

            </div>
          `)
          .join('')
        }

      </div>
    `, state);


    /* =======================================================
       SURAH CONCLUSION
       ======================================================= */

    await addSection(`
      <div class="section-label">
        🌙 Surah Conclusion
      </div>

      <h1 class="page-title">
        ${esc(s.study_range.surah_name)}
        · Full Surah Synthesis
      </h1>

      <div class="conclusion-card">

        <p>
          ${esc(
            s.surah_conclusion.complete_summary
          )}
        </p>

      </div>

      <div
        class="two-col"
        style="margin-top:12px"
      >

        ${
          [
            ['What it teaches', s.surah_conclusion.what_it_teaches],
            ['Why it matters', s.surah_conclusion.why_it_matters],
            ['What I should understand', s.surah_conclusion.what_i_should_understand],
            ['What I should do', s.surah_conclusion.what_i_should_do],
            ['How to apply', s.surah_conclusion.how_to_apply],
            ['What to avoid', s.surah_conclusion.what_to_avoid]
          ]
          .map(x=>`
            <div class="depth-box">

              <h3>${esc(x[0])}</h3>

              <p>
                ${esc(x[1])}
              </p>

            </div>
          `)
          .join('')
        }

      </div>

      <div class="callout">

        <b>One-sentence lesson:</b>
        ${esc(s.surah_conclusion.one_sentence_lesson)}

        <br>

        <b>One-sentence action:</b>
        ${esc(s.surah_conclusion.one_sentence_action)}

      </div>
    `, state);


    /* =======================================================
       SOURCES + QA
       ======================================================= */

    const qaHTML =
      Object.entries(s.quality_control || {})
        .filter(([k]) => k !== 'notes')
        .map(([k,v])=>`
          <div class="qa">

            <b>${esc(k)}</b>

            <span>
              ${
                esc(
                  typeof v === 'object'
                    ? JSON.stringify(v)
                    : v
                )
              }
            </span>

          </div>
        `)
        .join('');


    const sourcesHTML =
      safeArray(s.sources)
        .map(x=>`
          <li>

            <b>${esc(x.type)}:</b>
            ${esc(x.title)}
            ·
            ${esc(x.reference)}

            ${
              x.url
              ? `
                ·
                <a
                  href="${esc(x.url)}"
                  target="_blank"
                  rel="noopener"
                >
                  source
                </a>
              `
              : ''
            }

          </li>
        `)
        .join('');


    await addSection(`
      <div class="section-label">
        🔍 Sources & QA
      </div>

      <h1 class="page-title">
        Research Notes
      </h1>

      <div class="qa-grid">
        ${qaHTML}
      </div>

      <h3>Sources</h3>

      <ul class="source-list">
        ${sourcesHTML}
      </ul>

      <div class="callout">

        ${esc(
          s.project.human_review_note ||
          'AI-generated study content; human scholarly review has not been performed.'
        )}

      </div>
    `, state);


    /* =======================================================
       FINALIZE
       ======================================================= */

    /*
     * Replace the old root only after all pages are measured.
     * This prevents visible page jumping during pagination.
     */
    root.innerHTML = '';

    const finalPages =
      Array.from(
        measurementRoot.querySelectorAll('.paper')
      );

    /*
     * Rebuild footer numbers because a block can create
     * additional pages.
     */
    finalPages.forEach((page,index)=>{

      const footer =
        page.querySelector('.page-footer');

      if(footer){

        footer.innerHTML = `
          <span>
            ${esc(meta.pdf_id)}
            ·
            ${esc(meta.surah_name)}
            ${esc(meta.range)}
          </span>

          <span>
            Page ${index + 1}
          </span>
        `;

      }

    });


    finalPages.forEach(page=>{
      root.appendChild(page);
    });


    /*
     * Remove measurement container.
     */
    measurementRoot.remove();


    /*
     * Run the project's existing page-number helper
     * only if available.
     */
    if(typeof QD.numberPages === 'function'){
      QD.numberPages(root);
    }

  }

})();