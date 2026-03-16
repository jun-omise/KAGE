/**
 * KAGE Skill Loader
 * OpenClaw-compatible SKILL.md loader with YAML frontmatter parsing.
 * Scans skill directories, parses SKILL.md files, and provides
 * skill instructions for system prompt injection.
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { getDb } from '../db/init.js';

/** Default skill directories */
const USER_SKILLS_DIR = join(homedir(), '.kagemusha', 'skills');
const BUNDLED_SKILLS_DIR = join(process.cwd(), 'skills', 'bundled');

class SkillLoader {
  constructor() {
    /** @type {Map<string, SkillDefinition>} name → skill */
    this.skills = new Map();
    this.initialized = false;
  }

  /**
   * Initialize: ensure directories exist, scan for skills, sync with DB.
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Ensure user skills directory exists
    try {
      if (!existsSync(USER_SKILLS_DIR)) {
        mkdirSync(USER_SKILLS_DIR, { recursive: true });
        console.log(`[SkillLoader] Created user skills directory: ${USER_SKILLS_DIR}`);
      }
    } catch (e) {
      console.warn(`[SkillLoader] Could not create skills dir: ${e.message}`);
    }

    this.reload();
  }

  /**
   * Reload all skills from disk.
   */
  reload() {
    this.skills.clear();

    // Load bundled skills (if directory exists)
    if (existsSync(BUNDLED_SKILLS_DIR)) {
      this._scanDirectory(BUNDLED_SKILLS_DIR, 'bundled');
    }

    // Load user skills
    if (existsSync(USER_SKILLS_DIR)) {
      this._scanDirectory(USER_SKILLS_DIR, 'user');
    }

    // Sync enabled state with DB
    this._syncWithDb();

    console.log(`[SkillLoader] Loaded ${this.skills.size} skills`);
  }

  /**
   * Get all loaded skills.
   * @returns {SkillDefinition[]}
   */
  getAll() {
    return Array.from(this.skills.values());
  }

  /**
   * Get enabled skills only.
   * @returns {SkillDefinition[]}
   */
  getEnabled() {
    return Array.from(this.skills.values()).filter(s => s.enabled);
  }

  /**
   * Get a specific skill by name.
   * @param {string} name
   * @returns {SkillDefinition|null}
   */
  get(name) {
    return this.skills.get(name) || null;
  }

  /**
   * Enable or disable a skill.
   * @param {string} name
   * @param {boolean} enabled
   */
  setEnabled(name, enabled) {
    const skill = this.skills.get(name);
    if (!skill) return false;

    skill.enabled = enabled;

    // Persist to DB
    const db = getDb();
    db.prepare(`
      INSERT INTO tool_configs (id, name, type, enabled, updated_at)
      VALUES (?, ?, 'mcp', ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET enabled = ?, updated_at = datetime('now')
    `).run(`skill_${name}`, name, enabled ? 1 : 0, enabled ? 1 : 0);

    return true;
  }

  /**
   * Build system prompt additions from enabled skills.
   * These get injected into the agent's system prompt to give it skill capabilities.
   * @returns {string}
   */
  buildPromptInstructions() {
    const enabled = this.getEnabled();
    if (enabled.length === 0) return '';

    const sections = enabled.map(skill => {
      let section = `\n### Skill: ${skill.name}`;
      if (skill.description) section += `\n${skill.description}`;
      if (skill.instructions) section += `\n${skill.instructions}`;
      return section;
    });

    return `\n\n══════ INSTALLED SKILLS ══════${sections.join('\n')}\n══════ END SKILLS ══════`;
  }

