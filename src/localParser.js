// Deterministic local parser that converts natural-language process descriptions,
// bracketed stage flows, or explicit variant trace lines into a normalized-ready ProcessSpec.
// Used when running in Local Mode (or when no Gemini API key is configured).

import { toPascalSlug } from './engine.js';

function cleanExplicitTaskName(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/[.;:]+$/, '')
    .trim();
}

function cleanPhrase(raw) {
  return String(raw || '')
    .replace(/^[-*•\d.)\s]+/, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(
      /^(?:in\s+(?:a|an|the|our)\s+[^,]+?(?:process|workflow)\s*,?\s*)/i,
      '',
    )
    .replace(/^(?:for\s+[a-z\s]{2,20},\s*)/i, '')
    .replace(
      /^(?:(?:every|each)\s+\w+\s+)?(?:starts?|begins?)\s+(?:with|by)\s+/i,
      '',
    )
    .replace(
      /^(?:(?:fulfilled|approved|completed|incoming|new)\s+\w+\s+(?:go\s+through|proceed\s+(?:to|with|via)|use|follow)\s+)/i,
      '',
    )
    .replace(
      /^(?:first|then|next|finally|lastly|also|optionally|either|instead|alternatively|otherwise)\b[\s,:]*/i,
      '',
    )
    .replace(
      /^(?:we|they|it|the\s+system|staff|customers?|users?|corporate\s+accounts?|team|engineers?|agents?)\s+(?:can\s+|will\s+|may\s+|also\s+|either\s+|use\s+)*(?:also\s+|either\s+|use\s+)?/i,
      '',
    )
    .replace(/\s+(?:at\s+the\s+end|in\s+the\s+end|if\s+needed|if\s+applicable)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.;:,]+$/, '')
    .trim();
}

