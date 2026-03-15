/**
 * KAGE Tool → Server ID Mapping
 * Maps MCP tool names to their originating server IDs for reverse-lookup.
 */

const TOOL_SERVER_MAP = {
  // Filesystem
  read_file: 'filesystem',
  write_file: 'filesystem',
  list_directory: 'filesystem',
  create_directory: 'filesystem',
  move_file: 'filesystem',
  search_files: 'filesystem',
  get_file_info: 'filesystem',
  read_multiple_files: 'filesystem',
  list_allowed_directories: 'filesystem',

  // GitHub
  create_issue: 'github',
  list_issues: 'github',
  create_pull_request: 'github',
  list_repos: 'github',
  get_file_contents: 'github',
  search_repositories: 'github',
  search_code: 'github',
  create_repository: 'github',
  push_files: 'github',
  create_or_update_file: 'github',
  fork_repository: 'github',
  create_branch: 'github',

  // Git
  git_status: 'git',
  git_diff: 'git',
  git_log: 'git',
  git_commit: 'git',
  git_add: 'git',
  git_reset: 'git',
  git_checkout: 'git',

  // Brave Search
  brave_web_search: 'brave_search',
  brave_local_search: 'brave_search',

  // PostgreSQL
  run_query: 'postgres',
  execute_sql: 'postgres',
  list_tables: 'postgres',
  describe_table: 'postgres',

  // Docker
  docker_ps: 'docker',
  docker_build: 'docker',
  docker_run: 'docker',
  docker_images: 'docker',
  docker_logs: 'docker',

  // Slack
  slack_send_message: 'slack',
  slack_list_channels: 'slack',
  slack_read_messages: 'slack',

  // Shell
  run_command: 'shell',
  execute_command: 'shell',

  // Puppeteer
  puppeteer_navigate: 'puppeteer',
  puppeteer_screenshot: 'puppeteer',
  puppeteer_click: 'puppeteer',
  puppeteer_fill: 'puppeteer',
  puppeteer_evaluate: 'puppeteer',

  // Memory
  store_memory: 'memory',
  recall_memory: 'memory',
  list_memories: 'memory',

  // Google Workspace
  gmail_send: 'google_workspace',
  gmail_read: 'google_workspace',
  gdocs_create: 'google_workspace',
  gsheets_read: 'google_workspace',

  // Notion
  notion_search: 'notion',
  notion_create_page: 'notion',
  notion_update_page: 'notion',

  // Figma
  figma_get_file: 'figma',
  figma_get_comments: 'figma',

  // YouTube
  youtube_transcript: 'youtube',
  youtube_search: 'youtube',
};

/**
 * Resolve a tool name to its server ID.
 * Supports exact match and fuzzy prefix matching.
 */
export function resolveServerId(toolName) {
  // Exact match
  if (TOOL_SERVER_MAP[toolName]) return TOOL_SERVER_MAP[toolName];

  // Fuzzy: check if tool name starts with a known prefix
  const lowerTool = toolName.toLowerCase();
  for (const [key, serverId] of Object.entries(TOOL_SERVER_MAP)) {
    if (lowerTool.startsWith(key.split('_')[0])) {
      return serverId;
    }
  }

  return null;
}

export default TOOL_SERVER_MAP;
