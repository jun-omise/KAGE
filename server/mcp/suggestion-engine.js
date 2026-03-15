// MCP Suggestion Engine - predicts needed MCP servers from message keywords

const KEYWORD_MAP = {
  // Filesystem
  filesystem: {
    keywords: ['file', 'folder', 'directory', 'path', 'read file', 'write file', 'create file',
      'list directory', 'delete file', 'move file', 'copy file', 'rename',
      'desktop', 'documents', 'downloads', 'save', 'open file',
      // Japanese
      '\u30D5\u30A1\u30A4\u30EB', '\u30D5\u30A9\u30EB\u30C0', '\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA',
      '\u4FDD\u5B58', '\u958B\u304F', '\u4F5C\u6210', '\u524A\u9664', '\u79FB\u52D5',
      '\u30C7\u30B9\u30AF\u30C8\u30C3\u30D7', '\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8', '\u6574\u7406'],
    name: 'Filesystem',
    icon: '\uD83D\uDCC1',
    description: 'Read, write, and manage local files',
  },

  // Web Search
  brave_search: {
    keywords: ['search', 'find', 'lookup', 'google', 'web search', 'information',
      'latest', 'news', 'research', 'look up',
      '\u691C\u7D22', '\u63A2\u3059', '\u8ABF\u3079\u308B', '\u30CB\u30E5\u30FC\u30B9', '\u6700\u65B0', '\u60C5\u5831'],
    name: 'Brave Search',
    icon: '\uD83D\uDD0D',
    description: 'Search the web for information',
  },

  // GitHub
  github: {
    keywords: ['github', 'repo', 'repository', 'pull request', 'PR', 'issue', 'commit',
      'branch', 'merge', 'clone', 'fork', 'git',
      '\u30EA\u30DD\u30B8\u30C8\u30EA', '\u30D7\u30EB\u30EA\u30AF\u30A8\u30B9\u30C8'],
    name: 'GitHub',
    icon: '\uD83D\uDC19',
    description: 'Interact with GitHub repositories',
  },

  // Puppeteer / Browser
  puppeteer: {
    keywords: ['browser', 'web page', 'screenshot', 'scrape', 'navigate', 'website',
      'click', 'form', 'login', 'crawl', 'automate browser',
      '\u30D6\u30E9\u30A6\u30B6', '\u30B9\u30AF\u30EA\u30FC\u30F3\u30B7\u30E7\u30C3\u30C8',
      '\u30A6\u30A7\u30D6\u30DA\u30FC\u30B8', '\u30AF\u30ED\u30FC\u30EB'],
    name: 'Puppeteer',
    icon: '\uD83C\uDF10',
    description: 'Automate browser interactions',
  },

  // Slack
  slack: {
    keywords: ['slack', 'channel', 'message slack', 'send slack', 'slack notification',
      '\u30B9\u30E9\u30C3\u30AF', '\u30C1\u30E3\u30F3\u30CD\u30EB'],
    name: 'Slack',
    icon: '\uD83D\uDCAC',
    description: 'Send and read Slack messages',
  },

  // Database
  postgres: {
    keywords: ['database', 'sql', 'query', 'postgres', 'postgresql', 'table', 'schema',
      '\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9', '\u30AF\u30A8\u30EA', '\u30C6\u30FC\u30D6\u30EB'],
    name: 'PostgreSQL',
    icon: '\uD83D\uDDC4\uFE0F',
    description: 'Query PostgreSQL databases',
  },

  // Docker
  docker: {
    keywords: ['docker', 'container', 'image', 'dockerfile', 'compose',
      '\u30B3\u30F3\u30C6\u30CA', '\u30A4\u30E1\u30FC\u30B8'],
    name: 'Docker',
    icon: '\uD83D\uDC33',
    description: 'Manage Docker containers',
  },

  // Email
  google_workspace: {
    keywords: ['email', 'send email', 'gmail', 'google docs', 'google sheets',
      'spreadsheet', 'calendar', 'google drive',
      '\u30E1\u30FC\u30EB', '\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8', '\u30AB\u30EC\u30F3\u30C0\u30FC'],
    name: 'Google Workspace',
    icon: '\uD83D\uDCE7',
    description: 'Access Gmail, Docs, Sheets, Calendar',
  },

  // Notion
  notion: {
    keywords: ['notion', 'wiki', 'note', 'knowledge base',
      '\u30CE\u30FC\u30C8', '\u30CA\u30EC\u30C3\u30B8\u30D9\u30FC\u30B9'],
    name: 'Notion',
    icon: '\uD83D\uDCDD',
    description: 'Access and manage Notion pages',
  },

  // Terminal / Shell
  shell: {
    keywords: ['terminal', 'shell', 'command', 'run command', 'execute', 'bash', 'script',
      'install', 'npm', 'pip', 'brew',
      '\u30BF\u30FC\u30DF\u30CA\u30EB', '\u30B3\u30DE\u30F3\u30C9', '\u5B9F\u884C', '\u30B9\u30AF\u30EA\u30D7\u30C8'],
    name: 'Shell',
    icon: '\uD83D\uDCBB',
    description: 'Execute shell commands',
  },

  // Memory
  memory: {
    keywords: ['remember', 'recall', 'memory', 'store', 'note',
      '\u8A18\u61B6', '\u899A\u3048\u3066', '\u601D\u3044\u51FA\u3059'],
    name: 'Memory',
    icon: '\uD83E\uDDE0',
    description: 'Store and recall information',
  },

  // Figma
  figma: {
    keywords: ['figma', 'design', 'mockup', 'wireframe', 'prototype', 'UI design',
      '\u30C7\u30B6\u30A4\u30F3', '\u30E2\u30C3\u30AF\u30A2\u30C3\u30D7', '\u30D7\u30ED\u30C8\u30BF\u30A4\u30D7'],
    name: 'Figma',
    icon: '\uD83C\uDFA8',
    description: 'Access Figma designs',
  },

  // YouTube
  youtube: {
    keywords: ['youtube', 'video', 'transcript', 'subtitles',
      '\u52D5\u753B', '\u5B57\u5E55'],
    name: 'YouTube',
    icon: '\uD83C\uDFAC',
    description: 'Access YouTube transcripts',
  },
};

export class MCPSuggestionEngine {
  constructor() {
    this.sessionHistory = new Set();
  }

  suggest(message) {
    if (!message || message.trim().length < 2) return [];

    const lowerMessage = message.toLowerCase();
    const suggestions = [];

    for (const [serverId, config] of Object.entries(KEYWORD_MAP)) {
      let matchedKeywords = 0;
      const matched = [];

      for (const keyword of config.keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          matchedKeywords++;
          matched.push(keyword);
        }
      }

      if (matchedKeywords > 0) {
        suggestions.push({
          serverId,
          serverName: config.name,
          icon: config.icon,
          description: config.description,
          confidence: Math.min(matchedKeywords / 2, 1),
          keywords_matched: matched,
        });
      }
    }

    // Sort by confidence (highest first), then by session history (recently used first)
    suggestions.sort((a, b) => {
      const aHistory = this.sessionHistory.has(a.serverId) ? 0.2 : 0;
      const bHistory = this.sessionHistory.has(b.serverId) ? 0.2 : 0;
      return (b.confidence + bHistory) - (a.confidence + aHistory);
    });

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  addSessionHistory(serverId) {
    this.sessionHistory.add(serverId);
  }
}

// Singleton
const suggestionEngine = new MCPSuggestionEngine();
export default suggestionEngine;
