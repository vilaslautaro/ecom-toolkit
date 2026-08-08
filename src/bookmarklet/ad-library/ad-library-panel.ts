import type {
  CountReporter,
  CreativeSelection,
  DownloadSessionConfig,
  ProgressReporter,
} from '../domain/types.js';
import { DownloadSession, browserPageScroller, waitMilliseconds } from './download-session.js';
import { scanAds } from './ad-scanner.js';
import { downloadAdCreatives } from '../downloads/creative-downloader.js';

const PANEL_ID = 'mald-panel';
const CLOSE_ID = 'mald-close';
const TOTAL_ID = 'mald-total';
const MINIMUM_COPIES_ID = 'mald-minads';
const CREATIVE_SELECTION_ID = 'mald-tipo';
const MAXIMUM_DOWNLOADS_ID = 'mald-max';
const SKIP_LOW_IMPRESSIONS_ID = 'mald-skiplow';
const START_ID = 'mald-start';
const STOP_ID = 'mald-stop';
const COUNT_ID = 'mald-count';
const LOG_ID = 'mald-log';

const PANEL_STYLE =
  'position:fixed;top:76px;right:16px;z-index:2147483647;width:272px;background:#12151b;color:#eef1f5;font:13px system-ui;border:1px solid #2b313b;border-radius:14px;box-shadow:0 12px 34px rgba(0,0,0,.5);padding:14px';
const HEADER_STYLE =
  'font-weight:800;font-size:14px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center';
const CLOSE_STYLE = 'cursor:pointer;opacity:.5;font-size:16px';
const TOTAL_STYLE = 'font-size:11.5px;color:#8ec5ff;margin-bottom:9px';
const FIELDS_STYLE = 'display:flex;flex-direction:column;gap:9px';
const FIELD_LABEL_STYLE = 'color:#98a2b3;font-size:11px;margin-bottom:3px';
const FIELD_STYLE =
  'width:100%;background:#1f242c;border:1px solid #2b313b;color:#eef1f5;border-radius:8px;padding:7px';
const CHECKBOX_LABEL_STYLE = 'display:flex;gap:8px;align-items:center;cursor:pointer';
const CHECKBOX_STYLE = 'accent-color:#3b82f6';
const ACTIONS_STYLE = 'display:flex;gap:8px;margin-top:11px';
const START_STYLE =
  'flex:2;background:#3b82f6;color:#fff;border:0;border-radius:9px;padding:9px;cursor:pointer;font-weight:700';
const STOP_STYLE =
  'flex:1;background:#2b313b;color:#fff;border:0;border-radius:9px;padding:9px;cursor:pointer;font-weight:700';
const COUNTER_STYLE = 'margin-top:9px;font-size:12px';
const LOG_STYLE =
  'margin-top:7px;max-height:150px;overflow:auto;background:#0b0e12;border-radius:8px;padding:7px;font:10px ui-monospace,monospace;white-space:pre-wrap;color:#aeb9c9';

const TITLE_TEXT = '🧰 Ecom Toolkit';
const CLOSE_TEXT = '✕';
const MINIMUM_COPIES_LABEL = 'Mín. anuncios que repiten';
const CREATIVE_SELECTION_LABEL = 'Tipo';
const MAXIMUM_DOWNLOADS_LABEL = 'Total a descargar (0 = todos)';
const SKIP_LOW_IMPRESSIONS_LABEL = ' Evitar pocas impresiones';
const START_LABEL = '▶ Iniciar';
const RUNNING_LABEL = '⏳ Descargando…';
const STOP_LABEL = '■ Detener';
const COUNTER_LABEL = 'Descargados: ';
const STARTING_MESSAGE = '▶ empezando...';
const STOPPED_MESSAGE = '⏸ detenido';
const TOTAL_PREFIX = 'Anuncios en esta búsqueda: ';

const START_BACKGROUND_IDLE = '#3b82f6';
const START_BACKGROUND_RUNNING = '#24406e';
const START_CURSOR_IDLE = 'pointer';
const START_CURSOR_RUNNING = 'default';
const STOP_OPACITY_RUNNING = '1';
const STOP_OPACITY_IDLE = '.45';

const RESULT_TOTAL_PATTERN = /(~?\s*[\d.,]+)\s+(resultados|results)/i;
const TOTAL_RECHECK_DELAYS_MS: readonly number[] = [1500, 3500];
const AUTO_START_DELAY_MS = 1500;
const FALLBACK_DELAY_BETWEEN_DOWNLOADS_MS = 1200;
const FALLBACK_CREATIVE_SELECTION: CreativeSelection = 'auto';

interface CreativeSelectionOption {
  readonly value: CreativeSelection;
  readonly label: string;
}

const CREATIVE_SELECTION_OPTIONS: readonly CreativeSelectionOption[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'video', label: 'Solo videos' },
  { value: 'imagen', label: 'Solo imágenes' },
];

