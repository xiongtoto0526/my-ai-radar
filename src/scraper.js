function buildJinaReaderUrl(url) {
  return `https://r.jina.ai/${url}`;
}

const MONTH_INDEX = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12'
};

function truncateContent(content, maxContentChars) {
  if (content.length <= maxContentChars) {
    return content;
  }

  return content.slice(0, maxContentChars);
}

function formatIsoDate(year, month, day) {
  const normalizedMonth = MONTH_INDEX[String(month || '').toLowerCase()];
  const normalizedDay = String(day).padStart(2, '0');

  if (!year || !normalizedMonth || !day) {
    return '';
  }

  return `${year}-${normalizedMonth}-${normalizedDay}`;
}

async function fetchJinaMarkdown(url, options) {
  const response = await fetch(buildJinaReaderUrl(url), {
    signal: AbortSignal.timeout(options.requestTimeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.text();
}

function extractSectionByHeading(markdown, headingPrefix) {
  const headingIndex = markdown.indexOf(headingPrefix);
  if (headingIndex === -1) {
    return '';
  }

  const remainder = markdown.slice(headingIndex);
  const nextHeadingIndex = remainder.indexOf(`\n${headingPrefix}`);
  return nextHeadingIndex === -1 ? remainder : remainder.slice(0, nextHeadingIndex);
}

function extractCursorLatestRelease(markdown) {
  const firstEntryMatch = markdown.match(/##\s+\[([\s\S]*?)\]\((https:\/\/cursor\.com\/changelog\/[^)]+)\)/);
  if (!firstEntryMatch) {
    return null;
  }

  const sectionStart = firstEntryMatch.index;
  const remainder = markdown.slice(sectionStart);
  const nextEntryIndex = remainder.indexOf('\n## ');
  const section = nextEntryIndex === -1 ? remainder : remainder.slice(0, nextEntryIndex);
  const announcementMatch = section.match(/\((https:\/\/cursor\.com\/blog\/[^)]+)\)/);

  return {
    content: section.trim(),
    entryUrl: announcementMatch ? announcementMatch[1] : firstEntryMatch[2]
  };
}

async function enrichCursorLatestRelease(markdown, options) {
  const latestRelease = extractCursorLatestRelease(markdown);
  if (!latestRelease) {
    return null;
  }

  const announcementMarkdown = await fetchJinaMarkdown(latestRelease.entryUrl, options);
  const publishedTimeMatch = announcementMarkdown.match(/Published Time:\s*([^\n]+)/i);

  return {
    content: [
      publishedTimeMatch ? `Official Published Time: ${publishedTimeMatch[1].trim()}` : null,
      latestRelease.content
    ].filter(Boolean).join('\n\n'),
    officialPublishedAt: publishedTimeMatch ? publishedTimeMatch[1].trim() : '',
    entryUrl: latestRelease.entryUrl
  };
}

function extractGitHubLatestRelease(markdown) {
  const monthHeaderMatch = markdown.match(/##\s+([A-Za-z]+)\s+[A-Za-z]+\s+(\d{4})/);
  const entryMatch = markdown.match(/###\s*([A-Za-z]{3})\.(\d{1,2})\s+([A-Za-z]+)[\s\S]*?\n\n\[([^\]]+)\]\((https:\/\/github\.blog\/changelog\/[^)]+)\)/);

  if (!monthHeaderMatch || !entryMatch) {
    return null;
  }

  const sectionStart = entryMatch.index;
  const remainder = markdown.slice(sectionStart);
  const nextEntryIndex = remainder.indexOf('\n### ');
  const section = nextEntryIndex === -1 ? remainder : remainder.slice(0, nextEntryIndex);
  const officialPublishedAt = formatIsoDate(monthHeaderMatch[2], entryMatch[1], entryMatch[2]);

  return {
    content: [
      officialPublishedAt ? `Official Published Time: ${officialPublishedAt}` : null,
      section.trim()
    ].filter(Boolean).join('\n\n'),
    officialPublishedAt,
    entryUrl: entryMatch[5]
  };
}

async function prepareSourceContent(site, markdown, options) {
  if (site.extractStrategy !== 'latest-release') {
    return {
      content: truncateContent(markdown, options.maxContentChars),
      officialPublishedAt: '',
      entryUrl: site.url
    };
  }

  if (site.url.includes('cursor.com/changelog')) {
    const latestRelease = await enrichCursorLatestRelease(markdown, options);
    if (latestRelease) {
      return {
        content: truncateContent(latestRelease.content, options.maxContentChars),
        officialPublishedAt: latestRelease.officialPublishedAt,
        entryUrl: latestRelease.entryUrl
      };
    }
  }

  if (site.url.includes('github.blog/changelog/label/copilot')) {
    const latestRelease = extractGitHubLatestRelease(markdown);
    if (latestRelease) {
      return {
        content: truncateContent(latestRelease.content, options.maxContentChars),
        officialPublishedAt: latestRelease.officialPublishedAt,
        entryUrl: latestRelease.entryUrl
      };
    }
  }

  return {
    content: truncateContent(markdown, options.maxContentChars),
    officialPublishedAt: '',
    entryUrl: site.url
  };
}

async function fetchMarkdownFromUrl(site, options) {
  const markdown = await fetchJinaMarkdown(site.url, options);
  const prepared = await prepareSourceContent(site, markdown, options);

  return {
    name: site.name,
    sourceUrl: site.url,
    extractStrategy: site.extractStrategy,
    officialPublishedAt: prepared.officialPublishedAt,
    entryUrl: prepared.entryUrl,
    rawContent: markdown,
    content: prepared.content
  };
}

async function scrapeSites(sites, options) {
  const tasks = sites.map(async (site) => {
    try {
      const result = await fetchMarkdownFromUrl(site, options);
      return {
        ...result,
        error: null
      };
    } catch (error) {
      return {
        name: site.name,
        sourceUrl: site.url,
        extractStrategy: site.extractStrategy,
        officialPublishedAt: '',
        entryUrl: site.url,
        rawContent: '',
        content: '',
        error: error.message
      };
    }
  });

  return Promise.all(tasks);
}

module.exports = {
  buildJinaReaderUrl,
  scrapeSites,
  truncateContent
};
