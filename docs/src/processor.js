function buildMessages(source, knownFingerprints) {
  const systemPrompt = [
    '你是一个严谨的 AI 产品情报编辑。',
    source.extractStrategy === 'latest-release'
      ? '请从给定的网页 Markdown 中仅提炼页面里最新一次发布或更新。'
      : '请从给定的网页 Markdown 中提炼值得关注的 AI 产品。',
    '剔除广告、招聘、重复内容、纯新闻稿、明显过时的信息。',
    '输出必须是 JSON 对象，且不要附加 Markdown 代码块。',
    'JSON 顶层字段固定为 items。',
    'items 中每个对象字段固定为: name, summary, highlight, publishedAt。',
    'summary 必须是 20 个汉字以内的核心功能描述。',
    'highlight 是一句话推荐理由。',
    'publishedAt 填官方发布时间；如果页面里没有明确时间，返回空字符串。',
    source.extractStrategy === 'latest-release'
      ? '只返回 1 条最新更新，不要把历史多天的更新一起返回。'
      : '如果没有合适内容，返回 {"items":[]}。',
    '如果没有合适内容，返回 {"items":[]}。'
  ].join(' ');

  const userPrompt = [
    `来源名称: ${source.name}`,
    `来源链接: ${source.sourceUrl}`,
    source.entryUrl && source.entryUrl !== source.sourceUrl ? `最新条目直达链接: ${source.entryUrl}` : null,
    source.officialPublishedAt ? `已从页面规则提取到官方发布时间: ${source.officialPublishedAt}` : null,
    knownFingerprints.length > 0
      ? `以下产品已在历史记录中出现过，请尽量避免重复: ${knownFingerprints.join(' ; ')}`
      : '当前没有历史产品记录。',
    '以下是网页 Markdown 内容，请仅基于内容输出 JSON 对象:',
    source.content
  ].filter(Boolean).join('\n\n');

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}

function extractJsonPayload(text) {
  const trimmed = text.trim();

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return trimmed;
  }

  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeFenceMatch) {
    return codeFenceMatch[1].trim();
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  throw new Error('Failed to extract JSON payload from LLM response');
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function repairJsonText(text) {
  return text
    .trim()
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .replace(/[\u0000-\u0019]+/g, ' ')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/}\s*{/g, '},{')
    .replace(/]\s*\[/g, '],[')
    .trim();
}

function findMatchingBracket(text, startIndex, openChar, closeChar) {
  let depth = 0;
  let inString = false;
  let isEscaping = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (isEscaping) {
        isEscaping = false;
        continue;
      }

      if (char === '\\') {
        isEscaping = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function extractItemsArrayText(text) {
  const trimmed = text.trim();

  if (trimmed.startsWith('[')) {
    const arrayEnd = findMatchingBracket(trimmed, 0, '[', ']');
    return arrayEnd === -1 ? trimmed : trimmed.slice(0, arrayEnd + 1);
  }

  const itemsKeyIndex = trimmed.indexOf('"items"');
  if (itemsKeyIndex === -1) {
    return null;
  }

  const arrayStart = trimmed.indexOf('[', itemsKeyIndex);
  if (arrayStart === -1) {
    return null;
  }

  const arrayEnd = findMatchingBracket(trimmed, arrayStart, '[', ']');
  return arrayEnd === -1 ? trimmed.slice(arrayStart) : trimmed.slice(arrayStart, arrayEnd + 1);
}

function extractObjectSnippets(arrayText) {
  const snippets = [];
  let depth = 0;
  let inString = false;
  let isEscaping = false;
  let objectStart = -1;

  for (let index = 0; index < arrayText.length; index += 1) {
    const char = arrayText[index];

    if (inString) {
      if (isEscaping) {
        isEscaping = false;
        continue;
      }

      if (char === '\\') {
        isEscaping = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        objectStart = index;
      }

      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;

      if (depth === 0 && objectStart !== -1) {
        snippets.push(arrayText.slice(objectStart, index + 1));
        objectStart = -1;
      }
    }
  }

  return snippets;
}

function salvageItemsFromText(text) {
  const arrayText = extractItemsArrayText(text);

  if (!arrayText) {
    return null;
  }

  const snippets = extractObjectSnippets(arrayText);
  if (!snippets.length) {
    return null;
  }

  const items = snippets
    .map((snippet) => tryParseJson(repairJsonText(snippet)))
    .filter((item) => item && typeof item === 'object');

  if (!items.length) {
    return null;
  }

  return { items };
}

function parseLlmResponse(messageContent) {
  const candidates = [messageContent];

  try {
    candidates.push(extractJsonPayload(messageContent));
  } catch {
    // Ignore extraction failures here and continue with raw content.
  }

  for (const candidate of candidates) {
    const directParsed = tryParseJson(candidate);
    if (directParsed) {
      return directParsed;
    }

    const repairedParsed = tryParseJson(repairJsonText(candidate));
    if (repairedParsed) {
      return repairedParsed;
    }

    const salvagedParsed = salvageItemsFromText(candidate);
    if (salvagedParsed) {
      return salvagedParsed;
    }
  }

  throw new Error('Failed to parse structured JSON from LLM response');
}

function sanitizeItems(items, source) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      name: String(item.name || '').trim(),
      summary: String(item.summary || '').trim(),
      highlight: String(item.highlight || '').trim(),
      publishedAt: String(item.publishedAt || source.officialPublishedAt || '').trim(),
      sourceUrl: source.entryUrl || source.sourceUrl
    }))
    .filter((item) => item.name && item.summary && item.highlight);
}