export interface AdLibraryPanelOptions {
  readonly defaults: DownloadSessionConfig;
  readonly autoStart: boolean;
}

interface AdLibraryPanelElements {
  readonly panel: HTMLDivElement;
  readonly closeButton: HTMLSpanElement;
  readonly totalLine: HTMLDivElement;
  readonly minimumCopiesInput: HTMLInputElement;
  readonly creativeSelectionField: HTMLSelectElement;
  readonly maximumDownloadsInput: HTMLInputElement;
  readonly skipLowImpressionsCheckbox: HTMLInputElement;
  readonly startButton: HTMLButtonElement;
  readonly stopButton: HTMLButtonElement;
  readonly counter: HTMLElement;
  readonly log: HTMLDivElement;
}

function createStyledElement<Tag extends keyof HTMLElementTagNameMap>(
  tagName: Tag,
  style: string,
): HTMLElementTagNameMap[Tag] {
  const element = document.createElement(tagName);
  element.style.cssText = style;
  return element;
}

function createFieldGroup(labelText: string, field: HTMLElement): HTMLDivElement {
  const group = document.createElement('div');
  const label = createStyledElement('div', FIELD_LABEL_STYLE);
  label.textContent = labelText;
  group.append(label, field);
  return group;
}

function createWholeNumberInput(id: string, value: number): HTMLInputElement {
  const input = createStyledElement('input', FIELD_STYLE);
  input.id = id;
  input.type = 'number';
  input.defaultValue = String(value);
  input.min = '0';
  return input;
}

function createCreativeSelectionField(selected: CreativeSelection): HTMLSelectElement {
  const field = createStyledElement('select', FIELD_STYLE);
  field.id = CREATIVE_SELECTION_ID;

  for (const option of CREATIVE_SELECTION_OPTIONS) {
    const choice = document.createElement('option');
    choice.value = option.value;
    choice.textContent = option.label;
    field.append(choice);
  }

  field.value = selected;
  return field;
}

function createSkipLowImpressionsField(checked: boolean): {
  readonly wrapper: HTMLLabelElement;
  readonly checkbox: HTMLInputElement;
} {
  const wrapper = createStyledElement('label', CHECKBOX_LABEL_STYLE);
  const checkbox = createStyledElement('input', CHECKBOX_STYLE);
  checkbox.id = SKIP_LOW_IMPRESSIONS_ID;
  checkbox.type = 'checkbox';
  checkbox.defaultChecked = checked;
  wrapper.append(checkbox, SKIP_LOW_IMPRESSIONS_LABEL);
  return { wrapper, checkbox };
}

function createActionButton(id: string, style: string, label: string): HTMLButtonElement {
  const button = createStyledElement('button', style);
  button.id = id;
  button.textContent = label;
  return button;
}

function createPanelElements(defaults: DownloadSessionConfig): AdLibraryPanelElements {
  const panel = createStyledElement('div', PANEL_STYLE);
  panel.id = PANEL_ID;

  const header = createStyledElement('div', HEADER_STYLE);
  const title = document.createElement('span');
  title.textContent = TITLE_TEXT;
  const closeButton = createStyledElement('span', CLOSE_STYLE);
  closeButton.id = CLOSE_ID;
  closeButton.textContent = CLOSE_TEXT;
  header.append(title, closeButton);

  const totalLine = createStyledElement('div', TOTAL_STYLE);
  totalLine.id = TOTAL_ID;

  const minimumCopiesInput = createWholeNumberInput(
    MINIMUM_COPIES_ID,
    defaults.minimumCopiesInRotation,
  );
  const creativeSelectionField = createCreativeSelectionField(defaults.creativeSelection);
  const maximumDownloadsInput = createWholeNumberInput(
    MAXIMUM_DOWNLOADS_ID,
    defaults.maximumDownloads,
  );
  const skipLowImpressions = createSkipLowImpressionsField(defaults.skipLowImpressions);

  const fields = createStyledElement('div', FIELDS_STYLE);
  fields.append(
    createFieldGroup(MINIMUM_COPIES_LABEL, minimumCopiesInput),
    createFieldGroup(CREATIVE_SELECTION_LABEL, creativeSelectionField),
    createFieldGroup(MAXIMUM_DOWNLOADS_LABEL, maximumDownloadsInput),
    skipLowImpressions.wrapper,
  );

  const startButton = createActionButton(START_ID, START_STYLE, START_LABEL);
  const stopButton = createActionButton(STOP_ID, STOP_STYLE, STOP_LABEL);
  const actions = createStyledElement('div', ACTIONS_STYLE);
  actions.append(startButton, stopButton);

  const counter = document.createElement('b');
  counter.id = COUNT_ID;
  counter.textContent = '0';
  const counterLine = createStyledElement('div', COUNTER_STYLE);
  counterLine.append(COUNTER_LABEL, counter);

  const log = createStyledElement('div', LOG_STYLE);
  log.id = LOG_ID;

  panel.append(header, totalLine, fields, actions, counterLine, log);

  return {
    panel,
    closeButton,
    totalLine,
    minimumCopiesInput,
    creativeSelectionField,
    maximumDownloadsInput,
    skipLowImpressionsCheckbox: skipLowImpressions.checkbox,
    startButton,
    stopButton,
    counter,
    log,
  };
}

