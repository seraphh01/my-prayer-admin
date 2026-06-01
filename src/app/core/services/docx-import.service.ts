import { Injectable } from '@angular/core';
import {
  AiImportBlock,
  AiImportPhrase,
  AiImportSection,
  DocxPrayerImportResult,
  DocxSectionImportResult,
} from '../models/ai-import.model';
import { TextElementType } from '../models/text-element.model';
import { DOCX_IMPORT_RULES_ERROR_HINT } from '../constants/docx-import-rules';

type DocxImportMode = 'section' | 'prayer';

@Injectable({
  providedIn: 'root',
})
export class DocxImportService {
  private readonly styleMap = [
    "p[style-name='Subtitle 1'] => p.subtitle1:fresh",
    "p[style-name='Subtitle 2'] => p.subtitle2:fresh",
    "p[style-name='Subtitlu 1'] => p.subtitle1:fresh",
    "p[style-name='Subtitlu 2'] => p.subtitle2:fresh",
  ];

  private readonly headingRulesHint = DOCX_IMPORT_RULES_ERROR_HINT;

  async parseForSection(file: File): Promise<DocxSectionImportResult> {
    const { html, warnings: docWarnings } = await this.convertFileToHtml(file);
    const parsed = this.parseHtml(html, 'section');

    if (parsed.blocks.length === 0) {
      throw new Error(
        `Nu s-a putut extrage structură din document. ${this.headingRulesHint}`,
      );
    }

    return {
      sectionTitle: parsed.sectionTitle,
      sectionSubtitle: parsed.sectionSubtitle,
      blocks: parsed.blocks,
      plainText: this.sectionsToPlainText([
        { title: parsed.sectionTitle, subtitle: parsed.sectionSubtitle, blocks: parsed.blocks },
      ]),
      warnings: docWarnings,
    };
  }

  async parseForPrayer(file: File): Promise<DocxPrayerImportResult> {
    const { html, warnings: docWarnings } = await this.convertFileToHtml(file);
    const parsed = this.parseHtml(html, 'prayer');

    if (!parsed.prayerTitle.trim() && parsed.sections.length === 0) {
      throw new Error(
        `Nu s-a putut extrage structură din document. ${this.headingRulesHint}`,
      );
    }

    if (parsed.sections.length === 0) {
      throw new Error(
        'Documentul nu conține secțiuni (Heading 2). ' + this.headingRulesHint,
      );
    }

    const sections = parsed.sections.filter(
      (s) => s.title.trim() && s.blocks.some((b) => b.phrases.length > 0),
    );

    if (sections.length === 0) {
      throw new Error(
        'Nu s-au găsit texte liturgice (Heading 3) cu fraze. ' + this.headingRulesHint,
      );
    }

    return {
      prayerTitle: parsed.prayerTitle,
      prayerSubtitle: parsed.prayerSubtitle,
      sections,
      plainText: this.sectionsToPlainText(sections),
      warnings: docWarnings,
    };
  }

  private async convertFileToHtml(file: File): Promise<{ html: string; warnings: string[] }> {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      throw new Error('Selectați un fișier Word (.docx).');
    }

    const arrayBuffer = await file.arrayBuffer();
    const mammoth = (await import('mammoth')).default;
    const result = await mammoth.convertToHtml({ arrayBuffer }, { styleMap: this.styleMap });

