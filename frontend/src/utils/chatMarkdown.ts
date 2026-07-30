/**
 * Render light Markdown (bold, italic, lists, line breaks) safely for chat bubbles.
 * No external dependency — Gemini replies often use **bold** and numbered lists.
 */
export function renderChatMarkdown(raw: string): string {
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = escaped.split('\n');
  const out: string[] = [];
  let inOl = false;
  let inUl = false;

  const closeLists = () => {
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
  };

  const inline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="chat-code">$1</code>');

  for (const line of lines) {
    const ol = line.match(/^\s*\d+[\).]\s+(.+)$/);
    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    if (ol) {
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol class="chat-ol">');
        inOl = true;
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }
    if (ul) {
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        out.push('<ul class="chat-ul">');
        inUl = true;
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }
    closeLists();
    if (!line.trim()) {
      out.push('<br />');
    } else {
      out.push(`<p class="chat-p">${inline(line)}</p>`);
    }
  }
  closeLists();
  return out.join('');
}

/** True if the reply already contains a numbered/bullet list (avoid duplicating steps). */
export function hasInlineList(text: string): boolean {
  return /^\s*(\d+[\).]|[-*])\s+/m.test(text);
}
