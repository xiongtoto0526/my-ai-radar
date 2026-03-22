function formatRadarMessage(items) {
  const date = new Date().toISOString().slice(0, 10);

  if (!items.length) {
    return [`### 每日 AI 雷达 (${date})`, '---', '今日暂无重大更新'].join('\n');
  }

  const blocks = items.map((item, index) => {
    return [
      `**${index + 1}. [${item.name}](${item.sourceUrl})**`,
      item.publishedAt ? `- 发布时间：${item.publishedAt}` : null,
      `- 功能：${item.summary}`,
      `- 亮点：${item.highlight}`,
      `- 原文：[点击查看](${item.sourceUrl})`
    ].filter(Boolean).join('\n');
  });

  return [`### 每日 AI 雷达 (${date})`, '---', ...blocks.map((block) => `${block}\n---`), '*更多详情请查看原始链接...*'].join('\n');
}

function validateWebhookUrl(webhookUrl) {
  if (!webhookUrl || webhookUrl.includes('your_key')) {
    throw new Error('WECHAT_WEBHOOK is still using the placeholder value. Please replace it with a real Work WeChat bot webhook URL.');
  }

  if (!webhookUrl.startsWith('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=')) {
    throw new Error('WECHAT_WEBHOOK format is invalid. Expected a Work WeChat bot webhook URL.');
  }
}

async function sendWechatNotification(webhookUrl, content) {
  validateWebhookUrl(webhookUrl);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        content
      }
    })
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`Failed to send WeChat message: ${response.status} ${responseBody}`);
  }

  const payload = await response.json();

  if (payload.errcode !== 0) {
    if (payload.errcode === 93000) {
      throw new Error('Work WeChat webhook is invalid or expired. Please update WECHAT_WEBHOOK with a valid bot webhook URL.');
    }

    throw new Error(`WeChat webhook returned errcode ${payload.errcode}: ${payload.errmsg}`);
  }
}

module.exports = {
  formatRadarMessage,
  sendWechatNotification
};
