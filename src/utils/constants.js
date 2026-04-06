/**
 * Shared constants used across the application
 * Centralizes configuration to eliminate duplication and improve maintainability
 */

/**
 * CDP ports to scan for Kiro instances
 * Port 9222 is prioritized for Kiro IDE (Electron default)
 * @type {number[]}
 */
export const CDP_PORTS = [9222, 9000, 9001, 9002, 9003, 9229];

/**
 * Model names for AI model detection and matching
 * Order matters: check specific names (opus, sonnet, haiku) BEFORE generic (claude)
 * @type {string[]}
 */
export const MODEL_NAMES = ['auto', 'opus', 'sonnet', 'haiku', 'gpt', 'claude', 'gemini', 'llama'];

/**
 * Code file extensions for workspace file filtering
 * @type {Set<string>}
 */
export const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs',
  '.html', '.css', '.scss', '.json', '.yaml', '.yml', '.md',
  '.sql', '.sh', '.c', '.cpp', '.h', '.cs', '.vue', '.svelte', '.rb', '.php'
]);

/**
 * File extension to language mapping for syntax highlighting
 * @type {Object<string, string>}
 */
export const EXTENSION_TO_LANGUAGE = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.json': 'json',
  '.md': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.sql': 'sql',
  '.sh': 'bash',
  '.vue': 'vue',
  '.svelte': 'svelte'
};

/**
 * Get language from file extension
 * @param {string} filename - File name or path
 * @returns {string} - Language identifier or extension without dot
 */
export function getLanguageFromExtension(filename) {
  const ext = filename.includes('.') ? '.' + filename.split('.').pop().toLowerCase() : '';
  return EXTENSION_TO_LANGUAGE[ext] || ext.slice(1) || 'text';
}

/**
 * Check if a file has a code extension
 * @param {string} filename - File name or path
 * @returns {boolean}
 */
export function isCodeFile(filename) {
  const ext = filename.includes('.') ? '.' + filename.split('.').pop().toLowerCase() : '';
  return CODE_EXTENSIONS.has(ext);
}

/**
 * CDP call timeout in milliseconds
 * @type {number}
 */
export const CDP_CALL_TIMEOUT = 10000;

/**
 * HTTP request timeout in milliseconds
 * @type {number}
 */
export const HTTP_TIMEOUT = 2000;

/**
 * Discovery polling intervals
 */
export const DISCOVERY_INTERVAL_ACTIVE = 10000;  // 10 seconds when changes detected
export const DISCOVERY_INTERVAL_STABLE = 30000;  // 30 seconds when stable

/**
 * Snapshot polling intervals
 */
export const SNAPSHOT_INTERVAL_ACTIVE = 200;     // 200ms when active (very fast updates)
export const SNAPSHOT_INTERVAL_IDLE = 800;       // 800ms when idle
export const SNAPSHOT_IDLE_THRESHOLD = 3000;     // 3 seconds before considered idle

/**
 * OTP authentication settings
 */
export const OTP_MAX_ATTEMPTS = 5;       // Max failed attempts before lockout
export const OTP_LOCKOUT_MS = 60000;      // 60 second lockout after max attempts

/**
 * Maximum depth for recursive file search
 * @type {number}
 */
export const MAX_FILE_SEARCH_DEPTH = 4;

/**
 * Maximum depth for workspace file collection
 * @type {number}
 */
export const MAX_WORKSPACE_DEPTH = 5;
