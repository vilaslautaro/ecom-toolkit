import { buildBookmarkletUrl, CORE_TEMPLATE_ID } from './bookmarklet-url.js';

const DRAG_BUTTON_ID = 'dragBtn';
const OUTPUT_ID = 'bmOut';
const COPY_BUTTON_ID = 'copyBm';

const COPIED_LABEL = '✓ Copiado';
const COPIED_LABEL_MS = 1300;

function runQuietly(action: () => void): void {
  try {
    action();
  } catch {
    return;
  }
}

function copyWithHiddenTextField(text: string): void {
  const field = document.createElement('textarea');
  field.value = text;
  document.body.appendChild(field);
  field.select();
  runQuietly(() => document.execCommand('copy'));
  field.remove();
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    copyWithHiddenTextField(text);
  }
}

function setUpPage(): void {
  const coreTemplate = document.querySelector<HTMLScriptElement>(`#${CORE_TEMPLATE_ID}`);
  const dragButton = document.querySelector<HTMLAnchorElement>(`#${DRAG_BUTTON_ID}`);
  const output = document.querySelector<HTMLElement>(`#${OUTPUT_ID}`);
  const copyButton = document.querySelector<HTMLButtonElement>(`#${COPY_BUTTON_ID}`);
  if (!coreTemplate || !dragButton || !output || !copyButton) return;

  const bookmarklet = buildBookmarkletUrl(coreTemplate.textContent ?? '');

  dragButton.setAttribute('href', bookmarklet);
  output.textContent = bookmarklet;
  dragButton.addEventListener('click', (event) => {
    event.preventDefault();
  });

  copyButton.onclick = async () => {
    output.style.display = 'block';
    await copyToClipboard(bookmarklet);
    const previousLabel = copyButton.textContent ?? '';
    copyButton.textContent = COPIED_LABEL;
    setTimeout(() => {
      copyButton.textContent = previousLabel;
    }, COPIED_LABEL_MS);
  };
}

setUpPage();