function readSearchResultTotal(): string {
  const bodyText: string | undefined = document.body.innerText;
  return RESULT_TOTAL_PATTERN.exec(bodyText ?? '')?.[1]?.trim() ?? '';
}

function showSearchResultTotal(totalLine: HTMLElement): void {
  const total = readSearchResultTotal();
  totalLine.textContent = total === '' ? '' : TOTAL_PREFIX + total;
}

function trackSearchResultTotal(totalLine: HTMLElement): void {
  showSearchResultTotal(totalLine);
  for (const delay of TOTAL_RECHECK_DELAYS_MS) {
    setTimeout(() => showSearchResultTotal(totalLine), delay);
  }
}

function createLogReporter(log: HTMLElement): ProgressReporter {
  return (message) => {
    log.textContent += `${message}\n`;
    log.scrollTop = log.scrollHeight;
  };
}

function createCountReporter(counter: HTMLElement): CountReporter {
  return (attempted) => {
    counter.textContent = String(attempted);
  };
}

function readWholeNumber(input: HTMLInputElement): number {
  const parsed = Number.parseInt(input.value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function readCreativeSelection(field: HTMLSelectElement): CreativeSelection {
  const chosen = CREATIVE_SELECTION_OPTIONS.find((option) => option.value === field.value);
  return chosen ? chosen.value : FALLBACK_CREATIVE_SELECTION;
}

function readSessionConfig(
  elements: AdLibraryPanelElements,
  defaults: DownloadSessionConfig,
): DownloadSessionConfig {
  return {
    minimumCopiesInRotation: readWholeNumber(elements.minimumCopiesInput),
    creativeSelection: readCreativeSelection(elements.creativeSelectionField),
    skipLowImpressions: elements.skipLowImpressionsCheckbox.checked,
    includeVideoPoster: false,
    maximumDownloads: readWholeNumber(elements.maximumDownloadsInput),
    autoScroll: true,
    delayBetweenDownloadsMs:
      defaults.delayBetweenDownloadsMs || FALLBACK_DELAY_BETWEEN_DOWNLOADS_MS,
  };
}

function showRunningState(elements: AdLibraryPanelElements, running: boolean): void {
  elements.startButton.disabled = running;
  elements.stopButton.disabled = !running;
  elements.startButton.textContent = running ? RUNNING_LABEL : START_LABEL;
  elements.startButton.style.background = running
    ? START_BACKGROUND_RUNNING
    : START_BACKGROUND_IDLE;
  elements.startButton.style.cursor = running ? START_CURSOR_RUNNING : START_CURSOR_IDLE;
  elements.stopButton.style.opacity = running ? STOP_OPACITY_RUNNING : STOP_OPACITY_IDLE;
}

function createAdLibraryDownloadSession(): DownloadSession {
  return new DownloadSession({
    scanAds,
    downloadCreatives: downloadAdCreatives,
    scroller: browserPageScroller,
    wait: waitMilliseconds,
  });
}

function wirePanel(
  elements: AdLibraryPanelElements,
  session: DownloadSession,
  defaults: DownloadSessionConfig,
): void {
  const report = createLogReporter(elements.log);
  const reportAttempts = createCountReporter(elements.counter);

  showRunningState(elements, false);

  elements.closeButton.onclick = () => {
    session.stop();
    elements.panel.remove();
  };

  elements.stopButton.onclick = () => {
    if (!session.isRunning) return;
    session.stop();
    report(STOPPED_MESSAGE);
  };

  elements.startButton.onclick = async () => {
    if (session.isRunning) return;

    const config = readSessionConfig(elements, defaults);
    elements.log.textContent = '';
    report(STARTING_MESSAGE);
    showRunningState(elements, true);

    try {
      await session.start(config, report, reportAttempts);
    } finally {
      showRunningState(elements, false);
    }
  };
}

export function buildAdLibraryPanel(options: AdLibraryPanelOptions): void {
  if (document.getElementById(PANEL_ID)) return;

  const elements = createPanelElements(options.defaults);
  document.body.appendChild(elements.panel);

  trackSearchResultTotal(elements.totalLine);
  wirePanel(elements, createAdLibraryDownloadSession(), options.defaults);

  if (options.autoStart) {
    setTimeout(() => elements.startButton.click(), AUTO_START_DELAY_MS);
  }
}