function toTitleCase(phrase) {
  const minor = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'by', 'with', 'via']);
  return phrase
    .split(/\s+/)
    .filter(Boolean)
    .map((word, idx) => {
      if (/^[A-Z0-9&]{2,}$/.test(word) || word.startsWith('(')) return word;
      if (word.includes('-')) {
        return word
          .split('-')
          .map((sub, sIdx) => {
            if (!sub) return sub;
            const lower = sub.toLowerCase();
            if (sIdx === 0 && idx > 0 && minor.has(lower)) return lower;
            return lower.charAt(0).toUpperCase() + lower.slice(1);
          })
          .join('-');
      }
      const lower = word.toLowerCase();
      if (idx > 0 && minor.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function shortenActivityName(phrase) {
  let prev = '';
  let cleaned = String(phrase || '').trim();
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleanPhrase(cleaned);
  }
  if (!cleaned) return '';
  const words = cleaned.split(/\s+/).filter(Boolean);
  const sliced = words.slice(0, 6).join(' ');
  return toTitleCase(sliced);
}

function wordSimilarity(nameA, nameB) {
  const wordsA = new Set(String(nameA || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2));
  const wordsB = new Set(String(nameB || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) shared++;
  }
  return shared / Math.max(wordsA.size, wordsB.size);
}

/**
 * Aligns multiple linear variant task sequences into ordered stages, merging
 * common tasks into shared stages and diverging positions into alternative/optional stages.
 */
export function alignVariantSequencesToStages(variantDefs) {
  // Build ordered backbone of slots starting from the longest variant
  const sortedByLen = [...variantDefs].sort((a, b) => b.tasks.length - a.tasks.length);
  const baseVariant = sortedByLen[0];
  const slots = baseVariant.tasks.map((t) => ({
    anchorKey: t.toLowerCase(),
    tasksByVariant: new Map([[baseVariant.code, t]]),
  }));

  // Align every other variant against current slot list using DP
  for (const variant of variantDefs) {
    if (variant.code === baseVariant.code) continue;
    const seq = variant.tasks;
    const m = seq.length;
    const n = slots.length;

    const slotTasks = slots.map((sl) => [...new Set(sl.tasksByVariant.values())]);
    const slotKeys = slotTasks.map((list) => new Set(list.map((v) => v.toLowerCase())));

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(-1e9));
    const bt = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    dp[0][0] = 0;

    for (let i = 0; i <= m; i++) {
      for (let j = 0; j <= n; j++) {
        if (i < m && j < n) {
          const isExact = slotKeys[j].has(seq[i].toLowerCase());
          let subScore;
          if (isExact) {
            subScore = 10;
          } else {
            const maxSim = Math.max(...slotTasks[j].map((t) => wordSimilarity(seq[i], t)), 0);
            const posPenalty = 0.02 * Math.abs(i - j);
            subScore = 3 + 2 * maxSim - posPenalty;
          }
          if (dp[i][j] + subScore > dp[i + 1][j + 1]) {
            dp[i + 1][j + 1] = dp[i][j] + subScore;
            bt[i + 1][j + 1] = 1; // diag
          }
        }
        if (i < m) {
          // Insert extra task slot (-1)
          if (dp[i][j] - 1 > dp[i + 1][j]) {
            dp[i + 1][j] = dp[i][j] - 1;
            bt[i + 1][j] = 2; // up (consume seq[i], new slot)
          }
        }
        if (j < n) {
          // Skip existing slot (bypass, -0.5)
          if (dp[i][j] - 0.5 > dp[i][j + 1]) {
            dp[i][j + 1] = dp[i][j] - 0.5;
            bt[i][j + 1] = 3; // left (skip slot j)
          }
        }
      }
    }

    // Backtrack
    const operations = [];
    let ci = m;
    let cj = n;
    while (ci > 0 || cj > 0) {
      const move = bt[ci][cj];
      if (move === 1) {
        operations.push({ type: 'assign', slotIdx: cj - 1, task: seq[ci - 1] });
        ci--;
        cj--;
      } else if (move === 2) {
        operations.push({ type: 'insertAfter', slotIdx: cj - 1, task: seq[ci - 1] });
        ci--;
      } else {
        operations.push({ type: 'skip', slotIdx: cj - 1 });
        cj--;
      }
    }
    operations.reverse();

    // Apply operations (handle insertions in reverse slot index order so indices stay valid)
    const insertions = [];
    for (const op of operations) {
      if (op.type === 'assign') {
        slots[op.slotIdx].tasksByVariant.set(variant.code, op.task);
      } else if (op.type === 'insertAfter') {
        insertions.push({ afterIdx: op.slotIdx, task: op.task });
      }
    }
    // Insert new slots carefully
    for (let k = insertions.length - 1; k >= 0; k--) {
      const ins = insertions[k];
      const newSlot = {
        anchorKey: ins.task.toLowerCase(),
        tasksByVariant: new Map([[variant.code, ins.task]]),
      };
      slots.splice(ins.afterIdx + 1, 0, newSlot);
    }
  }

  // Convert aligned slots into ProcessSpec stages & variants
  const stages = slots.map((slot, idx) => {
    const uniqueTasks = new Map();
    for (const [, taskName] of slot.tasksByVariant.entries()) {
      const key = taskName.toLowerCase();
      if (!uniqueTasks.has(key)) {
        uniqueTasks.set(key, {
          id: toPascalSlug(taskName, `Task_${idx + 1}`),
          name: taskName,
        });
      }
    }
    const activities = [...uniqueTasks.values()];
    const stageName =
      activities.length === 1
        ? slot.tasksByVariant.size < variantDefs.length
          ? `${activities[0].name}?`
          : activities[0].name
        : `Stage ${idx + 1}: ${activities[0].name.split(' ')[0]} Mode`;

    return {
      id: `Stage_${idx + 1}`,
      name: stageName,
      activities,
      _tasksByVariant: slot.tasksByVariant,
    };
  });

  const variants = variantDefs.map((v) => {
    const choices = {};
    for (const st of stages) {
      const chosenName = st._tasksByVariant.get(v.code);
      if (!chosenName) {
        choices[st.id] = 'SKIP';
      } else {
        const matched = st.activities.find((a) => a.name.toLowerCase() === chosenName.toLowerCase());
        choices[st.id] = matched ? matched.id : chosenName;
      }
    }
    return {
      code: v.code,
      name: v.name,
      choices,
    };
  });

  return {
    stages: stages.map(({ _tasksByVariant, ...rest }) => rest),
    variants,
  };
}

function tryParseExplicitVariants(prompt) {
  const lines = prompt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const variantLines = [];
  const nonVariantLines = [];
  let processName = null;
  let overviewHint = null;

  for (const line of lines) {
    const vMatch = line.match(
      /^(?:[-*]\s*)?(?:Variant\s+|Version\s+)?(V\d+)\s*(?:\(([^)]+)\)|[-:]\s*([^:]+))?\s*[:\-–]\s*(.+)$/i,
    );
    if (vMatch && (line.includes('->') || line.includes('→') || line.includes(','))) {
      const code = vMatch[1].toUpperCase();
      const name = (vMatch[2] || vMatch[3] || `Variant ${code}`).trim();
      const rhs = vMatch[4].trim();
      const tasks = rhs
        .split(/\s*(?:->|→|>|,|;)\s*/)
        .map((t) => cleanExplicitTaskName(t))
        .filter(Boolean);
      if (tasks.length >= 1) {
        variantLines.push({ code, name, tasks });
        continue;
      }
    }

    if (/^(?:versions?|variants?)(?:\s*(?:\/|&|and)\s*(?:versions?|variants?))?\s*(?:details?)?\s*:?$/i.test(line)) {
      continue;
    }

    if (!processName && !/^stages?\s*:/i.test(line)) {
      const titleMatch = line.match(/^(?:process(?:\s+name)?|title|domain)\s*[:\-]\s*(.+)$/i);
      if (titleMatch) {
        processName = titleMatch[1].trim();
      } else if (line.length <= 80 && !line.includes('->') && !line.includes('→')) {
        processName = line.replace(/^#+\s*/, '').trim();
      } else {
        nonVariantLines.push(line);
      }
    } else if (/^stages?\s*:/i.test(line)) {
      overviewHint = line;
    }
  }

  if (variantLines.length < 2) return null;

  if (!processName && nonVariantLines.length > 0) {
    const firstProse = nonVariantLines[0];
    const domainMatch = firstProse.match(
      /(?:process(?:\s+for|\s+of|\s+name)?|workflow(?:\s+for|\s+of)?|in\s+(?:a|an|the|our))\s+([A-Za-z0-9\s&-]{3,45}?)(?:\s+process|\s+workflow|,|\.|:)/i,
    );
    if (domainMatch) {
      processName = `${toTitleCase(domainMatch[1].trim())} Process`.replace(/\bProcess Process\b/i, 'Process');
    } else {
      const firstWords = firstProse.split(/[,.:;]/)[0].trim().split(/\s+/).slice(0, 5).join(' ');
      if (firstWords) processName = toTitleCase(firstWords);
    }
  }

  const { stages, variants } = alignVariantSequencesToStages(variantLines);
  const name = processName || 'Custom Business Process';
  return {
    processName: name,
    overview: overviewHint
      ? `${name} (${overviewHint.replace(/^stages?\s*:\s*/i, '')}).`
      : `Flexible vs. rigid analysis of the ${name} across ${variants.length} operational variants.`,
    stages,
    variants,
  };
}

function tryParseBracketedArrowFlow(prompt) {
  if (!prompt.includes('->') && !prompt.includes('→')) return null;

  const lines = prompt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let processName = 'Custom Business Process';
  let flowLine = prompt;

  if (lines.length >= 2 && !lines[0].includes('->') && !lines[0].includes('→')) {
    processName = lines[0].replace(/^(process|title)\s*:\s*/i, '').trim() || processName;
    flowLine = lines.slice(1).join(' ');
  } else if (lines[0].includes(':')) {
    const colonIdx = lines[0].indexOf(':');
    const prefix = lines[0].slice(0, colonIdx).trim();
    if (prefix.length <= 50 && !prefix.includes('[')) {
      processName = prefix;
      flowLine = lines[0].slice(colonIdx + 1).trim() + (lines.length > 1 ? ' ' + lines.slice(1).join(' ') : '');
    }
  }

  const tokens = flowLine
    .split(/\s*(?:->|→)\s*/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length < 2) return null;

  const stages = tokens
    .map((tok, idx) => {
      const isOptional =
        /\boptional\b/i.test(tok) ||
        /\?\s*$/.test(tok.replace(/^\[|\]$/g, '').trim());
      let cleanedTok = tok
        .replace(/\(\s*optional\s*\)/gi, '')
        .replace(/\[\s*optional\s*\]/gi, '')
        .replace(/^\(\s*optional\s*:\s*([^)]+)\)\s*$/i, '$1')
        .replace(/^optional\s*:\s*/gi, '')
        .replace(/\?+$/, '')
        .trim();
      if (cleanedTok.startsWith('(') && cleanedTok.endsWith(')')) {
        cleanedTok = cleanedTok.slice(1, -1).trim();
      }
      const bracketed = cleanedTok.replace(/^\[|\]$/g, '');
      const parts = bracketed
        .split(/\s*(?:\||\/|\bor\b)\s*/i)
        .map((p) => shortenActivityName(p))
        .filter(Boolean);

      if (parts.length === 0) return null;

      const activities = parts.map((name, aIdx) => ({
        id: toPascalSlug(name, `Task_${idx + 1}_${aIdx + 1}`),
        name,
      }));

      return {
        id: `Stage_${idx + 1}`,
        name:
          activities.length > 1
            ? `Stage ${idx + 1} Choice`
            : isOptional
            ? `${activities[0].name}?`
            : activities[0].name,
        isOptional,
        activities,
      };
    })
    .filter(Boolean);

  if (stages.length === 0) return null;

  const variants = buildCoveringVariantsFromStages(stages);
  return {
    processName,
    overview: `Unified flexible vs. rigid BPMN comparison for ${processName}.`,
    stages: stages.map(({ isOptional, ...rest }) => rest),
    variants,
  };
}

