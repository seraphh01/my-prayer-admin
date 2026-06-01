/** Reguli comune de parsare Word — secțiune și rugăciune. */
export const DOCX_IMPORT_RULES_INTRO =
  'Încărcați un fișier Word (.docx). Titlurile apar după încărcare, preluate din document; le puteți edita în previzualizare.';

export const DOCX_IMPORT_STYLE_ROWS: ReadonlyArray<{ style: string; role: string }> = [
  { style: 'Heading 1', role: 'Titlu rugăciune' },
  { style: 'Subtitle 1', role: 'Subtitlu rugăciune (opțional)' },
  { style: 'Heading 2', role: 'Titlu secțiune' },
  { style: 'Subtitle 2', role: 'Subtitlu secțiune (opțional)' },
  { style: 'Heading 3', role: 'Titlu text liturgic' },
];

export const DOCX_IMPORT_EXTRA_RULES: ReadonlyArray<string> = [
  'Fiecare rând din paragraf = o frază',
  'Cursiv și bold din Word se păstrează',
  'Citate: linie care începe cu << și se termină cu >>',
  'Textele liturgice nu au subtitlu',
];

export const DOCX_IMPORT_RULES_ERROR_HINT =
  'Heading 1 = titlu rugăciune, Subtitle 1 = subtitlu rugăciune, Heading 2 = titlu secțiune, ' +
  'Subtitle 2 = subtitlu secțiune, Heading 3 = titlu text. Fiecare rând = o frază. Citate: << text >>.';
