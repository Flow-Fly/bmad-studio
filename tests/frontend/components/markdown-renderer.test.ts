import { expect, fixture, html } from '@open-wc/testing';
import '../../../src/components/shared/markdown-renderer.ts';

describe('MarkdownRenderer', () => {
  it('renders heading tags from markdown content', async () => {
    const el = await fixture(
      html`<markdown-renderer .content=${'# Heading 1\n## Heading 2\n### Heading 3'}></markdown-renderer>`
    );
    await el.updateComplete;

    const body = el.shadowRoot!.querySelector('.markdown-body');
    expect(body).to.exist;

    const h1 = body!.querySelector('h1');
    expect(h1).to.exist;
    expect(h1!.textContent).to.equal('Heading 1');

    const h2 = body!.querySelector('h2');
    expect(h2).to.exist;
    expect(h2!.textContent).to.equal('Heading 2');

    const h3 = body!.querySelector('h3');
    expect(h3).to.exist;
    expect(h3!.textContent).to.equal('Heading 3');
  });

  it('renders bold and italic text correctly', async () => {
    const el = await fixture(
      html`<markdown-renderer .content=${'**bold** and *italic* text'}></markdown-renderer>`
    );
    await el.updateComplete;

    const body = el.shadowRoot!.querySelector('.markdown-body');
    const strong = body!.querySelector('strong');
    expect(strong).to.exist;
    expect(strong!.textContent).to.equal('bold');

    const em = body!.querySelector('em');
    expect(em).to.exist;
    expect(em!.textContent).to.equal('italic');
  });

  it('renders ordered and unordered lists', async () => {
    const el = await fixture(
      html`<markdown-renderer .content=${'- item 1\n- item 2\n\n1. first\n2. second'}></markdown-renderer>`
    );
    await el.updateComplete;

    const body = el.shadowRoot!.querySelector('.markdown-body');
    const ul = body!.querySelector('ul');
    expect(ul).to.exist;
    const ulItems = ul!.querySelectorAll('li');
    expect(ulItems.length).to.equal(2);

    const ol = body!.querySelector('ol');
    expect(ol).to.exist;
    const olItems = ol!.querySelectorAll('li');
    expect(olItems.length).to.equal(2);
  });

  it('renders code blocks with syntax highlighting classes', async () => {
    const el = await fixture(
      html`<markdown-renderer .content=${'```typescript\nconst x = 1;\n```'}></markdown-renderer>`
    );
    await el.updateComplete;

    const body = el.shadowRoot!.querySelector('.markdown-body');
    const pre = body!.querySelector('pre.code-block');
    expect(pre).to.exist;

    const code = pre!.querySelector('code');
    expect(code).to.exist;
    expect(code!.classList.contains('hljs')).to.be.true;
  });

  it('renders copy button on code blocks', async () => {
    const el = await fixture(
      html`<markdown-renderer .content=${'```javascript\nconst x = 1;\n```'}></markdown-renderer>`
    );
    await el.updateComplete;

    const body = el.shadowRoot!.querySelector('.markdown-body');
    const pre = body!.querySelector('pre.code-block');
    expect(pre).to.exist;

    const copyContainer = pre!.querySelector('.code-copy-container');
    expect(copyContainer).to.exist;

    const copyButton = copyContainer!.querySelector('.code-copy-button');
    expect(copyButton).to.exist;
    expect(copyButton!.getAttribute('aria-label')).to.equal('Copy code');
  });

  it('copy button copies code content to clipboard', async () => {
    const el = await fixture(
      html`<markdown-renderer .content=${'```javascript\nconst x = 42;\n```'}></markdown-renderer>`
    );
    await el.updateComplete;

    // Mock clipboard API
    let copiedText = '';
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => { copiedText = text; },
      },
      writable: true,
      configurable: true,
    });

    const body = el.shadowRoot!.querySelector('.markdown-body');
    const copyButton = body!.querySelector<HTMLButtonElement>('.code-copy-button')!;
    copyButton.click();

    // Wait for async clipboard write
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(copiedText).to.equal('const x = 42;');

    // Restore clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('sanitizes HTML and strips script tags', async () => {
    const el = await fixture(
      html`<markdown-renderer .content=${'<script>alert("xss")</script>Safe content'}></markdown-renderer>`
    );
    await el.updateComplete;

    const body = el.shadowRoot!.querySelector('.markdown-body');
    expect(body).to.exist;
    expect(body!.innerHTML).to.not.include('<script>');
    expect(body!.textContent).to.include('Safe content');
  });

  it('dispatches link-click event when a link is clicked', async () => {
    const el = await fixture(
      html`<markdown-renderer .content=${'[Click me](https://example.com)'}></markdown-renderer>`
    );
    await el.updateComplete;

    let clickedUrl = '';
    el.addEventListener('link-click', ((e: CustomEvent) => {
      clickedUrl = e.detail.url;
    }) as EventListener);

    const body = el.shadowRoot!.querySelector('.markdown-body');
    const link = body!.querySelector('a');
    expect(link).to.exist;
    link!.click();

    expect(clickedUrl).to.equal('https://example.com');
  });

  it('renders nothing when content is empty', async () => {
    const el = await fixture(
      html`<markdown-renderer .content=${''}></markdown-renderer>`
    );
    await el.updateComplete;

    const body = el.shadowRoot!.querySelector('.markdown-body');
    expect(body).to.be.null;
  });

  it('renders inline code with correct styling', async () => {
    const el = await fixture(
      html`<markdown-renderer .content=${'Use `const x = 1` in your code'}></markdown-renderer>`
    );
    await el.updateComplete;

    const body = el.shadowRoot!.querySelector('.markdown-body');
    const inlineCode = body!.querySelector('code');
    expect(inlineCode).to.exist;
    expect(inlineCode!.textContent).to.equal('const x = 1');
  });

  it('renders blockquotes correctly', async () => {
    const el = await fixture(
      html`<markdown-renderer .content=${'> This is a quote'}></markdown-renderer>`
    );
    await el.updateComplete;

    const body = el.shadowRoot!.querySelector('.markdown-body');
    const blockquote = body!.querySelector('blockquote');
    expect(blockquote).to.exist;
    expect(blockquote!.textContent).to.include('This is a quote');
  });

  it('renders tables correctly', async () => {
    const md = '| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |';
    const el = await fixture(
      html`<markdown-renderer .content=${md}></markdown-renderer>`
    );
    await el.updateComplete;

    const body = el.shadowRoot!.querySelector('.markdown-body');
    const table = body!.querySelector('table');
    expect(table).to.exist;

    const headers = table!.querySelectorAll('th');
    expect(headers.length).to.equal(2);
    expect(headers[0].textContent).to.equal('Header 1');

    const cells = table!.querySelectorAll('td');
    expect(cells.length).to.equal(2);
    expect(cells[0].textContent).to.equal('Cell 1');
  });
});