    return {
      html: result.value,
      warnings: result.messages.map((m) => m.message),
    };
  }

  private parseHtml(
    html: string,
    mode: DocxImportMode,
  ): {
    prayerTitle: string;
    prayerSubtitle: string | null;
    sectionTitle: string;
    sectionSubtitle: string | null;
    sections: AiImportSection[];
    blocks: AiImportBlock[];
    warnings: string[];
  } {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const warnings: string[] = [];

    let prayerTitle = '';
    let prayerSubtitle: string | null = null;
    let sectionTitle = '';
    let sectionSubtitle: string | null = null;

    const sections: AiImportSection[] = [];
    let currentSection: AiImportSection | null = null;
    let currentBlock: AiImportBlock | null = null;
    const blocks: AiImportBlock[] = [];

    const flushBlock = () => {
      if (!currentBlock) return;
      if (currentBlock.phrases.length === 0) {
        currentBlock = null;
        return;
      }
      if (mode === 'prayer' && currentSection) {
        currentSection.blocks.push(currentBlock);
      } else if (mode === 'section') {
        blocks.push(currentBlock);
      }
      currentBlock = null;
    };

    const flushSection = () => {
      flushBlock();
      if (!currentSection) return;
      if (currentSection.blocks.length > 0 || currentSection.title.trim()) {
        sections.push(currentSection);
      }
      currentSection = null;
    };

    const startBlock = (title: string) => {
      flushBlock();
      const t = title.trim() || 'Text';
      currentBlock = {
        title: t,
        repetition: 1,
        phrases: [],
        linkExisting: false,
      };
    };

    const ensureBlock = () => {
      if (!currentBlock) startBlock('Text');
    };

    const addPhrasesFromElement = (el: Element) => {
      const phrases = this.elementToPhrases(el);
      if (!phrases.length) return;
      ensureBlock();
      currentBlock!.phrases.push(...phrases);
    };

    const onHeading = (level: number, text: string) => {
      const t = text.trim();
      if (!t) return;

      if (level === 1) {
        flushSection();
        if (mode === 'prayer') {
          prayerTitle = t;
        }
        return;
      }

      if (level === 2) {
        flushSection();
        if (mode === 'prayer') {
          currentSection = { title: t, subtitle: null, blocks: [] };
        } else {
          sectionTitle = t;
        }
        return;
      }

      if (level === 3) {
        startBlock(t);
        return;
      }

      if (level <= 6) {
        startBlock(t);
      }
    };

    const walk = (parent: Element) => {
      for (const node of Array.from(parent.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          const raw = node.textContent ?? '';
          if (!raw.trim()) continue;
          const lines = raw.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
          ensureBlock();
          for (const line of lines) {
            currentBlock!.phrases.push(this.phraseFromLine(line, TextElementType.PLAIN));
          }
          continue;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as Element;
        const tag = el.tagName.toLowerCase();

        const headingMatch = tag.match(/^h([1-6])$/);
        if (headingMatch) {
          onHeading(parseInt(headingMatch[1], 10), el.textContent ?? '');
          continue;
        }

        if (tag === 'p') {
          const subtitleKind = this.getSubtitleKind(el);
          if (subtitleKind === 1) {
            const st = (el.textContent ?? '').trim();
            if (st && mode === 'prayer') prayerSubtitle = st;
            continue;
          }
          if (subtitleKind === 2) {
            const st = (el.textContent ?? '').trim();
            if (st) {
              if (mode === 'prayer' && currentSection) {
                currentSection.subtitle = st;
              } else if (mode === 'section') {
                sectionSubtitle = st;
              }
            }
            continue;
          }
          addPhrasesFromElement(el);
          continue;
        }

        if (tag === 'ul' || tag === 'ol') {
          el.querySelectorAll(':scope > li').forEach((li) => addPhrasesFromElement(li));
          continue;
        }

        if (tag === 'table') {
          ensureBlock();
          el.querySelectorAll('tr').forEach((tr) => {
            const cells = Array.from(tr.querySelectorAll('td, th'))
              .map((c) => c.textContent?.trim())
              .filter(Boolean);
            if (cells.length) {
              const line = cells.join(' ');
              currentBlock!.phrases.push(this.phraseFromLine(line, this.inferPhraseType(el)));
            }
          });
          continue;
        }

        if (tag === 'br') continue;

        walk(el);
      }
    };

    walk(doc.body);
    flushSection();
    flushBlock();

    if (mode === 'section' && blocks.length === 0 && currentBlock) {
      blocks.push(currentBlock);
    }

    return {
      prayerTitle,
      prayerSubtitle,
      sectionTitle,
      sectionSubtitle,
      sections,
      blocks: blocks.filter((b) => b.title.trim() && b.phrases.length > 0),
      warnings,
    };
  }

  private elementToPhrases(el: Element): AiImportPhrase[] {
    const elementType = this.inferPhraseType(el);
    const raw = (el.textContent ?? '').replace(/\r\n/g, '\n');
    const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    if (lines.length === 0) {
      const single = raw.replace(/\s+/g, ' ').trim();
      if (!single) return [];
      return [this.phraseFromLine(single, elementType)];
    }

    return lines.map((line) => this.phraseFromLine(line, elementType));
  }

  private phraseFromLine(line: string, elementType: string): AiImportPhrase {
    let text = line.trim();
    let type = elementType;

    if (this.isQuoteDelimiterLine(text)) {
      type = TextElementType.QUOTE;
      const m = text.match(/^<<\s*([\s\S]*?)\s*>>$/);
      if (m) text = m[1].trim();
    }

    return { text, type, highlight: false };
  }

  private getSubtitleKind(el: Element): 1 | 2 | null {
    const cls = (el.className ?? '').toString().toLowerCase();
    if (cls.includes('subtitle1')) return 1;
    if (cls.includes('subtitle2')) return 2;
    return null;
  }

  private isQuoteDelimiterLine(text: string): boolean {
    const t = text.trim();
    return t.startsWith('<<') && t.endsWith('>>');
  }

  private inferPhraseType(el: Element): string {
    const html = el.innerHTML.toLowerCase();
    const plain = (el.textContent ?? '').trim();

    if (!plain) return TextElementType.PLAIN;

    const hasEm = /<em\b|italic/i.test(html) || el.querySelector('em, i') !== null;
    const hasStrong = /<strong\b|<b\b/i.test(html) || el.querySelector('strong, b') !== null;

    if (hasEm && !hasStrong) return TextElementType.ITALIC;
    if (hasStrong && !hasEm) return TextElementType.BOLD;

    if (this.isMostlyWrappedIn(el, ['em', 'i'])) return TextElementType.ITALIC;
    if (this.isMostlyWrappedIn(el, ['strong', 'b'])) return TextElementType.BOLD;

    return TextElementType.PLAIN;
  }

  private isMostlyWrappedIn(el: Element, tags: string[]): boolean {
    const full = (el.textContent ?? '').trim();
    if (!full) return false;

    let wrapped = '';
    for (const tag of tags) {
      el.querySelectorAll(tag).forEach((n) => {
        wrapped += (n.textContent ?? '') + ' ';
      });
    }
    return wrapped.replace(/\s+/g, ' ').trim().length >= full.length * 0.85;
  }

  private sectionsToPlainText(sections: Pick<AiImportSection, 'title' | 'subtitle' | 'blocks'>[]): string {
    return sections
      .map((s) => {
        const header = [s.title, s.subtitle].filter(Boolean).join(' — ');
        const body = s.blocks
          .map((b) => `${b.title}\n${b.phrases.map((p) => p.text).join('\n')}`)
          .join('\n\n');
        return header ? `${header}\n\n${body}` : body;
      })
      .join('\n\n---\n\n');
  }
}
