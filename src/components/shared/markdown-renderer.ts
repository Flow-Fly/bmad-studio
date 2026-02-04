import { LitElement, html, svg, css, nothing, render as litRender } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';

// Import only needed languages for tree-shaking
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import go from 'highlight.js/lib/languages/go';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import cssLang from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';

// Register languages
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('go', go);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', cssLang);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('sql', sql);

// Lucide icon SVG definitions for copy/check
const ICONS = {
  'copy': [
    ['rect', { x: '8', y: '8', width: '14', height: '14', rx: '2', ry: '2' }],
    ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }],
  ],
  'check': [
    ['path', { d: 'M20 6 9 17l-5-5' }],
  ],
} as const;

// DOMPurify configuration
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'em', 'del', 's', 'mark',
    'ul', 'ol', 'li',
    'pre', 'code', 'span',
    'blockquote',
    'a',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img',
    'div',
  ],
  ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class', 'target', 'rel', 'data-code'],
  ALLOW_DATA_ATTR: false,
};

// Configure marked instance with custom renderer
const marked = new Marked();
const renderer = {
  code({ text, lang }: { text: string; lang?: string }): string {
    const language = lang && hljs.getLanguage(lang) ? lang : undefined;
    let highlighted: string;
    try {
      highlighted = language
        ? hljs.highlight(text, { language }).value
        : hljs.highlightAuto(text).value;
    } catch {
      highlighted = text;
    }
    const escapedCode = text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return `<pre class="code-block" data-code="${escapedCode}"><code class="hljs${language ? ` language-${language}` : ''}">${highlighted}</code></pre>`;
  },
};

marked.use({ renderer, gfm: true, breaks: true });

