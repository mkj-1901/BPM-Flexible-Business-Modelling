// BPM Studio Frontend — Gemini-style centered chat workspace, separate Repo References section,
// BPMN 2.0 SVG renderer, comparison charts, and safe Markdown viewer.

const state = {
  activeView: 'studio', // 'studio' | 'references'
  presets: [],
  activeStarterId: null,
  activeRefId: null,
  versionMode: 'rows', // 'rows' | 'text'
  versionRows: [
    { code: 'V1', name: '', details: '' },
    { code: 'V2', name: '', details: '' },
  ],
  studioHistory: [],
  activeHistoryIdx: -1,
  studioResult: null,
  refResult: null,
  result: null, // currently rendered result in #resultsWorkspace
  selectedTraceVariant: 'ALL',
  zoom: 1,
  showRawMd: false,
  health: null,
};

const els = {
  brandHomeBtn: document.getElementById('brandHomeBtn'),
  navStudioBtn: document.getElementById('navStudioBtn'),
  navRefsBtn: document.getElementById('navRefsBtn'),
  repoRefCountPill: document.getElementById('repoRefCountPill'),
  apiStatusBadge: document.getElementById('apiStatusBadge'),
  viewStudio: document.getElementById('view-studio'),
  viewReferences: document.getElementById('view-references'),
  studioStage: document.getElementById('studioStage'),
  studioHero: document.getElementById('studioHero'),
  chatThread: document.getElementById('chatThread'),
  historyBar: document.getElementById('historyBar'),
  activePromptBubble: document.getElementById('activePromptBubble'),
  chatLoadingCard: document.getElementById('chatLoadingCard'),
  promptInput: document.getElementById('promptInput'),
  versionModeRowsBtn: document.getElementById('versionModeRowsBtn'),
  versionModeTextBtn: document.getElementById('versionModeTextBtn'),
  addVersionRowBtn: document.getElementById('addVersionRowBtn'),
  versionRowsWrap: document.getElementById('versionRowsWrap'),
  versionTextWrap: document.getElementById('versionTextWrap'),
  versionNotesInput: document.getElementById('versionNotesInput'),
  engineModeSelect: document.getElementById('engineModeSelect'),
  newChatBtn: document.getElementById('newChatBtn'),
  clearBtn: document.getElementById('clearBtn'),
  generateBtn: document.getElementById('generateBtn'),
  btnSpinner: document.getElementById('btnSpinner'),
  generateBtnIcon: document.getElementById('generateBtnIcon'),
  generateBtnText: document.getElementById('generateBtnText'),
  starterChips: document.getElementById('starterChips'),
  jumpToRefsChip: document.getElementById('jumpToRefsChip'),
  alertBanner: document.getElementById('alertBanner'),
  studioOutputSlot: document.getElementById('studioOutputSlot'),
  backToStudioFromRefsBtn: document.getElementById('backToStudioFromRefsBtn'),
  repoRefGrid: document.getElementById('repoRefGrid'),
  refAlertBanner: document.getElementById('refAlertBanner'),
  refOutputSlot: document.getElementById('refOutputSlot'),
  resultsWorkspace: document.getElementById('resultsWorkspace'),
  runMetaBadge: document.getElementById('runMetaBadge'),
  resultVariantCountBadge: document.getElementById('resultVariantCountBadge'),
  resultProcessName: document.getElementById('resultProcessName'),
  resultOverview: document.getElementById('resultOverview'),
  kpiGrid: document.getElementById('kpiGrid'),
  variantTraceButtons: document.getElementById('variantTraceButtons'),
  traceSequenceStrip: document.getElementById('traceSequenceStrip'),
  flexSvgContainer: document.getElementById('flexSvgContainer'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomResetBtn: document.getElementById('zoomResetBtn'),
  zoomLevelLabel: document.getElementById('zoomLevelLabel'),
  downloadFlexSvgBtn: document.getElementById('downloadFlexSvgBtn'),
  rigidCountBadge: document.getElementById('rigidCountBadge'),
  rigidDiagramsGrid: document.getElementById('rigidDiagramsGrid'),
  comparisonBars: document.getElementById('comparisonBars'),
  tableIvContainer: document.getElementById('tableIvContainer'),
  tableVariantsContainer: document.getElementById('tableVariantsContainer'),
  classificationContainer: document.getElementById('classificationContainer'),
  tableTracesContainer: document.getElementById('tableTracesContainer'),
  mdRenderedView: document.getElementById('mdRenderedView'),
  mdRawView: document.getElementById('mdRawView'),
  mdToggleRawBtn: document.getElementById('mdToggleRawBtn'),
  copyMdBtn: document.getElementById('copyMdBtn'),
  downloadMdBtn: document.getElementById('downloadMdBtn'),
  downloadMdBtn2: document.getElementById('downloadMdBtn2'),
  downloadFlexBpmnBtn: document.getElementById('downloadFlexBpmnBtn'),
  downloadZipBtn: document.getElementById('downloadZipBtn'),
  xmlFileSelect: document.getElementById('xmlFileSelect'),
  xmlViewer: document.getElementById('xmlViewer'),
  copyXmlBtn: document.getElementById('copyXmlBtn'),
  downloadSelectedXmlBtn: document.getElementById('downloadSelectedXmlBtn'),
};

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showAlert(message, type = 'info', target = 'studio') {
  const banner = target === 'references' ? els.refAlertBanner : els.alertBanner;
  if (!message) {
    banner.hidden = true;
    banner.textContent = '';
    return;
  }
  banner.hidden = false;
  banner.className = `alert-banner ${type === 'error' ? 'alert-error' : 'alert-info'}`;
  banner.textContent = message;
}

function setLoading(loading) {
  els.generateBtn.disabled = loading;
  els.btnSpinner.hidden = !loading;
  els.generateBtnIcon.hidden = loading;
  els.generateBtnText.textContent = loading ? 'Generating...' : 'Generate';
  els.chatLoadingCard.hidden = !loading;
}

function downloadTextFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ==================== THEME & NAVIGATION ====================
function applyTheme(themeName) {
  const theme = ['sky', 'mint', 'lavender'].includes(themeName) ? themeName : 'sky';
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-dot').forEach((dot) => {
    dot.classList.toggle('active', dot.dataset.themePick === theme);
  });
  try {
    localStorage.setItem('bpm_studio_theme', theme);
  } catch {
    // ignore storage errors
  }
}