function applySourceStrategy(items, source) {
  if (source.extractStrategy === 'latest-release') {
    return items.slice(0, 1);
  }

  return items;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCandidateModels(config) {
  return [config.llmModel, ...(config.llmModelFallbacks || [])].filter(Boolean);
}

function isOpenRouterFreeRouter(model) {
  return model === 'openrouter/free';
}

function isRetryableError(error, model) {
  if (error.status === 429 || error.status >= 500) {
    return true;
  }

  if (!isOpenRouterFreeRouter(model)) {
    return false;
  }

  if (error.status === 404 && error.message.includes('Provider returned error')) {
    return true;
  }

  if (error.status === 502 || error.status === 503 || error.status === 504) {
    return true;
  }

  return false;
}

function getRetryDelayMs(attempt) {
  return 1000 * attempt;
}

async function requestCompletion(messages, model, config) {
  const response = await fetch(`${config.llmBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.llmApiKey}`,
      'HTTP-Referer': 'https://github.com',
      'X-Title': 'AI Daily Radar'
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(`LLM request failed with status ${response.status}: ${errorBody}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function processSource(source, config, knownFingerprints) {
  const messages = [
    ...buildMessages(source, knownFingerprints),
    {
      role: 'user',
      content: [
        '请严格返回如下 JSON 结构:',
        '{"items":[{"name":"产品名","summary":"20字内功能","highlight":"一句话推荐理由","publishedAt":"官方发布时间，没有则为空字符串"}]}',
        '如果没有合适结果，返回 {"items":[]}。'
      ].join('\n')
    }
  ];

  const candidateModels = getCandidateModels(config);
  const errors = [];
  let payload;

  for (let index = 0; index < candidateModels.length; index += 1) {
    const model = candidateModels[index];
    const maxAttempts = isOpenRouterFreeRouter(model) ? 3 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        payload = await requestCompletion(messages, model, config);
        break;
      } catch (error) {
        errors.push(`${model} (attempt ${attempt}/${maxAttempts}): ${error.message}`);

        if (!isRetryableError(error, model)) {
          throw error;
        }

        if (attempt < maxAttempts) {
          await sleep(getRetryDelayMs(attempt));
          continue;
        }
      }

      break;
    }

    if (payload) {
      break;
    }

    if (index < candidateModels.length - 1) {
      await sleep(800);
    }
  }

  if (!payload) {
    throw new Error(`All LLM models failed. ${errors.join(' | ')}`);
  }

  const messageContent = payload.choices?.[0]?.message?.content;

  if (!messageContent) {
    return [];
  }

  const parsed = parseLlmResponse(messageContent);

  if (Array.isArray(parsed)) {
    return applySourceStrategy(sanitizeItems(parsed, source), source);
  }

  return applySourceStrategy(sanitizeItems(parsed.items, source), source);
}

function deduplicateItems(items, historyFingerprints) {
  const seen = new Set(historyFingerprints);
  const deduplicated = [];

  for (const item of items) {
    const fingerprint = `${item.name}|${item.sourceUrl}`.toLowerCase();

    if (seen.has(fingerprint)) {
      continue;
    }

    seen.add(fingerprint);
    deduplicated.push(item);
  }

  return deduplicated;
}

module.exports = {
  deduplicateItems,
  processSource
};