function buildCoveringVariantsFromStages(stages) {
  // V1: standard path (first activity of every non-optional stage; includes first activity of first optional if needed)
  // Additional variants: exercise every alternative branch & optional skip/include!
  const v1Choices = {};
  stages.forEach((st) => {
    v1Choices[st.id] = st.isOptional ? st.activities[0].id : st.activities[0].id;
  });

  const variants = [
    {
      code: 'V1',
      name: 'Standard Path',
      choices: { ...v1Choices },
    },
  ];

  // Collect variations needed so every branch and optional skip is covered
  let nextIdx = 2;
  const uncoveredSteps = [];

  for (const st of stages) {
    if (st.activities.length > 1) {
      for (let i = 1; i < st.activities.length; i++) {
        uncoveredSteps.push({ stageId: st.id, choice: st.activities[i].id, label: st.activities[i].name });
      }
    }
    if (st.isOptional) {
      uncoveredSteps.push({ stageId: st.id, choice: 'SKIP', label: `Skip ${st.activities[0].name}` });
    }
  }

  // If no variation exists at all, synthesize a meaningful fast-track / exception variant?
  // No — keep exact stages if user supplied a purely mandatory pipeline, or pack uncovered steps cleanly!
  if (uncoveredSteps.length > 0) {
    // Variant V2: flip all optional skips + last alternative where helpful (Fast-Track)
    const fastChoices = { ...v1Choices };
    let fastDescParts = [];
    for (const st of stages) {
      if (st.isOptional) {
        fastChoices[st.id] = 'SKIP';
        fastDescParts.push(`Skip ${st.activities[0].name}`);
      } else if (st.activities.length > 1) {
        const last = st.activities[st.activities.length - 1];
        fastChoices[st.id] = last.id;
        fastDescParts.push(last.name);
      }
    }
    variants.push({
      code: `V${nextIdx++}`,
      name: 'Alternative / Fast-Track',
      choices: fastChoices,
    });

    // Ensure any remaining uncovered branches get dedicated variants
    for (const step of uncoveredSteps) {
      const alreadyCovered = variants.some((v) => v.choices[step.stageId] === step.choice);
      if (!alreadyCovered) {
        const customChoices = { ...v1Choices, [step.stageId]: step.choice };
        variants.push({
          code: `V${nextIdx++}`,
          name: `${step.label} Variant`,
          choices: customChoices,
        });
      }
    }
  }

  return variants;
}