document.querySelectorAll('.theme-dot').forEach((dot) => {
  dot.addEventListener('click', () => applyTheme(dot.dataset.themePick));
});

try {
  const savedTheme = localStorage.getItem('bpm_studio_theme');
  if (savedTheme) applyTheme(savedTheme);
} catch {
  // ignore
}

function switchMainView(viewName) {
  state.activeView = viewName === 'references' ? 'references' : 'studio';
  const isStudio = state.activeView === 'studio';

  els.viewStudio.hidden = !isStudio;
  els.viewReferences.hidden = isStudio;
  els.navStudioBtn.classList.toggle('active', isStudio);
  els.navRefsBtn.classList.toggle('active', !isStudio);

  if (isStudio) {
    if (state.studioResult) {
      els.studioOutputSlot.appendChild(els.resultsWorkspace);
      renderWorkspaceResult(state.studioResult);
      els.resultsWorkspace.hidden = false;
    } else {
      els.resultsWorkspace.hidden = true;
    }
  } else {
    if (state.refResult) {
      els.refOutputSlot.appendChild(els.resultsWorkspace);
      renderWorkspaceResult(state.refResult);
      els.resultsWorkspace.hidden = false;
    } else {
      els.resultsWorkspace.hidden = true;
    }
  }
}

els.navStudioBtn.addEventListener('click', () => switchMainView('studio'));
els.navRefsBtn.addEventListener('click', () => switchMainView('references'));
els.brandHomeBtn.addEventListener('click', () => switchMainView('studio'));
els.brandHomeBtn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    switchMainView('studio');
  }
});
els.jumpToRefsChip.addEventListener('click', () => switchMainView('references'));
els.backToStudioFromRefsBtn.addEventListener('click', () => switchMainView('studio'));

// ==================== VERSION / VARIANT DETAILS COMPOSER ====================
function renderVersionRows() {
  els.versionRowsWrap.innerHTML = state.versionRows
    .map(
      (row, idx) => `
      <div class="version-row" data-row-idx="${idx}">
        <input
          type="text"
          class="version-code-input"
          value="${esc(row.code)}"
          placeholder="V${idx + 1}"
          aria-label="Version code"
          data-field="code"
        />
        <input
          type="text"
          class="version-name-input"
          value="${esc(row.name)}"
          placeholder="${idx === 0 ? 'e.g. Standard' : idx === 1 ? 'e.g. Fast-Track' : 'Variant name'}"
          aria-label="Variant name"
          data-field="name"
        />
        <input
          type="text"
          class="version-flow-input"
          value="${esc(row.details)}"
          placeholder="${idx === 0 ? 'e.g. Receive -> Verify -> Approve' : 'Activities or differences (e.g. skips manual review)'}"
          aria-label="Version activities or notes"
          data-field="details"
        />
        <button
          type="button"
          class="version-remove-btn"
          title="Remove version row"
          aria-label="Remove version row"
          data-remove-row="${idx}"
        >&times;</button>
      </div>`,
    )
    .join('');

  els.versionRowsWrap.querySelectorAll('.version-row input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const idx = Number(e.target.closest('.version-row').dataset.rowIdx);
      const field = e.target.dataset.field;
      if (state.versionRows[idx]) {
        state.versionRows[idx][field] = e.target.value;
      }
    });
  });

  els.versionRowsWrap.querySelectorAll('[data-remove-row]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.removeRow);
      if (state.versionRows.length <= 1) {
        state.versionRows = [{ code: 'V1', name: '', details: '' }];
      } else {
        state.versionRows.splice(idx, 1);
      }
      renderVersionRows();
    });
  });
}

function formatVersionRowsAsLines(rows) {
  return rows
    .map((r, i) => {
      const code = (r.code || `V${i + 1}`).trim().toUpperCase();
      const name = (r.name || '').trim();
      const details = (r.details || '').trim();
      if (!name && !details) return '';
      if (name && details) return `${code} (${name}): ${details}`;
      if (details) return `${code}: ${details}`;
      return `${code}: ${name}`;
    })
    .filter(Boolean);
}

function parseLinesIntoVersionRows(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    const m = line.match(/^(?:[-*]\s*)?(?:Variant\s+|Version\s+)?(V\d+)\s*(?:\(([^)]+)\))?\s*[:\-–]\s*(.+)$/i);
    if (m) {
      parsed.push({
        code: m[1].toUpperCase(),
        name: (m[2] || '').trim(),
        details: m[3].trim(),
      });
    }
  }
  return parsed;
}

function setVersionMode(mode) {
  if (mode === state.versionMode) return;
  if (mode === 'text') {
    const lines = formatVersionRowsAsLines(state.versionRows);
    if (lines.length > 0) {
      els.versionNotesInput.value = lines.join('\n');
    }
  } else {
    const parsed = parseLinesIntoVersionRows(els.versionNotesInput.value);
    if (parsed.length > 0) {
      state.versionRows = parsed;
      renderVersionRows();
    }
  }
  state.versionMode = mode;
  els.versionModeRowsBtn.classList.toggle('active', mode === 'rows');
  els.versionModeTextBtn.classList.toggle('active', mode === 'text');
  els.versionRowsWrap.hidden = mode !== 'rows';
  els.versionTextWrap.hidden = mode !== 'text';
  els.addVersionRowBtn.hidden = mode !== 'rows';
}

els.versionModeRowsBtn.addEventListener('click', () => setVersionMode('rows'));
els.versionModeTextBtn.addEventListener('click', () => setVersionMode('text'));
els.addVersionRowBtn.addEventListener('click', () => {
  const nextNum = state.versionRows.length + 1;
  state.versionRows.push({ code: `V${nextNum}`, name: '', details: '' });
  renderVersionRows();
});

function splitPromptIntoProcessAndVersions(fullPrompt) {
  const lines = String(fullPrompt || '').split(/\r?\n/);
  const processLines = [];
  const versionRows = [];

  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^(?:[-*]\s*)?(?:Variant\s+|Version\s+)?(V\d+)\s*(?:\(([^)]+)\))?\s*[:\-–]\s*(.+)$/i);
    if (m) {
      versionRows.push({
        code: m[1].toUpperCase(),
        name: (m[2] || '').trim(),
        details: m[3].trim(),
      });
    } else if (line) {
      processLines.push(line);
    }
  }

  return {
    processText: processLines.join('\n'),
    versionRows,
  };
}

