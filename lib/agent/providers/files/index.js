// @ts-check
/* eslint-disable camelcase */
// The provider loader (lib/agent/providers.js) discovers getters by the `get_`
// prefix (it slices the first 4 chars), so exported function names must stay in
// snake_case. Internal identifiers keep their historical names for the same
// reason (stable public surface); hence camelcase is disabled file-wide.
/* eslint-disable consistent-return */
// Callback-style control flow returns cb(...) values from some branches only,
// which is intentional here (matches the rest of the agent).

/// //////////////////////////////////////
// Prey Files Provider
// (C) 2019 Prey, Inc.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
/// //////////////////////////////////////

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const common = require('../../common');

const { system } = common;
const logger = common.logger.prefix('files');
const node_bin = path.join(system.paths.current, 'bin', 'node');
const { run_as_user } = common.system;
const finder = require('./finder');

const os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

const MAX_BUFFER = 20 * 1024 * 1024;

// Sentinels emitted by tree.js around its JSON payload. Kept in sync with
// lib/agent/providers/files/tree.js.
const PAYLOAD_START = '__PREY_TREE_START__';
const PAYLOAD_END = '__PREY_TREE_END__';

function get_home() {
  return process.env.HOME || process.env.HOMEDIR || process.env.USERPROFILE;
}

/**
 * @param {{ path?: string, criteria?: Function }} options
 * @param {Function} callback
 */
const get_list = (options, callback) => {
  const searchPath = options.path;
  const matchesCriteria = options.criteria;
  const matches = [];

  if (!searchPath) return callback(new Error('Cannot find files without a path.'));

  if (!fs.existsSync(searchPath)) return callback(new Error(`Path not found: ${searchPath}`));

  finder.eachFileOrDirectory(searchPath, (err, file, stat) => {
    // if we get a hidden file or error, skip to next
    if (err || /\/\./.test(file)) return;

    if (!stat.isDirectory() && matchesCriteria && matchesCriteria(file, stat)) {
      matches.push(file);
    }
  }, () => {
    callback(null, matches);
  });
};

/**
 * Returns list of recently modified files. Unless a `since` option is passed,
 * it returns the list modified since one hour ago.
 * @param {Object|Function} options
 * @param {Function} [callback]
 */
exports.get_files_recently_modified_list = (options, callback) => {
  const cb = (typeof options === 'function') ? options : callback;
  const opts = (typeof options === 'function') ? {} : (options || {});

  const searchPath = opts.path || get_home();
  const modifiedSince = Date.now() - (opts.since || 1000 * 60 * 60); // one hour ago

  const criteria = (file, stat) => stat.mtime.getTime() > modifiedSince;

  get_list({ path: searchPath, criteria }, cb);
};

/**
 * @param {Object} options search options (string/search_string, path, extensions, case_sensitive)
 * @param {Function} callback
 */
exports.get_files_matching_filename_list = (options, callback) => {
  if (!options.string) return callback(new Error('No search string given.'));

  const searchPath = options.path || get_home();
  const searchString = options.string || options.search_string;
  const extensions = options.extensions || '.*';
  const modifiers = options.case_sensitive ? '' : 'i';

  const regex = new RegExp(`.*${searchString}.*.${extensions}`, modifiers);

  const criteria = (file) => regex.test(file);

  get_list({ path: searchPath, criteria }, callback);
};

/**
 * Extracts the JSON payload emitted by tree.js from between its sentinels,
 * discarding any extra bytes the impersonation launcher (safexec) may add to
 * stdout. Returns null when the sentinels are absent.
 * @param {string} raw
 * @returns {string|null}
 */
function extract_payload(raw) {
  const s = raw.indexOf(PAYLOAD_START);
  const e = raw.indexOf(PAYLOAD_END);
  if (s === -1 || e === -1 || e < s) return null;
  return raw.slice(s + PAYLOAD_START.length, e);
}

/**
 * Resolves the hidden flag for each entry (via attr.js on Windows) and returns
 * the serialized list through the callback.
 * @param {Array<Object>} files
 * @param {Function} cb
 */
function process_files(files, cb) {
  files.forEach((file, index) => {
    /** @param {boolean} isHidden */
    const done = (isHidden) => {
      // eslint-disable-next-line no-param-reassign
      file.hidden = isHidden;
      if (index === files.length - 1) {
        const out = JSON.stringify(files);
        logger.debug(out);
        return cb(null, out);
      }
    };

    if (os_name === 'windows') {
      try {
        const raw = execSync(`cscript ${__dirname}/attr.js ${file.path} //Nologo`, { timeout: 10000 }).toString();
        if (raw.includes('Error')) return done(false);
        const attr = JSON.parse(raw);
        return done(attr.hidden);
      } catch (e) {
        done(false);
      }
    } else done((/(^|\/)\.[^/.]/g).test(file.name));
  });
}

