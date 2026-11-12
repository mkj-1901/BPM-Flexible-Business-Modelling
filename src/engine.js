// Deterministic BPMN 2.0 & Rigid-vs-Flexible Comparison Analysis Engine.
// Matches the methodology and BPMN 2.0 / Camunda 8 FEEL conventions in this repository.

const SKIP_TOKENS = new Set(['skip', 'bypass', 'none', 'null', 'na', 'n/a', '']);

export function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function toPascalSlug(str, fallback = 'Process') {
  const cleaned = String(str ?? '')
    .replace(/[^A-Za-z0-9\s_-]+/g, ' ')
    .trim();
  if (!cleaned) return fallback;
  return cleaned
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

export function toFileSlug(str, fallback = 'Process') {
  const cleaned = String(str ?? '')
    .replace(/[^A-Za-z0-9\s_-]+/g, ' ')
    .trim();
  if (!cleaned) return fallback;
  return cleaned
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('_');
}

export function sanitizeXmlId(raw, fallback = 'Node', usedIds = null) {
  let base = String(raw ?? '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!base) base = fallback;
  if (!/^[A-Za-z_]/.test(base)) {
    base = `N_${base}`;
  }
  if (!usedIds) return base;

  let candidate = base;
  let counter = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}_${counter++}`;
  }
  usedIds.add(candidate);
  return candidate;
}

export function isSkipValue(val) {
  if (val === null || val === undefined) return true;
  if (typeof val !== 'string') return false;
  return SKIP_TOKENS.has(val.trim().toLowerCase());
}

export function computeTaskWidth(name) {
  const len = String(name || '').length;
  return Math.max(125, Math.min(230, Math.round(len * 7.4 + 34)));
}

export function computeEdgePillWidth(text) {
  const clean = String(text || '').trim();
  if (!clean) return 0;
  return Math.max(46, Math.round(clean.length * 6.3 + 18));
}

function escapeMdCell(str) {
  return String(str ?? '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

function createValidationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

export function formatPctChange(rigidVal, flexVal) {
  if (rigidVal === 0) {
    if (flexVal === 0) return '0%';
    return flexVal > 0 ? `+${flexVal}` : `${flexVal}`;
  }
  const pct = Math.round(((flexVal - rigidVal) / rigidVal) * 100);
  if (pct < 0) return `\u2212${Math.abs(pct)}%`;
  if (pct > 0) return `+${pct}%`;
  return '0%';
}

export function evaluateFeelVariantCondition(expr, variantCode) {
  if (!expr || typeof expr !== 'string') return false;
  const trimmed = expr.trim().replace(/^=\s*/, '');
  const matches = [...trimmed.matchAll(/variant\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  if (matches.length === 0) return false;
  return matches.includes(variantCode);
}

/**
 * Normalizes any LLM-produced or user-supplied ProcessSpec into a canonical,
 * self-consistent structure where stage kinds, FEEL expressions, and default
 * branches are mathematically derived from the variant trace matrix.
 */
export function normalizeProcessSpec(rawSpec) {
  if (!rawSpec || typeof rawSpec !== 'object') {
    throw createValidationError('Process specification must be a JSON object.');
  }

  const processName = String(rawSpec.processName || rawSpec.name || 'Custom Business Process').trim() || 'Custom Business Process';
  const overview = String(
    rawSpec.overview ||
      `Comparison of rigid variant models against a unified flexible BPMN 2.0 model for the ${processName}.`,
  ).trim();
  const slug = toFileSlug(processName, 'Custom_Process');
  const pascalSlug = toPascalSlug(processName, 'CustomProcess');

  const rawStages = Array.isArray(rawSpec.stages) ? rawSpec.stages : [];
  const rawVariants = Array.isArray(rawSpec.variants) ? rawSpec.variants : [];

  if (rawStages.length === 0) {
    throw createValidationError('Process specification must contain at least one stage.');
  }
  if (rawVariants.length === 0) {
    throw createValidationError('Process specification must contain at least one variant.');
  }

  const usedVariantCodes = new Set();
  const normalizedVariantsInput = rawVariants.map((v, idx) => {
    let code = String(v?.code || `V${idx + 1}`).trim().replace(/[^A-Za-z0-9_-]/g, '');
    if (!code) code = `V${idx + 1}`;
    let finalCode = code;
    let suffix = 2;
    while (usedVariantCodes.has(finalCode)) {
      finalCode = `${code}_${suffix++}`;
    }
    usedVariantCodes.add(finalCode);

    // Support both object map `{ stageId: choice }` and array `[{ stageId, choice }]`
    const choiceMap = new Map();
    const choiceLowerMap = new Map();
    const choiceNormMap = new Map();
    const orderedChoices = [];

    const registerChoice = (k, val) => {
      const key = String(k).trim();
      if (!key) return;
      choiceMap.set(key, val);
      const lower = key.toLowerCase();
      if (!choiceLowerMap.has(lower)) choiceLowerMap.set(lower, val);
      const norm = lower.replace(/[^a-z0-9]+/g, '');
      if (norm && !choiceNormMap.has(norm)) choiceNormMap.set(norm, val);
    };

    if (Array.isArray(v?.choices)) {
      for (const item of v.choices) {
        if (item && item.stageId !== undefined) {
          registerChoice(item.stageId, item.choice);
          orderedChoices.push(item.choice);
        }
      }
    } else if (v?.choices && typeof v.choices === 'object') {
      for (const [k, val] of Object.entries(v.choices)) {
        registerChoice(k, val);
        orderedChoices.push(val);
      }
    }

    return {
      code: finalCode,
      name: String(v?.name || `Variant ${finalCode}`).trim() || `Variant ${finalCode}`,
      description: String(v?.description || '').trim(),
      rawChoices: choiceMap,
      rawChoicesLower: choiceLowerMap,
      rawChoicesNorm: choiceNormMap,
      orderedChoices,
    };
  });

  const usedStageIds = new Set();
  const usedActivityIds = new Set(['StartEvent', 'EndEvent']);

  const canonicalStages = [];

  for (let sIdx = 0; sIdx < rawStages.length; sIdx++) {
    const rawStage = rawStages[sIdx] || {};
    const rawStageKey = String(rawStage.id ?? `stage_${sIdx + 1}`).trim();
    const stageId = sanitizeXmlId(rawStageKey, `Stage_${sIdx + 1}`, usedStageIds);
    const stageName = String(rawStage.name || `Stage ${sIdx + 1}`).trim() || `Stage ${sIdx + 1}`;

    const rawActivities = Array.isArray(rawStage.activities) ? rawStage.activities : [];
    const candidates = [];
    const lookupByRawIdOrName = new Map();
    const registerLookup = (key, obj) => {
      const k = String(key || '').trim().toLowerCase();
      if (k && !lookupByRawIdOrName.has(k)) {
        lookupByRawIdOrName.set(k, obj);
      }
    };

    for (let aIdx = 0; aIdx < rawActivities.length; aIdx++) {
      const act = rawActivities[aIdx];
      if (!act) continue;
      const actName = typeof act === 'string' ? act.trim() : String(act.name || act.id || '').trim();
      if (!actName || isSkipValue(actName)) continue;
      const rawActId = typeof act === 'string' ? toPascalSlug(actName) : String(act.id || toPascalSlug(actName)).trim();
      const actId = sanitizeXmlId(rawActId, `Task_${sIdx + 1}_${aIdx + 1}`, usedActivityIds);
      const branchLabel = typeof act === 'object' ? String(act.branchLabel || '').trim() : '';

      const obj = {
        id: actId,
        rawId: rawActId,
        name: actName,
        branchLabel,
      };
      candidates.push(obj);
      registerLookup(rawActId, obj);
      registerLookup(actId, obj);
      registerLookup(actName, obj);
      registerLookup(toPascalSlug(actName), obj);
    }

    // Resolve each variant's choice at this stage
    const stageChoicesByVariant = new Map();
    const usageCountByActId = new Map();
    const variantsByActId = new Map();
    const skipVariants = [];

    for (const variant of normalizedVariantsInput) {
      let rawChoice = variant.rawChoices.get(rawStageKey);
      if (rawChoice === undefined) rawChoice = variant.rawChoices.get(stageId);
      if (rawChoice === undefined) rawChoice = variant.rawChoices.get(stageName);
      if (rawChoice === undefined) {
        const keyLower = rawStageKey.toLowerCase();
        const nameLower = stageName.toLowerCase();
        rawChoice =
          variant.rawChoicesLower.get(keyLower) ??
          variant.rawChoicesLower.get(stageId.toLowerCase()) ??
          variant.rawChoicesLower.get(nameLower) ??
          variant.rawChoicesNorm.get(keyLower.replace(/[^a-z0-9]+/g, '')) ??
          variant.rawChoicesNorm.get(nameLower.replace(/[^a-z0-9]+/g, ''));
      }
      if (rawChoice === undefined && variant.orderedChoices.length === rawStages.length) {
        rawChoice = variant.orderedChoices[sIdx];
      }

      const normalizedRawChoice =
        typeof rawChoice === 'object' && rawChoice !== null
          ? rawChoice.id ?? rawChoice.activityId ?? rawChoice.name ?? ''
          : rawChoice;

      if (isSkipValue(normalizedRawChoice)) {
        stageChoicesByVariant.set(variant.code, 'SKIP');
        skipVariants.push(variant.code);
        continue;
      }

      const choiceStr = String(normalizedRawChoice).trim();
      let matched =
        lookupByRawIdOrName.get(choiceStr.toLowerCase()) ||
        lookupByRawIdOrName.get(toPascalSlug(choiceStr).toLowerCase());
      if (!matched) {
        // If variant specifies a valid new task name not in candidates, register it cleanly
        const actId = sanitizeXmlId(toPascalSlug(choiceStr), `Task_${sIdx + 1}_Extra`, usedActivityIds);
        matched = {
          id: actId,
          rawId: choiceStr,
          name: choiceStr,
          branchLabel: '',
        };
        candidates.push(matched);
        registerLookup(choiceStr, matched);
        registerLookup(actId, matched);
      }

      stageChoicesByVariant.set(variant.code, matched.id);
      usageCountByActId.set(matched.id, (usageCountByActId.get(matched.id) || 0) + 1);
      if (!variantsByActId.has(matched.id)) variantsByActId.set(matched.id, []);
      variantsByActId.get(matched.id).push(variant.code);
    }

    // Keep only activities actually executed by >= 1 variant
    const activeActivities = candidates.filter((c) => (usageCountByActId.get(c.id) || 0) > 0);

    // If every variant skips this stage, omit the empty stage
    if (activeActivities.length === 0) {
      continue;
    }

    const hasBypass = skipVariants.length > 0;
    let kind;
    if (activeActivities.length === 1 && !hasBypass) {
      kind = 'mandatory';
    } else if (activeActivities.length === 1 && hasBypass) {
      kind = 'optional';
    } else if (activeActivities.length >= 2 && !hasBypass) {
      kind = 'alternative';
    } else {
      kind = 'hybrid';
    }

    // Choose default branch
    let defaultBranch = null;
    if (kind !== 'mandatory') {
      const requestedDefault = rawStage.defaultBranch ? String(rawStage.defaultBranch).trim() : '';
      if (requestedDefault) {
        if (isSkipValue(requestedDefault) && hasBypass) {
          defaultBranch = 'SKIP';
        } else {
          const foundDefault = lookupByRawIdOrName.get(requestedDefault.toLowerCase());
          if (foundDefault && activeActivities.some((a) => a.id === foundDefault.id)) {
            defaultBranch = foundDefault.id;
          }
        }
      }

      if (!defaultBranch) {
        // Pick branch with highest number of variants; on tie in optional, favor SKIP if >= half skip
        let bestId = activeActivities[0].id;
        let bestCount = variantsByActId.get(bestId).length;
        for (const act of activeActivities) {
          const cnt = variantsByActId.get(act.id).length;
          if (cnt > bestCount) {
            bestId = act.id;
            bestCount = cnt;
          }
        }
        if (hasBypass && (skipVariants.length > bestCount || (kind === 'optional' && skipVariants.length >= bestCount))) {
          bestId = 'SKIP';
        }
        defaultBranch = bestId;
      }
    }

    const bypassLabel = hasBypass
      ? String(rawStage.bypassLabel || `Skip (${skipVariants.join(', ')})`).trim()
      : '';

    const enrichedActivities = activeActivities.map((act) => {
      const variantsForAct = variantsByActId.get(act.id) || [];
      const isDefault = kind !== 'mandatory' && defaultBranch === act.id;
      const feelCondition =
        kind === 'mandatory' || isDefault
          ? null
          : `= ${variantsForAct.map((vc) => `variant = "${vc}"`).join(' or ')}`;
      const fallbackBranchLabel =
        kind === 'mandatory'
          ? ''
          : act.branchLabel || variantsForAct.join(', ');

      return {
        id: act.id,
        name: act.name,
        branchLabel: fallbackBranchLabel,
        variants: variantsForAct,
        isDefault,
        feelCondition,
      };
    });

    const bypassInfo = hasBypass
      ? {
          variants: skipVariants,
          isDefault: defaultBranch === 'SKIP',
          label: bypassLabel || `Skip (${skipVariants.join(', ')})`,
          feelCondition:
            defaultBranch === 'SKIP'
              ? null
              : `= ${skipVariants.map((vc) => `variant = "${vc}"`).join(' or ')}`,
        }
      : null;

    canonicalStages.push({
      id: stageId,
      name: stageName,
      kind,
      defaultBranch,
      activities: enrichedActivities,
      bypass: bypassInfo,
      _choicesByVariant: stageChoicesByVariant,
    });
  }

  if (canonicalStages.length === 0) {
    throw createValidationError(
      'No active activities matched across any variant. Check that variant choices reference valid stage IDs.',
    );
  }

  // Finalize variants with cleaned choices and task sequence
  const variants = normalizedVariantsInput.map((v) => {
    const choices = {};
    const sequence = [];
    for (const st of canonicalStages) {
      const ch = st._choicesByVariant.get(v.code) || 'SKIP';
      choices[st.id] = ch;
      if (ch !== 'SKIP') {
        const act = st.activities.find((a) => a.id === ch);
        if (act) sequence.push({ stageId: st.id, stageName: st.name, activityId: act.id, activityName: act.name });
      }
    }
    return {
      code: v.code,
      name: v.name,
      description: v.description || `${v.name}: ${sequence.map((s) => s.activityName).join(' -> ') || 'Direct completion'}`,
      choices,
      sequence,
    };
  });

  // Strip internal temporary field
  const stages = canonicalStages.map(({ _choicesByVariant, ...rest }) => rest);

  return {
    processName,
    slug,
    pascalSlug,
    overview,
    stages,
    variants,
  };
}

export function computeMetrics(spec) {
  const variantCount = spec.variants.length;
  const variantTaskCounts = spec.variants.map((v) => v.sequence.length);
  const rigidActivityNodes = variantTaskCounts.reduce((a, b) => a + b, 0);
  const rigidEvents = variantCount * 2;
  const rigidXorGateways = 0;
  const rigidTotalNodes = rigidActivityNodes + rigidEvents;
  const rigidFlowCounts = variantTaskCounts.map((t) => t + 1);
  const rigidSequenceFlows = rigidFlowCounts.reduce((a, b) => a + b, 0);

  const variationPointStages = spec.stages.filter((s) => s.kind !== 'mandatory');
  const mandatoryStages = spec.stages.filter((s) => s.kind === 'mandatory');

  const flexDiagrams = 1;
  const flexActivityNodes = spec.stages.reduce((acc, s) => acc + s.activities.length, 0);
  const flexEvents = 2;
  const flexXorGateways = variationPointStages.length * 2;
  const flexTotalNodes = flexEvents + flexActivityNodes + flexXorGateways;

  // Spine links: Start -> stage_1 -> ... -> stage_m -> End = stages.length + 1
  // Plus each variation point adds: 2 * activities + (bypass ? 1 : 0)
  const spineFlows = spec.stages.length + 1;
  const vpInternalFlows = variationPointStages.reduce(
    (acc, s) => acc + s.activities.length * 2 + (s.bypass ? 1 : 0),
    0,
  );
  const flexSequenceFlows = spineFlows + vpInternalFlows;

  const mandatoryActivitiesCount = mandatoryStages.length;
  const alternativeStages = spec.stages.filter((s) => s.kind === 'alternative');
  const hybridStages = spec.stages.filter((s) => s.kind === 'hybrid');
  const optionalStages = spec.stages.filter((s) => s.kind === 'optional');

  return {
    variantCount,
    variantTaskCounts,
    rigidFlowCounts,
    variationPointCount: variationPointStages.length,
    mandatoryCount: mandatoryActivitiesCount,
    alternativeCount: alternativeStages.reduce((a, s) => a + s.activities.length, 0),
    hybridCount: hybridStages.reduce((a, s) => a + s.activities.length, 0),
    optionalCount: optionalStages.reduce((a, s) => a + s.activities.length, 0),
    rigid: {
      diagrams: variantCount,
      activityNodes: rigidActivityNodes,
      activityBreakdown: variantTaskCounts.join('+'),
      events: rigidEvents,
      xorGateways: rigidXorGateways,
      totalNodes: rigidTotalNodes,
      sequenceFlows: rigidSequenceFlows,
      sequenceFlowBreakdown: rigidFlowCounts.join('+'),
    },
    flexible: {
      diagrams: flexDiagrams,
      activityNodes: flexActivityNodes,
      events: flexEvents,
      xorGateways: flexXorGateways,
      totalNodes: flexTotalNodes,
      sequenceFlows: flexSequenceFlows,
    },
    changes: {
      diagrams: formatPctChange(variantCount, flexDiagrams),
      activityNodes: formatPctChange(rigidActivityNodes, flexActivityNodes),
      events: formatPctChange(rigidEvents, flexEvents),
      xorGateways: formatPctChange(rigidXorGateways, flexXorGateways),
      totalNodes: formatPctChange(rigidTotalNodes, flexTotalNodes),
      sequenceFlows: formatPctChange(rigidSequenceFlows, flexSequenceFlows),
    },
  };
}

/**
 * Builds structured node + edge + BPMNDI geometry for both the Unified Flexible
 * diagram and every Rigid variant diagram.
 */
export function buildDiagramGraphs(spec) {
  const allVariantCodes = spec.variants.map((v) => v.code);

  // 1. Compute vertical offsets (dy relative to centerY) for each stage first
  const stageLayouts = spec.stages.map((stage) => {
    const n = stage.activities.length;
    const hasBypass = Boolean(stage.bypass);
    const taskHeight = 60;
    const branchWidths = stage.activities.map((a) => computeTaskWidth(a.name));
    const maxTaskWidth = Math.max(...branchWidths, 125);

    let offsets = [0];
    let archDy = null;

    if (stage.kind === 'mandatory') {
      offsets = [0];
    } else if (stage.kind === 'optional') {
      // Single optional task placed cleanly above centerline; straight bypass along centerline
      offsets = [-84];
    } else if (n === 2) {
      offsets = [-72, 72];
      if (hasBypass) {
        archDy = -146; // Clean top bypass arch above the upper task
      }
    } else {
      const spacing = 94;
      offsets = stage.activities.map((_, i) => (i - (n - 1) / 2) * spacing);
      if (hasBypass) {
        archDy = offsets[0] - 74;
      }
    }

    const minDy = Math.min(
      ...offsets.map((o) => o - taskHeight / 2),
      archDy !== null ? archDy - 28 : 0,
      -30,
    );
    const maxDy = Math.max(
      ...offsets.map((o) => o + taskHeight / 2),
      stage.kind !== 'mandatory' ? 58 : 30,
    );

    const branchPillWidths = stage.activities.map((a) => {
      const display = a.feelCondition ? a.feelCondition.replace(/^=\s*/, '') : a.branchLabel;
      return computeEdgePillWidth(display);
    });
    const maxBranchPillWidth = Math.max(0, ...branchPillWidths);
    const bypassText = stage.bypass
      ? stage.bypass.feelCondition
        ? stage.bypass.feelCondition.replace(/^=\s*/, '')
        : stage.bypass.label || 'Skip'
      : '';
    const bypassPillWidth = computeEdgePillWidth(bypassText);

    return {
      stage,
      offsets,
      archDy,
      maxTaskWidth,
      maxBranchPillWidth,
      bypassPillWidth,
      minDy,
      maxDy,
    };
  });

  const globalMinDy = stageLayouts.length ? Math.min(...stageLayouts.map((l) => l.minDy)) : -30;
  const globalMaxDy = stageLayouts.length ? Math.max(...stageLayouts.map((l) => l.maxDy)) : 30;

  const topPadding = 72;
  const bottomPadding = 72;
  const centerY = Math.round(Math.abs(globalMinDy) + topPadding);
  const flexHeight = Math.round(centerY + globalMaxDy + bottomPadding);

  const flexNodes = [];
  const flexEdges = [];
  const usedFlexIds = new Set();

  const startId = sanitizeXmlId('StartEvent', 'StartEvent', usedFlexIds);
  const endId = sanitizeXmlId('EndEvent', 'EndEvent', usedFlexIds);

  let curX = 44;
  const startNode = {
    id: startId,
    type: 'startEvent',
    name: 'Start',
    x: curX,
    y: centerY - 18,
    width: 36,
    height: 36,
    variants: [...allVariantCodes],
  };
  flexNodes.push(startNode);
  const startXGap = stageLayouts[0]?.stage?.kind !== 'mandatory' ? 56 : 44;
  curX += 36 + startXGap;

  let prevAnchor = { id: startNode.id, rightX: startNode.x + startNode.width, y: centerY };
  const flexFlowIds = new Set();

  for (let i = 0; i < stageLayouts.length; i++) {
    const layout = stageLayouts[i];
    const { stage, offsets, archDy, maxTaskWidth, maxBranchPillWidth, bypassPillWidth } = layout;

    if (stage.kind === 'mandatory') {
      const act = stage.activities[0];
      const taskWidth = computeTaskWidth(act.name);
      const taskId = sanitizeXmlId(act.id, `Task_${i + 1}`, usedFlexIds);
      const taskNode = {
        id: taskId,
        type: 'task',
        name: act.name,
        stageId: stage.id,
        stageName: stage.name,
        x: curX,
        y: centerY - 30,
        width: taskWidth,
        height: 60,
        variants: [...act.variants],
      };
      flexNodes.push(taskNode);

      const flowId = sanitizeXmlId(`Flow_${prevAnchor.id}_${taskId}`, 'Flow', flexFlowIds);
      flexEdges.push({
        id: flowId,
        sourceRef: prevAnchor.id,
        targetRef: taskId,
        name: '',
        isDefault: false,
        feelCondition: null,
        variants: [...allVariantCodes],
        waypoints: [
          { x: prevAnchor.rightX, y: centerY },
          { x: taskNode.x, y: centerY },
        ],
      });

      prevAnchor = { id: taskId, rightX: taskNode.x + taskNode.width, y: centerY };
      const nextIsVp = stageLayouts[i + 1]?.stage?.kind !== 'mandatory';
      curX += taskWidth + (nextIsVp ? 56 : 44);
    } else {
      // Variation Point: Split Gateway -> Branches -> Join Gateway
      const splitId = sanitizeXmlId(`${toPascalSlug(stage.id)}Split`, `Split_${i + 1}`, usedFlexIds);
      const joinId = sanitizeXmlId(`${toPascalSlug(stage.id)}Join`, `Join_${i + 1}`, usedFlexIds);

      const splitNode = {
        id: splitId,
        type: 'exclusiveGateway',
        gatewayDirection: 'Diverging',
        name: stage.name,
        stageId: stage.id,
        defaultFlowId: null,
        x: curX,
        y: centerY - 16,
        width: 32,
        height: 32,
        variants: [...allVariantCodes],
      };
      flexNodes.push(splitNode);

      // Connect previous anchor -> Split
      const entryFlowId = sanitizeXmlId(`Flow_${prevAnchor.id}_${splitId}`, 'Flow', flexFlowIds);
      flexEdges.push({
        id: entryFlowId,
        sourceRef: prevAnchor.id,
        targetRef: splitId,
        name: '',
        isDefault: false,
        feelCondition: null,
        variants: [...allVariantCodes],
        waypoints: [
          { x: prevAnchor.rightX, y: centerY },
          { x: splitNode.x, y: centerY },
        ],
      });

      const elbowOutOffset = 36;
      const horizontalPillSpan = Math.max(96, maxBranchPillWidth + 28);
      const branchGap = elbowOutOffset + horizontalPillSpan;
      const branchStartX = curX + 32 + branchGap;
      const minJoinXForStraightBypass =
        stage.bypass && archDy === null
          ? curX + 32 + elbowOutOffset + bypassPillWidth + 56
          : 0;
      const joinX = Math.max(branchStartX + maxTaskWidth + 52, minJoinXForStraightBypass);

      const joinNode = {
        id: joinId,
        type: 'exclusiveGateway',
        gatewayDirection: 'Converging',
        name: '',
        stageId: stage.id,
        x: joinX,
        y: centerY - 16,
        width: 32,
        height: 32,
        variants: [...allVariantCodes],
      };

      // Activity branches
      stage.activities.forEach((act, bIdx) => {
        const dy = offsets[bIdx];
        const taskCenterY = Math.round(centerY + dy);
        const taskWidth = computeTaskWidth(act.name);
        const taskX = Math.round(branchStartX + (maxTaskWidth - taskWidth) / 2);
        const taskId = sanitizeXmlId(act.id, `Task_${i + 1}_${bIdx + 1}`, usedFlexIds);

        const taskNode = {
          id: taskId,
          type: 'task',
          name: act.name,
          stageId: stage.id,
          stageName: stage.name,
          x: taskX,
          y: taskCenterY - 30,
          width: taskWidth,
          height: 60,
          variants: [...act.variants],
        };
        flexNodes.push(taskNode);

        const splitToTaskId = sanitizeXmlId(`Flow_${splitId}_${taskId}`, 'Flow', flexFlowIds);
        if (act.isDefault) {
          splitNode.defaultFlowId = splitToTaskId;
        }
        const elbowOutX = splitNode.x + 32 + elbowOutOffset;
        flexEdges.push({
          id: splitToTaskId,
          sourceRef: splitId,
          targetRef: taskId,
          name: act.branchLabel || '',
          isDefault: act.isDefault,
          feelCondition: act.feelCondition,
          variants: [...act.variants],
          waypoints: [
            { x: splitNode.x + 32, y: centerY },
            { x: elbowOutX, y: centerY },
            { x: elbowOutX, y: taskCenterY },
            { x: taskNode.x, y: taskCenterY },
          ],
        });

        const taskToJoinId = sanitizeXmlId(`Flow_${taskId}_${joinId}`, 'Flow', flexFlowIds);
        const elbowInX = joinNode.x - 20;
        flexEdges.push({
          id: taskToJoinId,
          sourceRef: taskId,
          targetRef: joinId,
          name: '',
          isDefault: false,
          feelCondition: null,
          variants: [...act.variants],
          waypoints: [
            { x: taskNode.x + taskNode.width, y: taskCenterY },
            { x: elbowInX, y: taskCenterY },
            { x: elbowInX, y: centerY },
            { x: joinNode.x, y: centerY },
          ],
        });
      });

      // Bypass branch (Optional or Hybrid)
      if (stage.bypass) {
        const bypassFlowId = sanitizeXmlId(`Flow_${splitId}_${joinId}_Skip`, 'Flow', flexFlowIds);
        if (stage.bypass.isDefault) {
          splitNode.defaultFlowId = bypassFlowId;
        }
        let waypoints;
        if (archDy !== null) {
          const archY = Math.round(centerY + archDy);
          waypoints = [
            { x: splitNode.x + 16, y: splitNode.y },
            { x: splitNode.x + 16, y: archY },
            { x: joinNode.x + 16, y: archY },
            { x: joinNode.x + 16, y: joinNode.y },
          ];
        } else {
          waypoints = [
            { x: splitNode.x + 32, y: centerY },
            { x: joinNode.x, y: centerY },
          ];
        }
        flexEdges.push({
          id: bypassFlowId,
          sourceRef: splitId,
          targetRef: joinId,
          name: stage.bypass.label || 'Skip',
          isDefault: stage.bypass.isDefault,
          feelCondition: stage.bypass.feelCondition,
          isBypass: true,
          variants: [...stage.bypass.variants],
          waypoints,
        });
      }

      flexNodes.push(joinNode);
      prevAnchor = { id: joinId, rightX: joinNode.x + joinNode.width, y: centerY };
      const nextIsVp = stageLayouts[i + 1]?.stage?.kind !== 'mandatory';
      curX = joinNode.x + joinNode.width + (nextIsVp ? 56 : 44);
    }
  }

  const endNode = {
    id: endId,
    type: 'endEvent',
    name: 'End',
    x: curX,
    y: centerY - 18,
    width: 36,
    height: 36,
    variants: [...allVariantCodes],
  };
  flexNodes.push(endNode);

  const finalFlowId = sanitizeXmlId(`Flow_${prevAnchor.id}_${endId}`, 'Flow', flexFlowIds);
  flexEdges.push({
    id: finalFlowId,
    sourceRef: prevAnchor.id,
    targetRef: endId,
    name: '',
    isDefault: false,
    feelCondition: null,
    variants: [...allVariantCodes],
    waypoints: [
      { x: prevAnchor.rightX, y: centerY },
      { x: endNode.x, y: centerY },
    ],
  });

  const flexWidth = Math.round(endNode.x + endNode.width + 48);

  const flexibleGraph = {
    processId: `Flexible${spec.pascalSlug}`,
    processName: `Unified Flexible ${spec.processName}`,
    fileName: `Flexible_${spec.slug}.bpmn`,
    documentation: `Unified flexible BPMN 2.0 model covering ${spec.variants.length} variants (${spec.variants.map((v) => `${v.code} ${v.name}`).join(', ')}). Set process variable variant to select a path via Camunda 8 FEEL expressions.`,
    width: flexWidth,
    height: flexHeight,
    centerY,
    nodes: flexNodes,
    edges: flexEdges,
  };

  // 2. Build Rigid Variant Graphs
  const rigidGraphs = spec.variants.map((variant) => {
    const usedIds = new Set();
    const usedFlows = new Set();
    const nodes = [];
    const edges = [];
    const rCenterY = 120;
    const rHeight = 240;

    let rx = 44;
    const rStartId = sanitizeXmlId('StartEvent', 'StartEvent', usedIds);
    const rStart = {
      id: rStartId,
      type: 'startEvent',
      name: 'Start',
      x: rx,
      y: rCenterY - 18,
      width: 36,
      height: 36,
    };
    nodes.push(rStart);
    rx += 36 + 40;

    let prev = rStart;
    for (let tIdx = 0; tIdx < variant.sequence.length; tIdx++) {
      const step = variant.sequence[tIdx];
      const tWidth = computeTaskWidth(step.activityName);
      const tId = sanitizeXmlId(step.activityId, `Task_${tIdx + 1}`, usedIds);
      const taskNode = {
        id: tId,
        type: 'task',
        name: step.activityName,
        x: rx,
        y: rCenterY - 30,
        width: tWidth,
        height: 60,
      };
      nodes.push(taskNode);

      const fId = sanitizeXmlId(`Flow_${prev.id}_${tId}`, 'Flow', usedFlows);
      edges.push({
        id: fId,
        sourceRef: prev.id,
        targetRef: tId,
        name: '',
        isDefault: false,
        feelCondition: null,
        waypoints: [
          { x: prev.x + prev.width, y: rCenterY },
          { x: taskNode.x, y: rCenterY },
        ],
      });

      prev = taskNode;
      rx += tWidth + 40;
    }

    const rEndId = sanitizeXmlId('EndEvent', 'EndEvent', usedIds);
    const rEnd = {
      id: rEndId,
      type: 'endEvent',
      name: 'End',
      x: rx,
      y: rCenterY - 18,
      width: 36,
      height: 36,
    };
    nodes.push(rEnd);

    const endFlowId = sanitizeXmlId(`Flow_${prev.id}_${rEndId}`, 'Flow', usedFlows);
    edges.push({
      id: endFlowId,
      sourceRef: prev.id,
      targetRef: rEndId,
      name: '',
      isDefault: false,
      feelCondition: null,
      waypoints: [
        { x: prev.x + prev.width, y: rCenterY },
        { x: rEnd.x, y: rCenterY },
      ],
    });

    const variantSlug = toFileSlug(variant.name, variant.code);
    return {
      variantCode: variant.code,
      variantName: variant.name,
      processId: `Rigid${spec.pascalSlug}${variant.code}`,
      processName: `${variant.code} - ${variant.name}`,
      fileName: `Rigid_${spec.slug}_${variant.code}_${variantSlug}.bpmn`,
      documentation: `${variant.code} ${variant.name} rigid model: ${variant.sequence.length} sequential activities.`,
      width: Math.round(rEnd.x + rEnd.width + 48),
      height: rHeight,
      centerY: rCenterY,
      nodes,
      edges,
    };
  });

  return { flexible: flexibleGraph, rigids: rigidGraphs };
}

/**
 * Executes the generated Unified Flexible BPMN graph for each variant code
 * and checks behavioral equivalence against the Rigid variant trace.
 */
export function verifyTraces(spec, flexibleGraph) {
  const nodeMap = new Map(flexibleGraph.nodes.map((n) => [n.id, n]));
  const outgoingMap = new Map();
  for (const edge of flexibleGraph.edges) {
    if (!outgoingMap.has(edge.sourceRef)) outgoingMap.set(edge.sourceRef, []);
    outgoingMap.get(edge.sourceRef).push(edge);
  }

  const startNode = flexibleGraph.nodes.find((n) => n.type === 'startEvent');

  return spec.variants.map((variant) => {
    const tracedActivities = [];
    const visitedNodeIds = [];
    const visitedEdgeIds = [];

    let current = startNode;
    let safety = 0;
    const maxSteps = flexibleGraph.nodes.length * 4 + 10;

    while (current && safety < maxSteps) {
      safety++;
      visitedNodeIds.push(current.id);
      if (current.type === 'task') {
        tracedActivities.push(current.name);
      }
      if (current.type === 'endEvent') {
        break;
      }

      const outgoing = outgoingMap.get(current.id) || [];
      if (outgoing.length === 0) break;

      let chosenEdge = null;
      if (outgoing.length === 1) {
        chosenEdge = outgoing[0];
      } else {
        // Diverging exclusiveGateway: evaluate FEEL conditions first, then fall back to default
        chosenEdge = outgoing.find(
          (e) => e.feelCondition && evaluateFeelVariantCondition(e.feelCondition, variant.code),
        );
        if (!chosenEdge && current.defaultFlowId) {
          chosenEdge = outgoing.find((e) => e.id === current.defaultFlowId);
        }
        if (!chosenEdge) {
          chosenEdge = outgoing.find((e) => e.isDefault) || outgoing[0];
        }
      }

      if (!chosenEdge) break;
      visitedEdgeIds.push(chosenEdge.id);
      current = nodeMap.get(chosenEdge.targetRef);
    }

    const expectedActivities = variant.sequence.map((s) => s.activityName);
    const match =
      tracedActivities.length === expectedActivities.length &&
      tracedActivities.every((name, idx) => name === expectedActivities[idx]);

    // Map choice labels per variation point for Table III
    const variationPointChoices = {};
    for (const stage of spec.stages) {
      if (stage.kind === 'mandatory') continue;
      const choiceId = variant.choices[stage.id];
      if (!choiceId || choiceId === 'SKIP') {
        variationPointChoices[stage.id] = 'Bypass';
      } else {
        const act = stage.activities.find((a) => a.id === choiceId);
        variationPointChoices[stage.id] = act ? act.name : choiceId;
      }
    }

    return {
      variantCode: variant.code,
      variantName: variant.name,
      expectedActivities,
      tracedActivities,
      taskCount: tracedActivities.length,
      match,
      variationPointChoices,
      visitedNodeIds,
      visitedEdgeIds,
    };
  });
}

export function generateBpmnXml(graph) {
  const lines = [];
  const defId = escapeXml(`Definitions_${graph.processId}`);
  const procId = escapeXml(graph.processId);
  const procName = escapeXml(graph.processName);

  lines.push(`<?xml version='1.0' encoding='UTF-8'?>`);
  lines.push(
    `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="${defId}" targetNamespace="http://bpmn.io/schema/bpmn" xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL http://www.omg.org/spec/BPMN/20100524/MODEL.xsd">`,
  );
  lines.push(`  <bpmn:process id="${procId}" name="${procName}" isExecutable="true">`);
  if (graph.documentation) {
    lines.push(`    <bpmn:documentation>${escapeXml(graph.documentation)}</bpmn:documentation>`);
  }

  for (const node of graph.nodes) {
    const id = escapeXml(node.id);
    const nameAttr = node.name ? ` name="${escapeXml(node.name)}"` : '';
    if (node.type === 'startEvent') {
      lines.push(`    <bpmn:startEvent id="${id}"${nameAttr} />`);
    } else if (node.type === 'endEvent') {
      lines.push(`    <bpmn:endEvent id="${id}"${nameAttr} />`);
    } else if (node.type === 'task') {
      lines.push(`    <bpmn:task id="${id}"${nameAttr} />`);
    } else if (node.type === 'exclusiveGateway') {
      const dirAttr = node.gatewayDirection ? ` gatewayDirection="${escapeXml(node.gatewayDirection)}"` : '';
      const defAttr = node.defaultFlowId ? ` default="${escapeXml(node.defaultFlowId)}"` : '';
      lines.push(`    <bpmn:exclusiveGateway id="${id}"${nameAttr}${dirAttr}${defAttr} />`);
    }
  }

  for (const edge of graph.edges) {
    const id = escapeXml(edge.id);
    const src = escapeXml(edge.sourceRef);
    const tgt = escapeXml(edge.targetRef);
    const nameAttr = edge.name ? ` name="${escapeXml(edge.name)}"` : '';
    if (edge.feelCondition) {
      lines.push(`    <bpmn:sequenceFlow id="${id}" sourceRef="${src}" targetRef="${tgt}"${nameAttr}>`);
      lines.push(`      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${escapeXml(edge.feelCondition)}</bpmn:conditionExpression>`);
      lines.push(`    </bpmn:sequenceFlow>`);
    } else {
      lines.push(`    <bpmn:sequenceFlow id="${id}" sourceRef="${src}" targetRef="${tgt}"${nameAttr} />`);
    }
  }

  lines.push(`  </bpmn:process>`);
  lines.push(`  <bpmndi:BPMNDiagram id="${escapeXml(`BPMNDiagram_${graph.processId}`)}">`);
  lines.push(`    <bpmndi:BPMNPlane id="${escapeXml(`BPMNPlane_${graph.processId}`)}" bpmnElement="${procId}">`);

  for (const node of graph.nodes) {
    const id = escapeXml(node.id);
    const diId = escapeXml(`${node.id}_di`);
    const markerAttr = node.type === 'exclusiveGateway' ? ` isMarkerVisible="true"` : '';
    lines.push(`      <bpmndi:BPMNShape id="${diId}" bpmnElement="${id}"${markerAttr}>`);
    lines.push(`        <dc:Bounds x="${Math.round(node.x)}" y="${Math.round(node.y)}" width="${Math.round(node.width)}" height="${Math.round(node.height)}" />`);
    lines.push(`      </bpmndi:BPMNShape>`);
  }

  for (const edge of graph.edges) {
    const id = escapeXml(edge.id);
    const diId = escapeXml(`${edge.id}_di`);
    lines.push(`      <bpmndi:BPMNEdge id="${diId}" bpmnElement="${id}">`);
    for (const wp of edge.waypoints) {
      lines.push(`        <di:waypoint x="${Math.round(wp.x)}" y="${Math.round(wp.y)}" />`);
    }
    lines.push(`      </bpmndi:BPMNEdge>`);
  }

  lines.push(`    </bpmndi:BPMNPlane>`);
  lines.push(`  </bpmndi:BPMNDiagram>`);
  lines.push(`</bpmn:definitions>`);
  return lines.join('\n');
}