function loadStructuredPromptIntoComposer(fullPrompt) {
  const { processText, versionRows } = splitPromptIntoProcessAndVersions(fullPrompt);
  els.promptInput.value = processText;

  if (versionRows.length > 0) {
    state.versionRows = versionRows;
    els.versionNotesInput.value = formatVersionRowsAsLines(versionRows).join('\n');
    setVersionMode('rows');
    renderVersionRows();
  } else {
    state.versionRows = [
      { code: 'V1', name: '', details: '' },
      { code: 'V2', name: '', details: '' },
    ];
    els.versionNotesInput.value = '';
    setVersionMode('rows');
    renderVersionRows();
  }
}

function buildSubmittedPayload() {
  const processText = els.promptInput.value.trim();
  const versionLines =
    state.versionMode === 'rows'
      ? formatVersionRowsAsLines(state.versionRows)
      : els.versionNotesInput.value
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

  const parts = [];
  if (processText) parts.push(processText);
  if (versionLines.length > 0) parts.push(versionLines.join('\n'));

  return {
    processText,
    versionLines,
    fullPrompt: parts.join('\n\n'),
  };
}

// ==================== BPMN 2.0 SVG RENDERER ====================
function wrapLabelLines(text, maxWidthPx) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [text || ''];
  const maxChars = Math.max(10, Math.floor((maxWidthPx - 18) / 7));
  if (text.length <= maxChars) return [text];

  const lines = [];
  let current = '';
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = w;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (lines.length > 2) {
    return [lines[0], lines.slice(1).join(' ')];
  }
  return lines;
}

function renderBpmnSvg(graph, { highlightedNodes = null, highlightedEdges = null, svgId = 'bpmnSvg' } = {}) {
  const hasTrace = Boolean(highlightedNodes && highlightedEdges);
  const markerId = `${svgId}_arrow`;
  const markerActiveId = `${svgId}_arrow_active`;
  const markerDimId = `${svgId}_arrow_dim`;

  const parts = [];
  parts.push(
    `<svg id="${esc(svgId)}" xmlns="http://www.w3.org/2000/svg" width="${graph.width}" height="${graph.height}" viewBox="0 0 ${graph.width} ${graph.height}" style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">`,
  );
  parts.push(`<rect x="0" y="0" width="${graph.width}" height="${graph.height}" fill="#ffffff" rx="10" />`);
  parts.push('<defs>');
  parts.push(
    `<marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" /></marker>`,
  );
  parts.push(
    `<marker id="${markerActiveId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="#2563eb" /></marker>`,
  );
  parts.push(
    `<marker id="${markerDimId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="#cbd5e1" /></marker>`,
  );
  parts.push(
    '<filter id="cardShadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.8" flood-color="#0f172a" flood-opacity="0.08"/></filter>',
  );
  parts.push('</defs>');

  // Edges
  for (const edge of graph.edges) {
    const isActive = !hasTrace || highlightedEdges.has(edge.id);
    const stroke = !hasTrace ? '#475569' : isActive ? '#2563eb' : '#cbd5e1';
    const strokeWidth = hasTrace && isActive ? 2.6 : 1.7;
    const opacity = !hasTrace || isActive ? 1 : 0.35;
    const marker = !hasTrace ? markerId : isActive ? markerActiveId : markerDimId;
    const pts = edge.waypoints.map((p) => `${p.x},${p.y}`).join(' ');

    parts.push(`<g opacity="${opacity}">`);
    parts.push(
      `<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" marker-end="url(#${marker})" />`,
    );

    if (edge.isDefault && edge.waypoints.length >= 2) {
      const p0 = edge.waypoints[0];
      const p1 = edge.waypoints[1];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const sx = p0.x + ux * 10;
      const sy = p0.y + uy * 10;
      parts.push(
        `<line x1="${sx - 4}" y1="${sy + 5}" x2="${sx + 4}" y2="${sy - 5}" stroke="${stroke}" stroke-width="2" />`,
      );
    }

    if (edge.name || edge.feelCondition) {
      let lx;
      let ly;
      if (edge.isBypass && edge.waypoints.length === 4) {
        lx = (edge.waypoints[1].x + edge.waypoints[2].x) / 2;
        ly = edge.waypoints[1].y - 10;
      } else if (edge.isBypass && edge.waypoints.length === 2) {
        lx = (edge.waypoints[0].x + edge.waypoints[1].x) / 2;
        ly = edge.waypoints[0].y + 18;
      } else if (edge.waypoints.length >= 4) {
        lx = (edge.waypoints[2].x + edge.waypoints[3].x) / 2 - 2;
        ly = edge.waypoints[2].y - 14;
      } else {
        const p0 = edge.waypoints[0];
        const p1 = edge.waypoints[edge.waypoints.length - 1];
        lx = (p0.x + p1.x) / 2;
        ly = (p0.y + p1.y) / 2 - 10;
      }

      const labelText = edge.feelCondition ? `${edge.feelCondition.replace(/^=\s*/, '')}` : edge.name;
      const shortLabel = labelText.length > 58 ? `${labelText.slice(0, 56)}…` : labelText;
      const pillW = Math.max(46, Math.min(390, Math.round(shortLabel.length * 6.2 + 16)));
      const pillBg = edge.feelCondition ? '#eff6ff' : '#f8fafc';
      const pillBorder = edge.feelCondition ? '#93c5fd' : '#cbd5e1';
      const textColor = edge.feelCondition ? '#1d4ed8' : '#334155';

      parts.push(
        `<rect x="${lx - pillW / 2}" y="${ly - 10}" width="${pillW}" height="16" rx="5" fill="${pillBg}" stroke="${pillBorder}" stroke-width="0.9" />`,
      );
      parts.push(
        `<text x="${lx}" y="${ly + 1.5}" text-anchor="middle" font-size="10" font-weight="600" fill="${textColor}">${esc(shortLabel)}</text>`,
      );
    }

    parts.push('</g>');
  }

  // Nodes
  for (const node of graph.nodes) {
    const isActive = !hasTrace || highlightedNodes.has(node.id);
    const opacity = !hasTrace || isActive ? 1 : 0.28;
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;

    parts.push(`<g opacity="${opacity}">`);

    if (node.type === 'startEvent') {
      const stroke = hasTrace && isActive ? '#059669' : '#10b981';
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="${node.width / 2}" fill="#ecfdf5" stroke="${stroke}" stroke-width="2.2" />`,
      );
      parts.push(
        `<text x="${cx}" y="${node.y + node.height + 16}" text-anchor="middle" font-size="11" font-weight="600" fill="#065f46">${esc(node.name || 'Start')}</text>`,
      );
    } else if (node.type === 'endEvent') {
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="${node.width / 2}" fill="#fff1f2" stroke="#be123c" stroke-width="4" />`,
      );
      parts.push(
        `<text x="${cx}" y="${node.y + node.height + 16}" text-anchor="middle" font-size="11" font-weight="600" fill="#9f1239">${esc(node.name || 'End')}</text>`,
      );
    } else if (node.type === 'task') {
      const stroke = hasTrace && isActive ? '#2563eb' : '#334155';
      const fill = hasTrace && isActive ? '#eff6ff' : '#ffffff';
      const sw = hasTrace && isActive ? 2.4 : 1.5;
      parts.push(
        `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="10" ry="10" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" filter="url(#cardShadow)" />`,
      );

      const lines = wrapLabelLines(node.name, node.width);
      const startTextY = lines.length === 1 ? cy + 4 : cy - 3;
      parts.push(`<text text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a">`);
      lines.forEach((line, idx) => {
        parts.push(`<tspan x="${cx}" y="${startTextY + idx * 15}">${esc(line)}</tspan>`);
      });
      parts.push('</text>');
    } else if (node.type === 'exclusiveGateway') {
      const top = `${cx},${node.y}`;
      const right = `${node.x + node.width},${cy}`;
      const bottom = `${cx},${node.y + node.height}`;
      const left = `${node.x},${cy}`;
      const gwStroke = hasTrace && isActive ? '#b45309' : '#d97706';
      const gwFill = hasTrace && isActive ? '#fde68a' : '#fef3c7';
      parts.push(
        `<polygon points="${top} ${right} ${bottom} ${left}" fill="${gwFill}" stroke="${gwStroke}" stroke-width="2" />`,
      );
      parts.push(
        `<path d="M ${cx - 5} ${cy - 5} L ${cx + 5} ${cy + 5} M ${cx + 5} ${cy - 5} L ${cx - 5} ${cy + 5}" stroke="#92400e" stroke-width="2" stroke-linecap="round" />`,
      );
      if (node.name) {
        parts.push(
          `<text x="${cx}" y="${node.y + node.height + 16}" text-anchor="middle" font-size="11" font-weight="600" fill="#78350f">${esc(node.name)}</text>`,
        );
      }
    }

    parts.push('</g>');
  }

  parts.push('</svg>');
  return parts.join('');
}