function parseFreeformProse(prompt) {
  const normalized = prompt.replace(/\s+/g, ' ').trim();

  // Extract process name if hinted
  let processName = 'Business Process';
  let bodyText = normalized;
  const colonHeaderMatch = normalized.match(/^([A-Za-z0-9\s&-]{3,40}?):\s+(.+)$/);
  if (colonHeaderMatch && !/^(stages?|variants?|overview)$/i.test(colonHeaderMatch[1].trim())) {
    processName = toTitleCase(colonHeaderMatch[1].trim());
    bodyText = colonHeaderMatch[2].trim();
  } else {
    const nameMatch = normalized.match(
      /(?:process(?:\s+for|\s+of|\s+name)?|workflow(?:\s+for|\s+of)?|in\s+(?:a|an|the|our))\s+([A-Za-z0-9\s&-]{3,45}?)(?:\s+process|\s+workflow|,|\.|:)/i,
    );
    if (nameMatch) {
      processName = `${toTitleCase(nameMatch[1].trim())} Process`.replace(/\bProcess Process\b/i, 'Process');
    } else {
      const firstWords = normalized.split(/[,.:;]/)[0].trim().split(/\s+/).slice(0, 4).join(' ');
      if (firstWords) processName = toTitleCase(firstWords);
    }
  }

  // Split into sentence-level or sequential clauses
  const clauses = bodyText
    .split(/(?:[.!?;]|\b(?:then|next|afterwards?|finally|followed by)\b)/i)
    .map((c) => c.trim())
    .filter((c) => c.length >= 3);

  const stages = [];

  for (let clause of clauses) {
    // Skip meta-intro phrases with no action
    if (/^(stages?|variants?|this process|overview)\s*[:]/i.test(clause)) continue;

    // Strip leading domain intro clause before splitting commas
    clause = clause
      .replace(/^in\s+(?:a|an|the|our)\s+[^,]+?(?:process|workflow)\s*,\s*/i, '')
      .replace(/^for\s+[a-z\s]{2,20},\s*/i, '')
      .trim();

    if (!clause) continue;

    // Handle exception/replacement clauses like "Pack Order, except cancelled orders which skip packing and instead Cancel & Refund Order"
    const exceptMatch = clause.match(/(.+?),\s*except\b.+?\binstead\s+(.+)/i);
    if (exceptMatch) {
      const mainAct = shortenActivityName(exceptMatch[1]);
      const altAct = shortenActivityName(exceptMatch[2]);
      if (mainAct && altAct && mainAct !== altAct) {
        const idx = stages.length + 1;
        stages.push({
          id: `Stage_${idx}`,
          name: `Stage ${idx} Decision`,
          isOptional: false,
          activities: [
            { id: toPascalSlug(mainAct, `Task_${idx}_1`), name: mainAct },
            { id: toPascalSlug(altAct, `Task_${idx}_2`), name: altAct },
          ],
        });
        continue;
      }
    }

    const wholeClauseOptional = /^\s*(?:optionally|if\s+needed|if\s+applicable|sometimes)\b/i.test(clause);
    const hasOxfordOr = /,\s*(?:or|while|whereas)\s+/i.test(clause);
    const subClauses =
      !hasOxfordOr && clause.includes(',')
        ? clause
            .split(/\s*,\s*(?:and\s+)?/i)
            .map((c) => c.trim())
            .filter(Boolean)
        : [clause];

    for (const subClause of subClauses) {
      const isOptionalSub =
        wholeClauseOptional ||
        /\b(optional(?:ly)?|if\s+needed|if\s+applicable|may\s+also|sometimes)\b/i.test(subClause);

      // Check for alternatives inside sub-clause (`either X or Y`, `X while Y`, `X vs Y`, `X or Y`)
      const altMatch = subClause.match(
        /(.+?)\s+(?:\bwhile\b|\bwhereas\b|\balternatively\b|\bversus\b|\bvs\.?\b|\bor\b)\s+(.+)/i,
      );
      if (altMatch && !isOptionalSub) {
        const leftRaw = altMatch[1].replace(/,\s*$/, '').trim();
        const leftPart = shortenActivityName(leftRaw);
        // Support 3-way Oxford-comma + or splits like "A, B, or C"
        const leftCommas =
          hasOxfordOr && leftRaw.includes(',')
            ? leftRaw.split(/\s*,\s*/).map((s) => shortenActivityName(s)).filter((s) => s.length >= 3)
            : [leftPart].filter(Boolean);
        const rightPart = shortenActivityName(altMatch[2]);
        const branches = [...new Set([...leftCommas, rightPart])].filter(Boolean);

        if (branches.length >= 2) {
          const idx = stages.length + 1;
          stages.push({
            id: `Stage_${idx}`,
            name: `Stage ${idx} Mode`,
            isOptional: /\bexcept\b|\bskip\b/i.test(subClause),
            activities: branches.map((b, bi) => ({
              id: toPascalSlug(b, `Task_${idx}_${bi + 1}`),
              name: b,
            })),
          });
          continue;
        }
      }

      // Split `and`-joined sequential tasks inside a single sub-clause
      const subSteps = subClause
        .split(/\s+\band\b(?=\s+(?:then\s+)?[A-Za-z]+)\s*/i)
        .map((s) => shortenActivityName(s))
        .filter((s) => s.length >= 3 && s !== 'Process Step');

      for (const stepName of subSteps) {
        const idx = stages.length + 1;
        stages.push({
          id: `Stage_${idx}`,
          name: isOptionalSub ? `${stepName}?` : stepName,
          isOptional: isOptionalSub,
          activities: [
            {
              id: toPascalSlug(stepName, `Task_${idx}`),
              name: stepName,
            },
          ],
        });
      }
    }
  }

  // Fallback if prompt was only a short topic title (0 or 1 stage extracted)
  if (stages.length === 0 || (stages.length === 1 && normalized.split(/\s+/).length <= 6)) {
    stages.length = 0;
    const topic = shortenActivityName(normalized).replace(/\s+Process$/i, '');
    stages.push(
      {
        id: 'Stage_1',
        name: 'Intake',
        isOptional: false,
        activities: [{ id: 'ReceiveRequest', name: `Receive ${topic} Request` }],
      },
      {
        id: 'Stage_2',
        name: 'Review Mode',
        isOptional: false,
        activities: [
          { id: 'ManualReview', name: 'Manual Review' },
          { id: 'AutomatedCheck', name: 'Automated Check' },
        ],
      },
      {
        id: 'Stage_3',
        name: 'Decision',
        isOptional: false,
        activities: [
          { id: 'ApproveRequest', name: `Approve ${topic}` },
          { id: 'RejectRequest', name: `Reject ${topic}` },
        ],
      },
      {
        id: 'Stage_4',
        name: 'Archive?',
        isOptional: true,
        activities: [{ id: 'ArchiveRecord', name: 'Archive Record' }],
      },
    );
  } else if (stages.every((s) => !s.isOptional && s.activities.length === 1) && stages.length >= 2) {
    // If prose had purely linear tasks with no branching keywords, create a realistic optional tail
    // or standard vs expedited variant ONLY if >= 3 tasks (make last step optional in V2)
    if (stages.length >= 3) {
      stages[stages.length - 1].isOptional = true;
      stages[stages.length - 1].name = `${stages[stages.length - 1].activities[0].name}?`;
    }
  }

  const variants = buildCoveringVariantsFromStages(stages);
  return {
    processName,
    overview: `Process model extracted locally from natural language prompt: "${normalized.slice(0, 140)}${normalized.length > 140 ? '...' : ''}".`,
    stages: stages.map(({ isOptional, ...rest }) => rest),
    variants,
  };
}

export function parsePromptLocally(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Prompt cannot be empty.');
  }

  const explicit = tryParseExplicitVariants(prompt);
  if (explicit) return explicit;

  const arrow = tryParseBracketedArrowFlow(prompt);
  if (arrow) return arrow;

  return parseFreeformProse(prompt);
}
