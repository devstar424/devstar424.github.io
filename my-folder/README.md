QURAN DEEP STUDY · WEB-ONLY PROJECT

This project intentionally uses only:
- HTML
- CSS
- JavaScript
- JSON data

No backend, Python, PHP, Node.js, database, or build system is required by the project itself.

OPENING
1. Use a local web server because browser fetch() normally cannot read JSON files from file://.
2. Open index.html through that local server.

PAGES
- index.html = study library/list page
- study.html?file=... = individual study page

DATA
- data/library.json = the small library manifest used by the list page
- data/QURAN-DEEP-001_Al-Fatihah_1-7.json = complete first study

ADDING A FUTURE STUDY
1. Add the new study JSON to data/.
2. Add one metadata entry for that JSON to data/library.json.
3. Do not change HTML/CSS/JS unless the data schema itself is intentionally changed.

PRINT
The Study page has Back / Home / Print controls in browser view.
The Print button calls the browser's native print dialog. print.css hides the toolbar and creates clean 210mm × 297mm A4 pages with page breaks, footer and page numbers.

JSON FILE NAMING
QURAN-DEEP-[ID]_[Surah-Name]_[Ayat-Start]-[Ayat-End].json

Example:
QURAN-DEEP-002_Al-Baqarah_1-20.json