// ==================== SAFE MARKDOWN RENDERER ====================
function renderSafeMarkdown(mdText) {
  const lines = String(mdText || '').split(/\r?\n/);
  const out = [];
  let inList = false;
  let inQuote = false;
  let tableBuffer = [];

  const formatInline = (text) => {
    let s = esc(text);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return s;
  };

  const flushList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  const flushQuote = () => {
    if (inQuote) {
      out.push('</blockquote>');
      inQuote = false;
    }
  };
  const flushTable = () => {
    if (tableBuffer.length === 0) return;
    const rows = tableBuffer.map((row) =>
      row
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split(/(?<!\\)\|/)
        .map((cell) => cell.replace(/\\\|/g, '|').trim()),
    );
    out.push('<div class="table-wrap"><table>');
    rows.forEach((cells, idx) => {
      if (idx === 1 && cells.every((c) => /^:?-+:?$/.test(c))) return;
      const tag = idx === 0 ? 'th' : 'td';
      out.push('<tr>' + cells.map((c) => `<${tag}>${formatInline(c)}</${tag}>`).join('') + '</tr>');
    });
    out.push('</table></div>');
    tableBuffer = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\|.*\|$/.test(line.trim())) {
      flushList();
      flushQuote();
      tableBuffer.push(line.trim());
      continue;
    }
    flushTable();

    if (!line.trim()) {
      flushList();
      flushQuote();
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushList();
      flushQuote();
      out.push('<hr />');
      continue;
    }

    if (line.startsWith('>')) {
      flushList();
      if (!inQuote) {
        out.push('<blockquote>');
        inQuote = true;
      }
      out.push(`<div>${formatInline(line.replace(/^>\s?/, ''))}</div>`);
      continue;
    }
    flushQuote();

    const hMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (hMatch) {
      flushList();
      const level = hMatch[1].length;
      out.push(`<h${level}>${formatInline(hMatch[2])}</h${level}>`);
      continue;
    }

    const listMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (listMatch) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${formatInline(listMatch[1])}</li>`);
      continue;
    }

    flushList();
    out.push(`<p>${formatInline(line)}</p>`);
  }

  flushTable();
  flushList();
  flushQuote();
  return out.join('\n');
}

// ==================== WORKSPACE RENDERING ====================
function renderKpis(result) {
  const { metrics, traces } = result;
  const matched = traces.filter((t) => t.match).length;

  const cards = [
    {
      label: 'Process Diagrams',
      value: `${metrics.rigid.diagrams} → ${metrics.flexible.diagrams}`,
      delta: metrics.changes.diagrams,
      good: true,
    },
    {
      label: 'Activity Nodes',
      value: `${metrics.rigid.activityNodes} → ${metrics.flexible.activityNodes}`,
      delta: metrics.changes.activityNodes,
      good: metrics.flexible.activityNodes <= metrics.rigid.activityNodes,
    },
    {
      label: 'Total BPMN Nodes',
      value: `${metrics.rigid.totalNodes} → ${metrics.flexible.totalNodes}`,
      delta: metrics.changes.totalNodes,
      good: metrics.flexible.totalNodes <= metrics.rigid.totalNodes,
    },
    {
      label: 'Sequence Flows',
      value: `${metrics.rigid.sequenceFlows} → ${metrics.flexible.sequenceFlows}`,
      delta: metrics.changes.sequenceFlows,
      good: metrics.flexible.sequenceFlows <= metrics.rigid.sequenceFlows,
    },
    {
      label: 'XOR Gateways Added',
      value: `${metrics.rigid.xorGateways} → ${metrics.flexible.xorGateways}`,
      delta: `${metrics.variationPointCount} split/join pairs`,
      good: false,
    },
    {
      label: 'Trace Equivalence',
      value: `${matched} / ${traces.length} ✓`,
      delta: matched === traces.length ? '100% Verified' : 'Mismatch',
      good: matched === traces.length,
    },
  ];

  els.kpiGrid.innerHTML = cards
    .map(
      (c) => `
      <div class="kpi-card">
        <div class="kpi-label">${esc(c.label)}</div>
        <div class="kpi-value">${esc(c.value)}</div>
        <div class="kpi-delta ${c.good ? 'delta-good' : 'delta-neutral'}">${esc(c.delta)}</div>
      </div>`,
    )
    .join('');
}

function renderFlexibleDiagram() {
  const result = state.result;
  if (!result) return;

  let highlightedNodes = null;
  let highlightedEdges = null;

  if (state.selectedTraceVariant !== 'ALL') {
    const trace = result.traces.find((t) => t.variantCode === state.selectedTraceVariant);
    if (trace) {
      highlightedNodes = new Set(trace.visitedNodeIds);
      highlightedEdges = new Set(trace.visitedEdgeIds);
      els.traceSequenceStrip.hidden = false;
      els.traceSequenceStrip.innerHTML = `<strong>${esc(trace.variantCode)} (${esc(trace.variantName)})</strong>: ${
        trace.tracedActivities.map((a) => `<code>${esc(a)}</code>`).join(' &rarr; ') || '<em>Direct Start &rarr; End</em>'
      }`;
    }
  } else {
    els.traceSequenceStrip.hidden = true;
  }

  els.flexSvgContainer.innerHTML = renderBpmnSvg(result.graphs.flexible, {
    highlightedNodes,
    highlightedEdges,
    svgId: 'flexibleBpmnSvg',
  });
  els.flexSvgContainer.style.transform = `scale(${state.zoom})`;
  els.zoomLevelLabel.textContent = `${Math.round(state.zoom * 100)}%`;
}

function renderTraceButtons(result) {
  const buttons = [
    { code: 'ALL', label: 'All Paths (Unified)' },
    ...result.variantsForUi,
  ];
  els.variantTraceButtons.innerHTML = buttons
    .map(
      (b) => `
      <button type="button" class="chip ${state.selectedTraceVariant === b.code ? 'active' : ''}" data-variant="${esc(b.code)}">
        ${esc(b.label)}
      </button>`,
    )
    .join('');

  els.variantTraceButtons.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedTraceVariant = btn.dataset.variant;
      renderTraceButtons(result);
      renderFlexibleDiagram();
    });
  });
}

function renderRigidDiagrams(result) {
  const rigids = result.graphs.rigids;
  els.rigidCountBadge.textContent = String(rigids.length);

  els.rigidDiagramsGrid.innerHTML = rigids
    .map(
      (rg, idx) => `
      <div class="rigid-item">
        <div class="rigid-item-header">
          <h4>${esc(rg.variantCode)} — ${esc(rg.variantName)}</h4>
          <button type="button" class="btn btn-secondary btn-sm" data-download-rigid="${idx}">Download .bpmn</button>
        </div>
        <div class="rigid-svg-wrap">
          ${renderBpmnSvg(rg, { svgId: `rigidSvg_${idx}` })}
        </div>
      </div>`,
    )
    .join('');

  els.rigidDiagramsGrid.querySelectorAll('[data-download-rigid]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.downloadRigid);
      const file = result.files.rigidBpmns[idx];
      if (file) {
        downloadTextFile(file.fileName, file.xml, 'application/xml;charset=utf-8');
      }
    });
  });
}

function renderStatsTab(result) {
  const { metrics, spec, traces } = result;
  const rows = [
    ['Process diagrams', metrics.rigid.diagrams, metrics.flexible.diagrams, metrics.changes.diagrams],
    ['Activity nodes', metrics.rigid.activityNodes, metrics.flexible.activityNodes, metrics.changes.activityNodes],
    ['Start and end events', metrics.rigid.events, metrics.flexible.events, metrics.changes.events],
    ['XOR gateways', metrics.rigid.xorGateways, metrics.flexible.xorGateways, metrics.changes.xorGateways],
    ['Total nodes', metrics.rigid.totalNodes, metrics.flexible.totalNodes, metrics.changes.totalNodes],
    ['Sequence flows', metrics.rigid.sequenceFlows, metrics.flexible.sequenceFlows, metrics.changes.sequenceFlows],
  ];

  els.comparisonBars.innerHTML = rows
    .map(([label, rVal, fVal, chg]) => {
      const max = Math.max(rVal, fVal, 1);
      return `
      <div>
        <div class="bar-row-head">
          <span>${esc(label)}</span>
          <span>${esc(chg)}</span>
        </div>
        <div class="bar-track">
          <div class="bar-line">
            <span class="bar-tag">Rigid</span>
            <div class="bar-fill-wrap"><div class="bar-fill bar-rigid" style="width:${Math.round((rVal / max) * 100)}%"></div></div>
            <span class="bar-val">${rVal}</span>
          </div>
          <div class="bar-line">
            <span class="bar-tag">Flexible</span>
            <div class="bar-fill-wrap"><div class="bar-fill bar-flex" style="width:${Math.round((fVal / max) * 100)}%"></div></div>
            <span class="bar-val">${fVal}</span>
          </div>
        </div>
      </div>`;
    })
    .join('');

  els.tableIvContainer.innerHTML = `
    <table>
      <thead><tr><th>Metric</th><th>${metrics.rigid.diagrams} Rigid</th><th>1 Unified</th><th>Change</th></tr></thead>
      <tbody>
        ${rows
          .map(
            ([label, rVal, fVal, chg], idx) => `
          <tr>
            <td><strong>${esc(label)}</strong></td>
            <td>${idx === 1 ? `${rVal} (${esc(metrics.rigid.activityBreakdown)})` : rVal}</td>
            <td>${fVal}</td>
            <td><strong>${esc(chg)}</strong></td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;

  els.tableVariantsContainer.innerHTML = `
    <table>
      <thead><tr><th>Variant</th><th>Name</th><th>Activity Sequence</th><th># Tasks</th></tr></thead>
      <tbody>
        ${spec.variants
          .map(
            (v) => `
          <tr>
            <td><strong>${esc(v.code)}</strong></td>
            <td>${esc(v.name)}</td>
            <td>${v.sequence.map((s) => esc(s.activityName)).join(' &rarr; ') || '<em>None</em>'}</td>
            <td>${v.sequence.length}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;

  const mandatory = spec.stages.filter((s) => s.kind === 'mandatory');
  const alternative = spec.stages.filter((s) => s.kind === 'alternative' || s.kind === 'hybrid');
  const optional = spec.stages.filter((s) => s.kind === 'optional');

  els.classificationContainer.innerHTML = `
    <div class="classification-grid">
      <div class="class-box">
        <h4>Shared (Mandatory) (${mandatory.length})</h4>
        ${
          mandatory.length
            ? `<ul>${mandatory.map((s) => `<li><strong>${esc(s.activities[0].name)}</strong> (${esc(s.activities[0].variants.join(', '))})</li>`).join('')}</ul>`
            : '<p class="helper-text">None</p>'
        }
      </div>
      <div class="class-box">
        <h4>Alternative / Hybrid Stages (${alternative.length})</h4>
        ${
          alternative.length
            ? `<ul>${alternative
                .map(
                  (s) => `<li><strong>${esc(s.name)}</strong>: ${s.activities
                    .map((a) => `${esc(a.name)} ${a.isDefault ? '<em>(Default)</em>' : `<code>${esc(a.feelCondition)}</code>`}`)
                    .join(' vs ')}${s.bypass ? ` | Skip ${s.bypass.isDefault ? '<em>(Default)</em>' : `<code>${esc(s.bypass.feelCondition)}</code>`}` : ''}</li>`,
                )
                .join('')}</ul>`
            : '<p class="helper-text">None</p>'
        }
      </div>
      <div class="class-box">
        <h4>Optional (Bypass) Stages (${optional.length})</h4>
        ${
          optional.length
            ? `<ul>${optional
                .map((s) => {
                  const a = s.activities[0];
                  return `<li><strong>${esc(s.name)}</strong>: ${esc(a.name)} ${a.isDefault ? '<em>(Default)</em>' : `<code>${esc(a.feelCondition)}</code>`} vs Skip ${s.bypass.isDefault ? '<em>(Default)</em>' : `<code>${esc(s.bypass.feelCondition)}</code>`}</li>`;
                })
                .join('')}</ul>`
            : '<p class="helper-text">None</p>'
        }
      </div>
    </div>`;

  const vpStages = spec.stages.filter((s) => s.kind !== 'mandatory');
  els.tableTracesContainer.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Variant</th>
          ${vpStages.map((s) => `<th>${esc(s.name)}</th>`).join('')}
          <th>Tasks</th>
          <th>Match</th>
        </tr>
      </thead>
      <tbody>
        ${traces
          .map(
            (t) => `
          <tr>
            <td><strong>${esc(t.variantCode)}</strong></td>
            ${vpStages.map((s) => `<td>${esc(t.variationPointChoices[s.id] || 'Bypass')}</td>`).join('')}
            <td>${t.taskCount}</td>
            <td><span class="badge ${t.match ? 'badge-green' : 'badge-amber'}">${t.match ? '✓ Match' : '✗'}</span></td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

function renderMarkdownAndXmlTabs(result) {
  els.mdRenderedView.innerHTML = renderSafeMarkdown(result.files.comparisonMd);
  els.mdRawView.textContent = result.files.comparisonMd;

  const allBpmn = [result.files.flexibleBpmn, ...result.files.rigidBpmns];
  els.xmlFileSelect.innerHTML = allBpmn
    .map((f, i) => `<option value="${i}">${esc(f.fileName)}</option>`)
    .join('');
  els.xmlViewer.textContent = allBpmn[0]?.xml || '';
}

function renderWorkspaceResult(result) {
  result.variantsForUi = result.spec.variants.map((v) => ({
    code: v.code,
    label: `${v.code}: ${v.name}`,
  }));
  state.result = result;
  state.selectedTraceVariant = 'ALL';
  state.zoom = 1;

  els.resultsWorkspace.hidden = false;
  els.resultProcessName.textContent = result.spec.processName;
  els.resultOverview.textContent = result.spec.overview;
  els.resultVariantCountBadge.textContent = `${result.spec.variants.length} Variants`;

  const engineLabel =
    result.engineUsed === 'gemini'
      ? `✦ Gemini LLM (${result.model || 'gemini'})`
      : result.engineUsed === 'reference'
      ? '▤ Canonical Repo Reference'
      : '⚙ Local Rule-Based Parser';
  els.runMetaBadge.textContent = engineLabel;

  renderKpis(result);
  renderTraceButtons(result);
  renderFlexibleDiagram();
  renderRigidDiagrams(result);
  renderStatsTab(result);
  renderMarkdownAndXmlTabs(result);
}

// ==================== CHAT THREAD & HISTORY ====================
function renderStudioThread() {
  const hasHistory = state.studioHistory.length > 0;
  els.studioStage.classList.toggle('is-empty', !hasHistory && els.chatLoadingCard.hidden);
  els.studioHero.classList.toggle('is-compact', hasHistory || !els.chatLoadingCard.hidden);
  els.chatThread.hidden = !hasHistory && els.chatLoadingCard.hidden;
  els.newChatBtn.hidden = !hasHistory;

  if (!hasHistory) {
    els.historyBar.hidden = true;
    els.activePromptBubble.innerHTML = '';
    els.activePromptBubble.hidden = true;
    return;
  }

  const activeTurn = state.studioHistory[state.activeHistoryIdx] || state.studioHistory[state.studioHistory.length - 1];
  els.activePromptBubble.hidden = false;
  els.activePromptBubble.innerHTML = `
    <div class="bubble-top">
      <span class="bubble-tag">Your Process Prompt</span>
      <div class="bubble-actions">
        <button type="button" id="editCurrentTurnBtn" class="btn btn-secondary btn-sm">Edit in Composer</button>
      </div>
    </div>
    ${activeTurn.processText ? `<p class="bubble-text">${esc(activeTurn.processText)}</p>` : ''}
    ${
      activeTurn.versionLines.length > 0
        ? `<div class="bubble-versions">
            <span class="bubble-version-title">Version / Variant Details</span>
            ${activeTurn.versionLines.map((line) => `<div class="bubble-version-item">${esc(line)}</div>`).join('')}
          </div>`
        : ''
    }
  `;

  document.getElementById('editCurrentTurnBtn')?.addEventListener('click', () => {
    loadStructuredPromptIntoComposer(activeTurn.fullPrompt);
    els.promptInput.focus();
    els.promptInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  if (state.studioHistory.length > 1) {
    els.historyBar.hidden = false;
    els.historyBar.innerHTML =
      '<span class="history-label">Session runs:</span>' +
      state.studioHistory
        .map(
          (turn, idx) => `
          <button type="button" class="chip ${idx === state.activeHistoryIdx ? 'active' : ''}" data-history-idx="${idx}">
            ${esc(turn.result.spec.processName)}
          </button>`,
        )
        .join('');

    els.historyBar.querySelectorAll('[data-history-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.historyIdx);
        const turn = state.studioHistory[idx];
        if (!turn) return;
        state.activeHistoryIdx = idx;
        state.studioResult = turn.result;
        renderStudioThread();
        els.studioOutputSlot.appendChild(els.resultsWorkspace);
        renderWorkspaceResult(turn.result);
      });
    });
  } else {
    els.historyBar.hidden = true;
  }
}

// ==================== GENERATE ACTIONS ====================
async function generateFromStudio() {
  const payload = buildSubmittedPayload();
  const mode = els.engineModeSelect.value;

  if (!payload.fullPrompt) {
    showAlert('Please enter a Process description or Version details first.', 'error', 'studio');
    return;
  }

  // Show thread & loading card right away
  els.studioStage.classList.remove('is-empty');
  els.studioHero.classList.add('is-compact');
  els.chatThread.hidden = false;
  els.resultsWorkspace.hidden = true;
  setLoading(true);
  showAlert(null, 'info', 'studio');
  els.chatThread.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: payload.fullPrompt,
        mode,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }

    state.studioHistory.push({
      processText: payload.processText,
      versionLines: payload.versionLines,
      fullPrompt: payload.fullPrompt,
      result: data,
    });
    state.activeHistoryIdx = state.studioHistory.length - 1;
    state.studioResult = data;

    setLoading(false);
    renderStudioThread();
    els.studioOutputSlot.appendChild(els.resultsWorkspace);
    renderWorkspaceResult(data);
    els.chatThread.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (data.notice) {
      showAlert(data.notice, 'info', 'studio');
    }
  } catch (err) {
    setLoading(false);
    if (state.studioHistory.length === 0) {
      renderStudioThread();
    }
    showAlert(err.message || 'Failed to generate process diagrams.', 'error', 'studio');
  }
}

async function inspectRepoReference(presetId) {
  showAlert(null, 'info', 'references');
  state.activeRefId = presetId;
  renderRepoReferencesGrid();

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'reference',
        presetId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    state.refResult = data;
    if (state.activeView === 'references') {
      els.refOutputSlot.appendChild(els.resultsWorkspace);
      renderWorkspaceResult(data);
      els.resultsWorkspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (err) {
    showAlert(err.message || 'Could not load repository reference.', 'error', 'references');
  }
}

// ==================== PRESETS & REPO REFERENCES UI ====================
function renderStarterChips() {
  const starters = state.presets.filter((p) => !p.hasReferenceSpec);
  els.starterChips.innerHTML = starters
    .map(
      (p) => `
      <button type="button" class="chip ${state.activeStarterId === p.id ? 'active' : ''}" data-starter="${esc(p.id)}">
        ${esc(p.shortTitle || p.title)}
      </button>`,
    )
    .join('');

  els.starterChips.querySelectorAll('[data-starter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = starters.find((p) => p.id === btn.dataset.starter);
      if (!preset) return;
      state.activeStarterId = preset.id;
      loadStructuredPromptIntoComposer(preset.prompt);
      renderStarterChips();
      showAlert(null, 'info', 'studio');
    });
  });
}

