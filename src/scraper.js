function buildJinaReaderUrl(url) {
  return `https://r.jina.ai/${url}`;
}

function truncateContent(content, maxContentChars) {
  if (content.length <= maxContentChars) {
    return content;
  }

  return content.slice(0, maxContentChars);
}

async function fetchMarkdownFromUrl(site, options) {
  const response = await fetch(buildJinaReaderUrl(site.url), {
    signal: AbortSignal.timeout(options.requestTimeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const markdown = await response.text();

  return {
    name: site.name,
    sourceUrl: site.url,
    rawContent: markdown,
    content: truncateContent(markdown, options.maxContentChars)
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
