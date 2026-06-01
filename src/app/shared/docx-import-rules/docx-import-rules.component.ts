import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DOCX_IMPORT_EXTRA_RULES,
  DOCX_IMPORT_RULES_INTRO,
  DOCX_IMPORT_STYLE_ROWS,
} from '../../core/constants/docx-import-rules';

@Component({
  standalone: true,
  selector: 'app-docx-import-rules',
  imports: [CommonModule],
  templateUrl: './docx-import-rules.component.html',
  styleUrls: ['./docx-import-rules.component.css'],
})
export class DocxImportRulesComponent {
  readonly intro = DOCX_IMPORT_RULES_INTRO;
  readonly styleRows = DOCX_IMPORT_STYLE_ROWS;
  readonly extraRules = DOCX_IMPORT_EXTRA_RULES;
}