function renderRepoReferencesGrid() {
  const refs = state.presets.filter((p) => p.hasReferenceSpec);
  els.repoRefCountPill.textContent = String(refs.length);

  els.repoRefGrid.innerHTML = refs
    .map((p) => {
      const meta = p.referenceMeta || {};
      const m = meta.metrics || {};
      const variants = meta.variants || [];
      return `
      <article class="ref-card ${state.activeRefId === p.id ? 'is-selected' : ''}">
        <div class="ref-card-top">
          <span class="folder-pill">${esc(meta.folder || 'Repository Study')}</span>
          <span class="soft-badge">${variants.length} Variants &rarr; 1 Unified</span>
        </div>
        <h3>${esc(p.shortTitle || p.title)}</h3>
        <p class="ref-summary">${esc(meta.summary || '')}</p>

        <div class="ref-metrics-grid">
          <div class="ref-metric-box">
            <div class="ref-metric-label">Activities</div>
            <div class="ref-metric-val">${esc(m.activities || '—')}</div>
            <div class="ref-metric-delta">${esc(m.activitiesDelta || '')}</div>
          </div>
          <div class="ref-metric-box">
            <div class="ref-metric-label">Total Nodes</div>
            <div class="ref-metric-val">${esc(m.totalNodes || '—')}</div>
            <div class="ref-metric-delta">${esc(m.totalNodesDelta || '')}</div>
          </div>
          <div class="ref-metric-box">
            <div class="ref-metric-label">Seq. Flows</div>
            <div class="ref-metric-val">${esc(m.sequenceFlows || '—')}</div>
            <div class="ref-metric-delta">${esc(m.sequenceFlowsDelta || '')}</div>
          </div>
        </div>

        <div class="ref-variants-list">
          ${variants.map((v) => `<span class="ref-variant-pill"><strong>${esc(v.code)}</strong> ${esc(v.name)}</span>`).join('')}
        </div>

        <div class="ref-card-actions">
          <button type="button" class="btn btn-gradient btn-sm" data-inspect-ref="${esc(p.id)}">
            Inspect Reference Model
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-studio-ref="${esc(p.id)}">
            Open in Studio
          </button>
        </div>
      </article>`;
    })
    .join('');

  els.repoRefGrid.querySelectorAll('[data-inspect-ref]').forEach((btn) => {
    btn.addEventListener('click', () => inspectRepoReference(btn.dataset.inspectRef));
  });

  els.repoRefGrid.querySelectorAll('[data-studio-ref]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = refs.find((p) => p.id === btn.dataset.studioRef);
      if (!preset) return;
      state.activeStarterId = null;
      renderStarterChips();
      loadStructuredPromptIntoComposer(preset.prompt);
      switchMainView('studio');
      els.promptInput.focus();
    });
  });
}