  /**
   * Install a skill from a URL or local path.
   * @param {string} source - URL or local directory path
   * @returns {{success: boolean, name?: string, error?: string}}
   */
  async installFromPath(source) {
    try {
      const skillMdPath = source.endsWith('SKILL.md')
        ? source
        : join(source, 'SKILL.md');

      if (!existsSync(skillMdPath)) {
        return { success: false, error: `SKILL.md not found at ${skillMdPath}` };
      }

      const content = readFileSync(skillMdPath, 'utf-8');
      const parsed = this._parseSkillMd(content);

      if (!parsed.name) {
        return { success: false, error: 'SKILL.md has no name in frontmatter' };
      }

      // Copy to user skills directory
      const destDir = join(USER_SKILLS_DIR, parsed.name);
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      // Copy SKILL.md
      writeFileSync(join(destDir, 'SKILL.md'), content);

      // Reload
      this.reload();

      return { success: true, name: parsed.name };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Scan a directory for SKILL.md files.
   * Supports both flat and nested structures:
   *   skills/my-skill/SKILL.md
   *   skills/SKILL.md (single skill in root)
   * @private
   */
  _scanDirectory(dir, source) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // Check for SKILL.md inside subdirectory
          const skillPath = join(fullPath, 'SKILL.md');
          if (existsSync(skillPath)) {
            this._loadSkill(skillPath, source, entry.name);
          }
        } else if (entry.name === 'SKILL.md') {
          // SKILL.md directly in the scanned directory
          this._loadSkill(fullPath, source, basename(dir));
        }
      }
    } catch (error) {
      console.warn(`[SkillLoader] Error scanning ${dir}: ${error.message}`);
    }
  }

  /**
   * Load and parse a single SKILL.md file.
   * @private
   */
  _loadSkill(filePath, source, dirName) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const parsed = this._parseSkillMd(content);

      const name = parsed.name || dirName;
      const skill = {
        name,
        description: parsed.description || '',
        instructions: parsed.instructions || '',
        metadata: parsed.metadata || {},
        source,
        path: filePath,
        enabled: true, // Default enabled, DB overrides later
        verified: source === 'bundled',
        requires: parsed.metadata?.openclaw?.requires || {},
      };

      // Check binary dependencies
      if (skill.requires.bins) {
        skill.dependenciesMet = this._checkBinaries(skill.requires.bins);
      } else {
        skill.dependenciesMet = true;
      }

      this.skills.set(name, skill);
    } catch (error) {
      console.warn(`[SkillLoader] Failed to load ${filePath}: ${error.message}`);
    }
  }

  /**
   * Parse SKILL.md content with YAML frontmatter.
   * Format:
   * ```
   * ---
   * name: my-skill
   * description: What it does
   * metadata:
   *   openclaw:
   *     requires:
   *       bins:
   *         - ffmpeg
   * ---
   * # Skill instructions
   * ...
   * ```
   * @private
   */
  _parseSkillMd(content) {
    const result = {
      name: null,
      description: null,
      instructions: '',
      metadata: {},
    };

    // Check for YAML frontmatter
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);

    if (fmMatch) {
      const yamlStr = fmMatch[1];
      const body = fmMatch[2].trim();

      // Simple YAML parser (handles flat keys and nested openclaw structure)
      result.metadata = this._parseSimpleYaml(yamlStr);
      result.name = result.metadata.name || null;
      result.description = result.metadata.description || null;
      result.instructions = body;
    } else {
      // No frontmatter — treat entire content as instructions
      // Try to extract name from first heading
      const headingMatch = content.match(/^#\s+(.+)/m);
      if (headingMatch) {
        result.name = headingMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
      }
      result.instructions = content;
    }

    return result;
  }

  /**
   * Simple YAML parser for skill frontmatter.
   * Handles flat key-value pairs and basic nesting.
   * @private
   */
  _parseSimpleYaml(yamlStr) {
    const result = {};
    const lines = yamlStr.split('\n');
    const stack = [{ obj: result, indent: -1 }];
    let currentList = null;
    let currentListKey = null;

    for (const line of lines) {
      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) continue;

      const indent = line.search(/\S/);
      const trimmed = line.trim();

      // List item
      if (trimmed.startsWith('- ')) {
        const value = trimmed.slice(2).trim();
        if (currentList && currentListKey) {
          currentList.push(value);
        }
        continue;
      }

      // Reset list tracking
      currentList = null;
      currentListKey = null;

      // Key-value pair
      const kvMatch = trimmed.match(/^(\w[\w.-]*)\s*:\s*(.*)$/);
      if (!kvMatch) continue;

      const [, key, rawValue] = kvMatch;
      const value = rawValue.trim();

      // Pop stack to find parent
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1].obj;

      if (value === '' || value === '|' || value === '>') {
        // Nested object or block scalar
        parent[key] = {};
        stack.push({ obj: parent[key], indent });
      } else {
        // Simple value
        parent[key] = this._parseYamlValue(value);
      }

      // Detect if next lines might be a list
      if (value === '' || value === '|') {
        // Could be a list parent — check next lines
        parent[key] = [];
        currentList = parent[key];
        currentListKey = key;
        // Also push as object in case it's nested keys
        // We'll fix the type on first child encounter
      }
    }

    // Fix arrays that ended up as empty objects
    this._fixEmptyObjects(result);

    return result;
  }

  /**
   * Parse a YAML scalar value.
   * @private
   */
  _parseYamlValue(str) {
    if (str === 'true') return true;
    if (str === 'false') return false;
    if (str === 'null' || str === '~') return null;
    if (/^-?\d+$/.test(str)) return parseInt(str, 10);
    if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);
    // Remove quotes
    if ((str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1);
    }
    return str;
  }

  /**
   * Remove empty objects that should have been arrays.
   * @private
   */
  _fixEmptyObjects(obj) {
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value) && value.length === 0) {
        // Keep as empty array
      } else if (typeof value === 'object' && value !== null) {
        if (Object.keys(value).length === 0) {
          // Empty object — might be intentional
        } else {
          this._fixEmptyObjects(value);
        }
      }
    }
  }

  /**
   * Check if required binary dependencies are available.
   * @private
   */
  _checkBinaries(bins) {
    if (!Array.isArray(bins)) return true;

    for (const bin of bins) {
      try {
        execSync(`which ${bin}`, { stdio: 'ignore' });
      } catch {
        console.warn(`[SkillLoader] Missing dependency: ${bin}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Sync skill enabled states with the database.
   * @private
   */
  _syncWithDb() {
    try {
      const db = getDb();
      const rows = db.prepare(
        "SELECT id, name, enabled FROM tool_configs WHERE id LIKE 'skill_%'"
      ).all();

      for (const row of rows) {
        const skillName = row.name;
        const skill = this.skills.get(skillName);
        if (skill) {
          skill.enabled = row.enabled !== 0;
        }
      }
    } catch (error) {
      console.warn(`[SkillLoader] DB sync error: ${error.message}`);
    }
  }
}

const skillLoader = new SkillLoader();
export default skillLoader;

/**
 * @typedef {Object} SkillDefinition
 * @property {string} name - Skill identifier
 * @property {string} description - Human-readable description
 * @property {string} instructions - Markdown instructions for the agent
 * @property {Object} metadata - YAML frontmatter metadata
 * @property {string} source - 'bundled' or 'user'
 * @property {string} path - File path to SKILL.md
 * @property {boolean} enabled - Whether the skill is active
 * @property {boolean} verified - Whether the skill is trusted/verified
 * @property {Object} requires - Dependency requirements
 * @property {boolean} dependenciesMet - Whether all deps are available
 */