export function generateComparisonMarkdown(spec, metrics, traces, graphs) {
  const md = [];
  const flexFile = graphs.flexible.fileName;

  md.push(`# ${spec.processName} — Comparison Analysis`);
  md.push('');
  md.push('## Overview');
  md.push('');
  md.push(
    `${spec.overview} This analysis compares **${metrics.variantCount} separate rigid process ${metrics.variantCount === 1 ? 'variant' : 'variants'}** against a **single unified flexible BPMN 2.0 model** (\`${flexFile}\`) constructed using **flexibility by selection** (labelled XOR gateways, Camunda 8 FEEL guard expressions, and bypass flows).`,
  );
  md.push('');
  md.push('> **Generated BPMN Models:**');
  for (const rg of graphs.rigids) {
    md.push(`> - \`${rg.fileName}\` — Variant ${rg.variantCode} (${rg.variantName})`);
  }
  md.push(`> - \`${flexFile}\` — Unified flexible model covering ${spec.variants.map((v) => v.code).join('–')}`);
  md.push('');
  md.push('---');
  md.push('');
  md.push('## 1. Variant Definitions');
  md.push('');
  md.push('| Variant | Name | Activity Sequence | # Tasks |');
  md.push('|---------|------|-------------------|---------|');
  for (const v of spec.variants) {
    const seq = v.sequence.map((s) => escapeMdCell(s.activityName)).join(' → ') || '*(No tasks)*';
    md.push(`| **${escapeMdCell(v.code)}** | ${escapeMdCell(v.name)} | ${seq} | ${v.sequence.length} |`);
  }
  md.push('');
  md.push(
    `**Total activity occurrences across ${metrics.variantCount} rigid ${metrics.variantCount === 1 ? 'model' : 'models'}:** \`${metrics.rigid.activityNodes}\` (\`${metrics.rigid.activityBreakdown}\`)`,
  );
  md.push('');
  md.push('---');
  md.push('');
  md.push('## 2. Activity Classification');
  md.push('');

  const mandatoryStages = spec.stages.filter((s) => s.kind === 'mandatory');
  const altHybridStages = spec.stages.filter((s) => s.kind === 'alternative' || s.kind === 'hybrid');
  const optionalStages = spec.stages.filter((s) => s.kind === 'optional');

  md.push(`### Shared (Mandatory) Activities (${mandatoryStages.length})`);
  if (mandatoryStages.length === 0) {
    md.push('No activities are shared identically across every variant.');
  } else {
    md.push('Present in every variant:');
    md.push('');
    md.push('| Activity | Variants |');
    md.push('|----------|----------|');
    for (const s of mandatoryStages) {
      const act = s.activities[0];
      md.push(`| ${escapeMdCell(act.name)} | ${escapeMdCell(act.variants.join(', '))} |`);
    }
  }
  md.push('');

  const altCount = altHybridStages.reduce((a, s) => a + s.activities.length, 0);
  md.push(`### Alternative & Hybrid Variation Points (${altCount} activities across ${altHybridStages.length} variation ${altHybridStages.length === 1 ? 'point' : 'points'})`);
  if (altHybridStages.length === 0) {
    md.push('No alternative variation points.');
  } else {
    md.push('Mutually exclusive tasks fulfilling the same stage in different ways:');
    md.push('');
    md.push('| Variation Point | Pattern Type | Branches & FEEL Conditions |');
    md.push('|-----------------|--------------|----------------------------|');
    for (const s of altHybridStages) {
      const pattern = s.kind === 'hybrid' ? `Alternative + Optional (${s.activities.length + 1}-way)` : `Alternative (${s.activities.length}-way)`;
      const parts = s.activities.map((a) =>
        a.isDefault
          ? `Default: \`${escapeMdCell(a.name)}\` *(${escapeMdCell(a.variants.join(', '))})*`
          : `Guarded: \`${escapeMdCell(a.name)}\` *(\`${escapeMdCell(a.feelCondition)}\`)*`,
      );
      if (s.bypass) {
        parts.push(
          s.bypass.isDefault
            ? `Default bypass: \`Skip\` *(${escapeMdCell(s.bypass.variants.join(', '))})*`
            : `Guarded bypass: \`Skip\` *(\`${escapeMdCell(s.bypass.feelCondition)}\`)*`,
        );
      }
      md.push(`| **${escapeMdCell(s.name)}** | ${pattern} | ${parts.join(' \\| ')} |`);
    }
  }
  md.push('');

  md.push(`### Optional Activities (${optionalStages.length})`);
  if (optionalStages.length === 0) {
    md.push('No pure single-activity optional variation points.');
  } else {
    md.push('Present in some variants and skipped via a direct bypass flow in others:');
    md.push('');
    md.push('| Variation Point | Default Branch | Guarded Branch (FEEL Condition) |');
    md.push('|-----------------|----------------|---------------------------------|');
    for (const s of optionalStages) {
      const act = s.activities[0];
      const defPart = s.bypass.isDefault
        ? `Skip (bypass) *(${escapeMdCell(s.bypass.variants.join(', '))})*`
        : `${escapeMdCell(act.name)} *(${escapeMdCell(act.variants.join(', '))})*`;
      const guardPart = s.bypass.isDefault
        ? `${escapeMdCell(act.name)} *(\`${escapeMdCell(act.feelCondition)}\`)*`
        : `Skip (bypass) *(\`${escapeMdCell(s.bypass.feelCondition)}\`)*`;
      md.push(`| **${escapeMdCell(s.name)}** | ${defPart} | ${guardPart} |`);
    }
  }
  md.push('');

  const termParts = [
    mandatoryStages.length,
    ...altHybridStages.map((s) => s.activities.length),
    ...optionalStages.map(() => 1),
  ];
  md.push(`**Total unique activities in the unified model:** \`${termParts.join(' + ')} = ${metrics.flexible.activityNodes}\``);
  md.push('');
  md.push('---');
  md.push('');
  md.push('## 3. Trace Verification');
  md.push('');
  md.push(
    `Tracing each \`variant\` value through \`${flexFile}\` reproduces the exact activity sequence of its corresponding rigid variant:`,
  );
  md.push('');

  const vpStages = spec.stages.filter((s) => s.kind !== 'mandatory');
  const vpHeaders = vpStages.map((s) => escapeMdCell(s.name));
  md.push(`| Variant | ${vpHeaders.length ? vpHeaders.join(' | ') + ' | ' : ''}Tasks | Match |`);
  md.push(`|---------|${vpHeaders.map(() => '---').join('|')}${vpHeaders.length ? '|' : ''}-------|-------|`);
  for (const t of traces) {
    const vpVals = vpStages.map((s) => escapeMdCell(t.variationPointChoices[s.id] || 'Bypass'));
    const rowCols = [
      `**${escapeMdCell(t.variantCode)}**`,
      ...vpVals,
      String(t.taskCount),
      t.match ? '✓' : '✗',
    ];
    md.push(`| ${rowCols.join(' | ')} |`);
  }
  md.push('');
  md.push('---');
  md.push('');
  md.push('## 4. Structural Comparison (Table IV Format)');
  md.push('');
  md.push(`| Metric | ${metrics.rigid.diagrams} Rigid | 1 Unified | Change |`);
  md.push('|--------|---------|-----------|--------|');
  md.push(`| Process diagrams | ${metrics.rigid.diagrams} | ${metrics.flexible.diagrams} | ${metrics.changes.diagrams} |`);
  md.push(`| Activity nodes | ${metrics.rigid.activityNodes} (${metrics.rigid.activityBreakdown}) | ${metrics.flexible.activityNodes} | ${metrics.changes.activityNodes} |`);
  md.push(`| Start and end events | ${metrics.rigid.events} | ${metrics.flexible.events} | ${metrics.changes.events} |`);
  md.push(`| XOR gateways | ${metrics.rigid.xorGateways} | ${metrics.flexible.xorGateways} | ${metrics.changes.xorGateways} |`);
  md.push(`| Total nodes | ${metrics.rigid.totalNodes} | ${metrics.flexible.totalNodes} | ${metrics.changes.totalNodes} |`);
  md.push(`| Sequence flows | ${metrics.rigid.sequenceFlows} | ${metrics.flexible.sequenceFlows} | ${metrics.changes.sequenceFlows} |`);
  md.push('');
  md.push('### Breakdown of Counts');
  md.push(`- **Rigid baseline (${metrics.rigid.diagrams} ${metrics.rigid.diagrams === 1 ? 'variant' : 'variants'}):**`);
  md.push(`  - Events: \`2 × ${metrics.rigid.diagrams} = ${metrics.rigid.events}\` (1 start + 1 end per diagram)`);
  md.push(`  - Activities: \`${metrics.rigid.activityBreakdown} = ${metrics.rigid.activityNodes}\``);
  md.push(`  - Total nodes: \`${metrics.rigid.activityNodes} + ${metrics.rigid.events} = ${metrics.rigid.totalNodes}\``);
  md.push(`  - Sequence flows: \`${metrics.rigid.sequenceFlowBreakdown} = ${metrics.rigid.sequenceFlows}\` (each rigid model has \`tasks + 1\` flows)`);
  md.push(`- **Unified flexible model (\`${flexFile}\`):**`);
  md.push(`  - Events: \`2\` (1 start + 1 end)`);
  const allUniqueNames = spec.stages.flatMap((s) => s.activities.map((a) => `\`${a.name}\``));
  md.push(`  - Activities: \`${metrics.flexible.activityNodes}\` (${allUniqueNames.join(', ')})`);
  md.push(`  - XOR gateways: \`${metrics.flexible.xorGateways}\` (${metrics.variationPointCount} split/join ${metrics.variationPointCount === 1 ? 'pair' : 'pairs'})`);
  md.push(`  - Total nodes: \`2 + ${metrics.flexible.activityNodes} + ${metrics.flexible.xorGateways} = ${metrics.flexible.totalNodes}\``);
  md.push(`  - Sequence flows: \`${metrics.flexible.sequenceFlows}\``);
  md.push('');
  md.push('---');
  md.push('');
  md.push('## 5. Summary of Findings');
  md.push('');
  const savedActivities = metrics.rigid.activityNodes - metrics.flexible.activityNodes;
  md.push(
    `- **Activity node comparison (${metrics.changes.activityNodes}):** ${savedActivities >= 0 ? `Eliminates ${savedActivities} of ${metrics.rigid.activityNodes} duplicated activity occurrences` : `Uses ${metrics.flexible.activityNodes} unique activities`} across ${metrics.rigid.diagrams} variants while defining shared tasks in a single place.`,
  );
  const nodeDelta = metrics.flexible.totalNodes - metrics.rigid.totalNodes;
  md.push(
    `- **Total node change (${metrics.changes.totalNodes}):** Total BPMN nodes move from \`${metrics.rigid.totalNodes}\` to \`${metrics.flexible.totalNodes}\` (${nodeDelta >= 0 ? `+${nodeDelta}` : nodeDelta} nodes) including \`${metrics.flexible.xorGateways}\` XOR gateways.`,
  );
  md.push(
    `- **Sequence flow trade-off (${metrics.changes.sequenceFlows}):** Connections change from \`${metrics.rigid.sequenceFlows}\` to \`${metrics.flexible.sequenceFlows}\`.`,
  );
  const matchedCount = traces.filter((t) => t.match).length;
  md.push(
    `- **Behavioral equivalence:** ${matchedCount}/${traces.length} variants verify identically against their rigid baselines via FEEL guard conditions on the \`variant\` variable.`,
  );

  return md.join('\n');
}

export function analyzeProcess(rawSpec) {
  const spec = normalizeProcessSpec(rawSpec);
  const metrics = computeMetrics(spec);
  const graphs = buildDiagramGraphs(spec);
  const traces = verifyTraces(spec, graphs.flexible);

  const flexibleBpmnXml = generateBpmnXml(graphs.flexible);
  const rigidBpmnFiles = graphs.rigids.map((rg) => ({
    variantCode: rg.variantCode,
    variantName: rg.variantName,
    fileName: rg.fileName,
    xml: generateBpmnXml(rg),
  }));

  const comparisonMd = generateComparisonMarkdown(spec, metrics, traces, graphs);

  return {
    spec,
    metrics,
    traces,
    graphs,
    files: {
      comparisonMd,
      comparisonFileName: 'Comparison_Analysis.md',
      flexibleBpmn: {
        fileName: graphs.flexible.fileName,
        xml: flexibleBpmnXml,
      },
      rigidBpmns: rigidBpmnFiles,
    },
  };
}