async function loadHealthAndPresets() {
  try {
    const [healthRes, presetsRes] = await Promise.all([fetch('/api/health'), fetch('/api/presets')]);
    const health = await healthRes.json();
    const presetsData = await presetsRes.json();
    state.health = health;
    state.presets = presetsData.presets || [];

    if (health.apiKeyConfigured) {
      els.apiStatusBadge.className = 'status-badge status-ok';
      const providerText =
        health.apiKeyProvider === 'vertex-express' ? 'Vertex Express' : 'Gemini Ready';
      els.apiStatusBadge.textContent = `● ${providerText} · ${health.model}`;
    } else if (health.placeholderDetected) {
      els.apiStatusBadge.className = 'status-badge status-warn';
      els.apiStatusBadge.textContent = '● API_KEY placeholder · Local Mode';
    } else {
      els.apiStatusBadge.className = 'status-badge status-warn';
      els.apiStatusBadge.textContent = '● Offline · Local Parser';
    }

    renderStarterChips();
    renderRepoReferencesGrid();
  } catch (err) {
    els.apiStatusBadge.className = 'status-badge status-warn';
    els.apiStatusBadge.textContent = 'Backend unreachable';
    showAlert(`Could not connect to backend: ${err.message}`, 'error', 'studio');
  }
}