@customElement('markdown-renderer')
export class MarkdownRenderer extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .markdown-body {
      font-size: var(--bmad-font-size-md);
      color: var(--bmad-color-text-primary);
      line-height: var(--bmad-line-height-normal);
      word-break: break-word;
    }

    /* Headings */
    .markdown-body h1 {
      font-size: var(--bmad-font-size-xl);
      font-weight: var(--bmad-font-weight-bold);
      color: var(--bmad-color-text-primary);
      margin: var(--bmad-spacing-lg) 0 var(--bmad-spacing-sm) 0;
      padding-bottom: var(--bmad-spacing-xs);
      border-bottom: 1px solid var(--bmad-color-border-primary);
    }

    .markdown-body h2 {
      font-size: var(--bmad-font-size-lg);
      font-weight: var(--bmad-font-weight-semibold);
      color: var(--bmad-color-text-primary);
      margin: var(--bmad-spacing-lg) 0 var(--bmad-spacing-xs) 0;
    }

    .markdown-body h3 {
      font-size: var(--bmad-font-size-md);
      font-weight: var(--bmad-font-weight-semibold);
      color: var(--bmad-color-text-primary);
      margin: var(--bmad-spacing-md) 0 var(--bmad-spacing-xs) 0;
    }

    .markdown-body h4,
    .markdown-body h5,
    .markdown-body h6 {
      font-size: var(--bmad-font-size-md);
      font-weight: var(--bmad-font-weight-medium);
      color: var(--bmad-color-text-secondary);
      margin: var(--bmad-spacing-sm) 0 var(--bmad-spacing-xs) 0;
    }

    /* Paragraphs */
    .markdown-body p {
      margin: var(--bmad-spacing-xs) 0;
    }

    .markdown-body p:first-child {
      margin-top: 0;
    }

    .markdown-body p:last-child {
      margin-bottom: 0;
    }

    /* Links */
    .markdown-body a {
      color: var(--bmad-color-accent);
      text-decoration: none;
      cursor: pointer;
    }

    .markdown-body a:hover {
      text-decoration: underline;
      color: var(--bmad-color-accent-hover);
    }

    /* Inline code */
    .markdown-body code:not(pre code) {
      font-family: var(--bmad-font-family-mono);
      font-size: 0.9em;
      padding: 1px 4px;
      border-radius: var(--bmad-radius-sm);
      background-color: var(--bmad-color-bg-tertiary);
      color: var(--bmad-color-text-primary);
    }

    /* Code blocks */
    .markdown-body pre.code-block {
      position: relative;
      background-color: var(--bmad-color-bg-tertiary);
      border-radius: var(--bmad-radius-md);
      padding: var(--bmad-spacing-md);
      margin: var(--bmad-spacing-sm) 0;
      overflow-x: auto;
    }

    .markdown-body pre.code-block code {
      font-family: var(--bmad-font-family-mono);
      font-size: var(--bmad-font-size-sm);
      line-height: var(--bmad-line-height-relaxed);
      background: none;
      padding: 0;
      border-radius: 0;
    }

    /* Code block copy button */
    .code-copy-button {
      position: absolute;
      top: var(--bmad-spacing-xs);
      right: var(--bmad-spacing-sm);
      display: inline-flex;
      align-items: center;
      gap: var(--bmad-spacing-xs);
      padding: var(--bmad-spacing-xs);
      border: none;
      border-radius: var(--bmad-radius-sm);
      background: var(--bmad-color-bg-elevated);
      color: var(--bmad-color-text-tertiary);
      cursor: pointer;
      opacity: 0;
      transition: opacity 200ms ease, color var(--bmad-transition-fast);
      font-size: var(--bmad-font-size-xs);
      line-height: 1;
    }

    .markdown-body pre.code-block:hover .code-copy-button,
    .code-copy-button:focus-visible {
      opacity: 1;
    }

    .code-copy-button:hover {
      color: var(--bmad-color-text-primary);
    }

    .code-copy-button:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: 2px;
    }

    .code-copy-button--copied {
      color: var(--bmad-color-success);
    }

    .copied-text {
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-success);
    }

    .icon {
      width: 14px;
      height: 14px;
      display: inline-flex;
    }

    .icon svg {
      width: 100%;
      height: 100%;
    }

    /* Blockquotes */
    .markdown-body blockquote {
      border-left: 3px solid var(--bmad-color-border-primary);
      margin: var(--bmad-spacing-sm) 0;
      padding: var(--bmad-spacing-xs) var(--bmad-spacing-md);
      color: var(--bmad-color-text-secondary);
      font-style: italic;
    }

    .markdown-body blockquote p {
      margin: 0;
    }

    /* Lists */
    .markdown-body ul,
    .markdown-body ol {
      margin: var(--bmad-spacing-xs) 0;
      padding-left: var(--bmad-spacing-xl);
    }

    .markdown-body li {
      margin: var(--bmad-spacing-xs) 0;
    }

    .markdown-body li > ul,
    .markdown-body li > ol {
      margin: 0;
    }

    /* Tables */
    .markdown-body table {
      width: 100%;
      border-collapse: collapse;
      margin: var(--bmad-spacing-sm) 0;
    }

    .markdown-body th,
    .markdown-body td {
      border: 1px solid var(--bmad-color-border-primary);
      padding: var(--bmad-spacing-xs) var(--bmad-spacing-sm);
      text-align: left;
    }

    .markdown-body th {
      background-color: var(--bmad-color-bg-secondary);
      font-weight: var(--bmad-font-weight-semibold);
    }

    .markdown-body tr:nth-child(even) {
      background-color: var(--bmad-color-bg-secondary);
    }

    /* Horizontal rules */
    .markdown-body hr {
      border: none;
      border-top: 1px solid var(--bmad-color-border-primary);
      margin: var(--bmad-spacing-md) 0;
    }

    /* Strong / em */
    .markdown-body strong {
      font-weight: var(--bmad-font-weight-semibold);
    }

    /* Images */
    .markdown-body img {
      max-width: 100%;
      height: auto;
      border-radius: var(--bmad-radius-md);
    }

    /* Strikethrough */
    .markdown-body del,
    .markdown-body s {
      color: var(--bmad-color-text-tertiary);
    }

    /* highlight.js theme overrides for dark mode */
    .markdown-body .hljs-keyword,
    .markdown-body .hljs-selector-tag,
    .markdown-body .hljs-type {
      color: #ff7b72;
    }

    .markdown-body .hljs-string,
    .markdown-body .hljs-attr {
      color: #a5d6ff;
    }

    .markdown-body .hljs-number,
    .markdown-body .hljs-literal {
      color: #79c0ff;
    }

    .markdown-body .hljs-comment {
      color: #8b949e;
      font-style: italic;
    }

    .markdown-body .hljs-built_in,
    .markdown-body .hljs-title {
      color: #d2a8ff;
    }

    .markdown-body .hljs-function,
    .markdown-body .hljs-title.function_ {
      color: #d2a8ff;
    }

    .markdown-body .hljs-variable,
    .markdown-body .hljs-template-variable {
      color: #ffa657;
    }

    .markdown-body .hljs-params {
      color: var(--bmad-color-text-primary);
    }

    .markdown-body .hljs-meta {
      color: #79c0ff;
    }

    .markdown-body .hljs-symbol,
    .markdown-body .hljs-bullet {
      color: #ffa657;
    }

    .markdown-body .hljs-addition {
      color: #3fb950;
      background-color: rgba(63, 185, 80, 0.1);
    }

    .markdown-body .hljs-deletion {
      color: #f85149;
      background-color: rgba(248, 81, 73, 0.1);
    }

    @media (prefers-reduced-motion: reduce) {
      .code-copy-button {
        transition: none;
      }
    }
  `;

  @property({ type: String }) content = '';
  @state() private _copiedBlockIndex: number | null = null;

  private _parseMarkdown(content: string): string {
    if (!content) return '';
    const raw = marked.parse(content) as string;
    return DOMPurify.sanitize(raw, PURIFY_CONFIG);
  }

  private _handleLinkClick(e: Event): void {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      e.preventDefault();
      const url = anchor.getAttribute('href');
      if (url) {
        this.dispatchEvent(new CustomEvent('link-click', {
          bubbles: true,
          composed: true,
          detail: { url },
        }));
      }
    }
  }

  private async _handleCodeCopy(codeText: string, blockIndex: number): Promise<void> {
    try {
      await navigator.clipboard.writeText(codeText);
      this._copiedBlockIndex = blockIndex;
      setTimeout(() => { this._copiedBlockIndex = null; }, 1500);
    } catch {
      // Silent failure -- clipboard API unavailable
    }
  }

  private _renderIcon(name: keyof typeof ICONS) {
    const elements = ICONS[name];
    if (!elements) return nothing;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attrs = (el: (typeof elements)[number]) => el[1] as Record<string, string>;
    return html`
      <span class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${elements.map(el => {
            switch (el[0]) {
              case 'rect': return svg`<rect x=${attrs(el).x} y=${attrs(el).y} width=${attrs(el).width} height=${attrs(el).height} rx=${attrs(el).rx} ry=${attrs(el).ry} />`;
              case 'path': return svg`<path d=${attrs(el).d} />`;
              default: return nothing;
            }
          })}
        </svg>
      </span>
    `;
  }

  private _renderCopyButton(codeText: string, blockIndex: number) {
    const isCopied = this._copiedBlockIndex === blockIndex;
    return html`
      <button
        class="code-copy-button ${isCopied ? 'code-copy-button--copied' : ''}"
        @click=${() => this._handleCodeCopy(codeText, blockIndex)}
        aria-label=${isCopied ? 'Copied' : 'Copy code'}
      >
        ${isCopied
          ? html`${this._renderIcon('check')} <span class="copied-text">Copied!</span>`
          : this._renderIcon('copy')}
      </button>
    `;
  }

  updated(): void {
    // Inject copy buttons into code blocks after render
    const codeBlocks = this.shadowRoot?.querySelectorAll('pre.code-block');
    if (!codeBlocks) return;

    codeBlocks.forEach((pre, index) => {
      // Skip if copy button already exists and state hasn't changed
      const existing = pre.querySelector('.code-copy-container');
      if (existing) existing.remove();

      const codeText = pre.getAttribute('data-code')?.replace(/&quot;/g, '"').replace(/&#39;/g, "'") ?? '';

      const container = document.createElement('div');
      container.className = 'code-copy-container';
      pre.appendChild(container);

      litRender(this._renderCopyButton(codeText, index), container);
    });
  }

  render() {
    if (!this.content) return nothing;

    const renderedHtml = this._parseMarkdown(this.content);

    return html`
      <div class="markdown-body" @click=${this._handleLinkClick}>
        ${unsafeHTML(renderedHtml)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'markdown-renderer': MarkdownRenderer;
  }
}