/**
 * Builds a file tree for the given path by running tree.js as the logged user.
 * @param {{ path?: string, depth?: (number|string), user?: string }} options
 * @param {Function} cb
 */
module.exports.get_tree = (options, cb) => {
  let dir = options.path;

  // We need to run the tree walker script personifying
  // the owner of the corresponding /Users or /home subdirectories
  if (os_name !== 'windows' && !options.user) {
    return cb(new Error('Options should specify user.'));
  }

  if (!dir) {
    switch (os_name) {
      case 'windows':
        dir = 'C:';
        break;
      case 'linux':
        dir = `/home/${options.user}`;
        break;
      case 'mac':
        dir = `/Users/${options.user}`;
        break;
      default:
        break;
    }
  } else {
    // TODO validate if path is children of user's home dir
  }

  const argsv = (os_name === 'windows')
    ? [path.join(__dirname, 'tree.js'), options.depth, path.resolve('', `${dir}\\`)]
    : [path.join(__dirname, 'tree.js'), options.depth, `"${dir}"`];

  const opts = {
    user: options.user,
    bin: node_bin,
    type: 'exec',
    args: argsv,
    opts: {
      maxBuffer: MAX_BUFFER,
      env: process.env,
    },
  };

  /** @param {number} attempt */
  const run_tree = (attempt) => {
    run_as_user(opts, (err, out, stderr) => {
      if (err) return cb(err);

      const raw = (out == null) ? '' : out.toString();
      const errOut = (stderr == null) ? '' : stderr.toString();
      const payload = extract_payload(raw);

      // No sentinel: stdout is empty, contaminated, or the child never produced
      // a payload (e.g. safexec could not launch node in the active session).
      // Retry once; if still absent, log the raw output for diagnosis.
      if (payload === null) {
        if (attempt < 1) return run_tree(attempt + 1);

        const trimmed = raw.trim();
        let reason = 'no-sentinel';
        if (trimmed === '') reason = 'empty-stdout';
        else if (trimmed === 'undefined') reason = 'tree-undefined';

        logger.warn(`Unable to parse files data | reason=${reason} | dir=${dir}`
          + ` | user=${options.user || ''} | len=${raw.length}`
          + ` | stdout=${JSON.stringify(raw.slice(0, 500))}`
          + ` | stderr=${JSON.stringify(errOut.slice(0, 500))}`);
        return cb(new Error('Unable to parse files data'));
      }

      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch (e) {
        logger.warn('Unable to parse files data | reason=non-json-payload'
          + ` | dir=${dir} | user=${options.user || ''}`
          + ` | parseErr=${e && e.message}`
          + ` | payload=${JSON.stringify(payload.slice(0, 500))}`
          + ` | stderr=${JSON.stringify(errOut.slice(0, 500))}`);
        return cb(new Error('Unable to parse files data'));
      }

      // Structured error object => the target directory itself was unreadable
      // (permissions, junction/reparse point like "Mis documentos", etc).
      if (parsed && !Array.isArray(parsed) && parsed.error) {
        logger.warn(`Cannot read folder | dir=${dir}`
          + ` | user=${options.user || ''} | error=${parsed.error}`);
        return cb(new Error(`Cannot read folder: ${parsed.error}`));
      }

      if (!Array.isArray(parsed)) {
        logger.warn(`Unable to parse files data | reason=unexpected-shape | dir=${dir}`);
        return cb(new Error('Unable to parse files data'));
      }

      if (parsed.length === 0) {
        logger.info('without files in folder!');
        return cb(null, '[]');
      }

      process_files(parsed, cb);
    });
  };

  // On Windows, file retrieval runs in the active console session via safexec.
  // With no logged user (lock screen / user switch) that path yields empty or
  // contaminated stdout, so fail fast with a clear message instead.
  if (os_name === 'windows') {
    system.get_logged_user((userErr) => {
      if (userErr) {
        logger.warn(`File retrieval aborted: ${userErr && userErr.message}`);
        return cb(new Error('No active session for file retrieval'));
      }
      run_tree(0);
    });
  } else {
    run_tree(0);
  }
};

exports.get_file = () => {};