// ==================== TABS & CONTROLS ====================
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      const isMatch = panel.id === `tab-${target}`;
      panel.hidden = !isMatch;
      panel.classList.toggle('active', isMatch);
    });
  });
});

els.generateBtn.addEventListener('click', generateFromStudio);

[els.promptInput, els.versionNotesInput].forEach((ta) => {
  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      generateFromStudio();
    }
  });
});

els.clearBtn.addEventListener('click', () => {
  els.promptInput.value = '';
  els.versionNotesInput.value = '';
  state.versionRows = [
    { code: 'V1', name: '', details: '' },
    { code: 'V2', name: '', details: '' },
  ];
  state.activeStarterId = null;
  renderVersionRows();
  renderStarterChips();
  showAlert(null, 'info', 'studio');
});

els.newChatBtn.addEventListener('click', () => {
  state.studioHistory = [];
  state.activeHistoryIdx = -1;
  state.studioResult = null;
  els.resultsWorkspace.hidden = true;
  renderStudioThread();
  els.clearBtn.click();
  els.promptInput.focus();
});

els.zoomInBtn.addEventListener('click', () => {
  state.zoom = Math.min(2, +(state.zoom + 0.15).toFixed(2));
  renderFlexibleDiagram();
});
els.zoomOutBtn.addEventListener('click', () => {
  state.zoom = Math.max(0.4, +(state.zoom - 0.15).toFixed(2));
  renderFlexibleDiagram();
});
els.zoomResetBtn.addEventListener('click', () => {
  state.zoom = 1;
  renderFlexibleDiagram();
});

