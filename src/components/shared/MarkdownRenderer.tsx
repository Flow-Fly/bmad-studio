import { useEffect, useRef, useCallback, useMemo } from 'react';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';

import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import go from 'highlight.js/lib/languages/go';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import cssLang from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import markdownLang from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';

import '../../styles/markdown.css';

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
hljs.registerLanguage('markdown', markdownLang);
hljs.registerLanguage('md', markdownLang);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('sql', sql);

// DOMPurify config
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

// Configure marked with syntax highlighting
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

function parseMarkdown(content: string): string {
  if (!content) return '';
  const raw = marked.parse(content) as string;
  return DOMPurify.sanitize(raw, PURIFY_CONFIG);
}

// Copy button SVGs as raw HTML strings (avoids React overhead for injected buttons)
const COPY_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="14" height="14" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

interface MarkdownRendererProps {
  content: string;
  onLinkClick?: (url: string) => void;
}

export function MarkdownRenderer({ content, onLinkClick }: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => parseMarkdown(content), [content]);

  // Handle link clicks
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (anchor) {
        e.preventDefault();
        const url = anchor.getAttribute('href');
        if (url && onLinkClick) onLinkClick(url);
      }
    },
    [onLinkClick],
  );

  // Inject copy buttons into code blocks
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const codeBlocks = el.querySelectorAll('pre.code-block');
    const cleanups: (() => void)[] = [];

    codeBlocks.forEach((pre) => {
      // Skip if already has a copy button
      if (pre.querySelector('.code-copy-button')) return;

      const codeText = pre.getAttribute('data-code') ?? '';

      const btn = document.createElement('button');
      btn.className = 'code-copy-button';
      btn.setAttribute('aria-label', 'Copy code');
      btn.innerHTML = COPY_ICON_SVG;

      const handleCopy = async () => {
        try {
          await navigator.clipboard.writeText(codeText);
          btn.innerHTML = `${CHECK_ICON_SVG} <span class="copied-text">Copied!</span>`;
          btn.classList.add('code-copy-button--copied');
          setTimeout(() => {
            btn.innerHTML = COPY_ICON_SVG;
            btn.classList.remove('code-copy-button--copied');
          }, 1500);
        } catch {
          // Silent failure
        }
      };

      btn.addEventListener('click', handleCopy);
      pre.appendChild(btn);

      cleanups.push(() => {
        btn.removeEventListener('click', handleCopy);
        btn.remove();
      });
    });

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [html]); // Re-run when HTML changes

  if (!content) return null;

  return (
    <div
      ref={containerRef}
      className="markdown-body"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
