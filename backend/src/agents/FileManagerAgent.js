// backend/src/agents/FileManagerAgent.js
//
// Real file agent. Replaces the file_manager StubAgent. Genuinely functional
// and keyless — it performs LOCAL filesystem operations, but inside a strict
// sandbox because these commands arrive from a voice transcript:
//
//   - Sandbox: every path is resolved and MUST stay within FILES_DIR
//     (MOTHERCODE_FILES_DIR, default <repo>/outputs/notes). Traversal is rejected.
//   - Allowed: list, read, create/append text notes. Text files only (.md/.txt).
//   - Forbidden by design: delete, overwrite of an existing file's content,
//     binary writes, and anything outside the sandbox. There is intentionally
//     no voice path to destructive ops.
//   - Caps: filename length/charset sanitized; content capped at MAX_BYTES.
//
// Contract matches the other agents: execute() → { message, ... }.

import BaseAgent from './BaseAgent.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..'); // agents → src → backend → repo
const MAX_BYTES = 64 * 1024; // cap a single voice-written note
const TEXT_EXT = new Set(['.md', '.txt']);

/** Sandbox directory, resolved at call time so MOTHERCODE_FILES_DIR can be set late. */
function filesDir() {
  return path.resolve(process.env.MOTHERCODE_FILES_DIR || path.join(REPO_ROOT, 'outputs', 'notes'));
}

export class FileManagerAgent extends BaseAgent {
  constructor(redis) {
    super('FileManagerAgent', 'file_manager', redis);
    this.isReady = true;
  }

  async execute(command) {
    const text = (command.transcript || command.intent || '').trim();
    const action = this.routeAction(text);
    try {
      await fs.mkdir(filesDir(), { recursive: true });
      if (action === 'list') return await this.list();
      if (action === 'read') return await this.read(text);
      return await this.create(text); // create | append default
    } catch (err) {
      if (err.code === 'SANDBOX' || err.code === 'BADNAME') {
        return { message: err.message, domain: 'file_manager', rejected: true };
      }
      console.warn('[FileManagerAgent] op failed:', err.message);
      return { message: `I couldn't complete that file operation: ${err.message}`, domain: 'file_manager', error: err.message };
    }
  }

  routeAction(text) {
    const t = text.toLowerCase();
    if (/\b(list|show|what|which|see)\b.*\b(files?|notes?|documents?)\b/.test(t)) return 'list';
    if (/\b(read|open|show me|what'?s in|contents? of)\b/.test(t) && /\b(file|note|document|\.md|\.txt)\b/.test(t)) return 'read';
    return 'create';
  }

  async list() {
    const all = await fs.readdir(filesDir());
    const files = all.filter((f) => TEXT_EXT.has(path.extname(f).toLowerCase()));
    if (!files.length) {
      return { message: `Your notes folder is empty. Say "save a note: …" to create one.`, domain: 'file_manager', files: [] };
    }
    const preview = files.slice(0, 5).join(', ');
    return {
      message: `You have ${files.length} note${files.length === 1 ? '' : 's'}: ${preview}${files.length > 5 ? ', …' : ''}.`,
      domain: 'file_manager',
      files,
    };
  }

  async read(text) {
    const name = this.extractFilename(text);
    if (!name) return { message: 'Which file should I read? Try "read the note called launch".', domain: 'file_manager', needsClarification: true };
    const target = this.safePath(name);
    let body;
    try {
      body = await fs.readFile(target, 'utf8');
    } catch {
      return { message: `I couldn't find a note called "${path.basename(target)}".`, domain: 'file_manager', notFound: true };
    }
    const snippet = body.slice(0, 280).replace(/\s+/g, ' ').trim();
    return { message: `"${path.basename(target)}" says: ${snippet}${body.length > 280 ? '…' : ''}`, domain: 'file_manager', file: path.basename(target) };
  }

  async create(text) {
    const { content, name } = this.parseCreate(text);
    if (!content) {
      return { message: 'What should I write? Try "save a note: call the venue at 5pm".', domain: 'file_manager', needsClarification: true };
    }
    const target = this.safePath(name);
    const capped = content.length > MAX_BYTES ? content.slice(0, MAX_BYTES) : content;

    // Append if the note already exists (never destructively overwrite).
    let existed = true;
    try {
      await fs.access(target);
    } catch {
      existed = false;
    }
    if (existed) {
      await fs.appendFile(target, `\n\n${capped}\n`, 'utf8');
      return { message: `Appended that to your note "${path.basename(target)}".`, domain: 'file_manager', file: path.basename(target), appended: true };
    }
    await fs.writeFile(target, `${capped}\n`, { encoding: 'utf8', flag: 'wx' });
    return { message: `Saved your note as "${path.basename(target)}".`, domain: 'file_manager', file: path.basename(target), created: true };
  }

  // ---- parsing & safety -------------------------------------------------

  /** Extract a target filename token from "called X" / "named X" / "X.md". */
  extractFilename(text) {
    const m =
      text.match(/\b(?:called|named|titled)\s+["']?([\w .-]+?)["']?(?:\s|$)/i) ||
      text.match(/\b([\w-]+\.(?:md|txt))\b/i);
    return m ? m[1].trim() : null;
  }

  /** Split a create command into { content, name }. */
  parseCreate(text) {
    let content = '';
    const colon = text.match(/\b(?:note|file|memo|reminder)\s*(?:that says|saying|:)\s*(.+)$/i);
    if (colon) {
      content = colon[1].trim();
    } else {
      content = text
        .replace(/^\s*(please\s+)?(save|create|write|make|add|note|jot|record)\s+/i, '')
        .replace(/^\s*(a|an|the)\s+/i, '')
        .replace(/^\s*(note|file|memo|reminder)\s+/i, '')
        .trim();
    }
    // Pull an explicit "called X" name out of the content if present.
    const name = this.extractFilename(text);
    if (name) {
      content = content.replace(/\b(?:called|named|titled)\s+["']?[\w .-]+["']?/i, '').trim();
    }
    return { content, name };
  }

  /**
   * Resolve a (possibly user-supplied) name to a path INSIDE the sandbox.
   * Strips any directory components, sanitizes the charset, forces a text
   * extension, and verifies containment. Throws {code:'SANDBOX'|'BADNAME'}.
   */
  safePath(name) {
    const base = name && name.trim() ? name.trim() : `note-${this.stamp()}`;
    // Drop any path separators / traversal — keep only the final segment.
    let clean = path.basename(base).replace(/[^\w .-]/g, '').trim();
    if (!clean || clean === '.' || clean === '..') {
      const e = new Error('That file name isn\'t allowed.'); e.code = 'BADNAME'; throw e;
    }
    let ext = path.extname(clean).toLowerCase();
    if (!TEXT_EXT.has(ext)) { clean += '.md'; ext = '.md'; }
    const dir = filesDir();
    const resolved = path.resolve(dir, clean);
    const within = resolved === dir || resolved.startsWith(dir + path.sep);
    if (!within) {
      const e = new Error('That path is outside the notes folder, so I won\'t touch it.'); e.code = 'SANDBOX'; throw e;
    }
    return resolved;
  }

  /** Filesystem-safe timestamp for auto-named notes (no Date.now coupling needed). */
  stamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  }
}

export { filesDir };
export default FileManagerAgent;