els.downloadFlexSvgBtn.addEventListener('click', () => {
  if (!state.result) return;
  const svgHtml = renderBpmnSvg(state.result.graphs.flexible, { svgId: 'exportFlexibleBpmnSvg' });
  downloadTextFile(`Flexible_${state.result.spec.slug}.svg`, svgHtml, 'image/svg+xml;charset=utf-8');
});

els.mdToggleRawBtn.addEventListener('click', () => {
  state.showRawMd = !state.showRawMd;
  els.mdRenderedView.hidden = state.showRawMd;
  els.mdRawView.hidden = !state.showRawMd;
  els.mdToggleRawBtn.textContent = state.showRawMd ? 'Show Formatted Preview' : 'Show Raw Markdown';
});

els.copyMdBtn.addEventListener('click', async () => {
  if (!state.result) return;
  try {
    await navigator.clipboard.writeText(state.result.files.comparisonMd);
    els.copyMdBtn.textContent = 'Copied!';
    setTimeout(() => {
      els.copyMdBtn.textContent = 'Copy Markdown';
    }, 1500);
  } catch {
    showAlert('Clipboard copy failed in this browser context. Use Download .md instead.', 'info', state.activeView);
  }
});

const downloadMdHandler = () => {
  if (!state.result) return;
  downloadTextFile(
    state.result.files.comparisonFileName || 'Comparison_Analysis.md',
    state.result.files.comparisonMd,
    'text/markdown;charset=utf-8',
  );
};
els.downloadMdBtn.addEventListener('click', downloadMdHandler);
els.downloadMdBtn2.addEventListener('click', downloadMdHandler);

els.downloadFlexBpmnBtn.addEventListener('click', () => {
  if (!state.result) return;
  const f = state.result.files.flexibleBpmn;
  downloadTextFile(f.fileName, f.xml, 'application/xml;charset=utf-8');
});

els.xmlFileSelect.addEventListener('change', () => {
  if (!state.result) return;
  const allBpmn = [state.result.files.flexibleBpmn, ...state.result.files.rigidBpmns];
  const chosen = allBpmn[Number(els.xmlFileSelect.value)];
  els.xmlViewer.textContent = chosen?.xml || '';
});

els.copyXmlBtn.addEventListener('click', async () => {
  if (!state.result) return;
  try {
    await navigator.clipboard.writeText(els.xmlViewer.textContent);
    els.copyXmlBtn.textContent = 'Copied!';
    setTimeout(() => {
      els.copyXmlBtn.textContent = 'Copy XML';
    }, 1500);
  } catch {
    showAlert('Clipboard copy failed in this browser context. Use Download .bpmn instead.', 'info', state.activeView);
  }
});

els.downloadSelectedXmlBtn.addEventListener('click', () => {
  if (!state.result) return;
  const allBpmn = [state.result.files.flexibleBpmn, ...state.result.files.rigidBpmns];
  const chosen = allBpmn[Number(els.xmlFileSelect.value)];
  if (chosen) {
    downloadTextFile(chosen.fileName, chosen.xml, 'application/xml;charset=utf-8');
  }
});

els.downloadZipBtn.addEventListener('click', async () => {
  if (!state.result) return;
  try {
    const files = [
      { name: state.result.files.comparisonFileName, content: state.result.files.comparisonMd },
      { name: state.result.files.flexibleBpmn.fileName, content: state.result.files.flexibleBpmn.xml },
      ...state.result.files.rigidBpmns.map((f) => ({ name: f.fileName, content: f.xml })),
    ];
    const res = await fetch('/api/export-zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        archiveName: `${state.result.spec.slug}_BPM_Bundle.zip`,
        files,
      }),
    });
    if (!res.ok) {
      showAlert('Failed to build ZIP bundle.', 'error', state.activeView);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.result.spec.slug}_BPM_Bundle.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showAlert(`Failed to export ZIP bundle: ${err.message}`, 'error', state.activeView);
  }
});

renderVersionRows();
renderStudioThread();
loadHealthAndPresets();
