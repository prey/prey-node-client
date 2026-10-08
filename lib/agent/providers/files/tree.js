// #!/usr/bin/env node
// @ts-check
/* eslint-disable no-console */
// This script's stdout IS its contract (consumed by files/index.js get_tree),
// so console output is intentional here.

/// //////////////////////////////////////
// Prey JS FileRetrieval
// (C) 2019 Prey, Inc.
// by Mauricio Schneider and Javier Acuña - http://preyproject.com
// GPLv3 Licensed
/// //////////////////////////////////////

/**
 * Traverses directories and returns their content.
 * Needed as stand-alone in order to be run as a specific user
 * due to read permissions on *nix systems.
 */

const fs = require('fs');
const path = require('path');
const mime = require('mime');

const { argv } = process;
const rootPath = argv[3];
const depth = parseInt(argv[2], 10) || 1;
const rootDepth = 1;
const osName = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

// Sentinels wrap the JSON payload so the consumer (get_tree) can extract it
// even if the impersonation launcher (safexec) prepends/merges extra bytes on
// stdout. On a directory-read failure we emit a structured error object instead
// of the literal "undefined", so the consumer can report an accurate message.
const PAYLOAD_START = '__PREY_TREE_START__';
const PAYLOAD_END = '__PREY_TREE_END__';

/**
 * @callback TreeDone
 * @param {(NodeJS.ErrnoException|null)} err
 * @param {Array<Object>=} res
 * @returns {void}
 */

/**
 * @param {string} dir
 * @param {number} currentDepth
 * @param {number} maxDepth
 * @param {TreeDone} done
 */
const directoryTreeToObj = (dir, currentDepth, maxDepth, done) => {
  /** @type {Object[]} */
  const resultsDir = [];
  /** @type {Object[]} */
  const resultsFile = [];
  const readDir = osName === 'windows' ? `${dir}\\` : dir;

  fs.readdir(readDir, (err, list) => {
    if (err) {
      done(err);
      return;
    }

    let pending = list.length;
    if (!pending) {
      done(null, resultsDir.concat(resultsFile));
      return;
    }

    // Fire the callback once every entry has been accounted for, whether it was
    // included, recursed into, or skipped. Missing this on the skip branch made
    // the walker hang (and emit nothing) whenever the last entry was skipped.
    const settle = () => {
      pending -= 1;
      if (!pending) done(null, resultsDir.concat(resultsFile));
    };

    list.forEach((entry) => {
      const file = path.resolve(readDir, entry);
      fs.stat(file, (statErr, stat) => {
        // The "Documents and Settings" folder on Windows is not accessible: it
        // is a compatibility link between OS versions, so it must be hidden in FR.
        if (statErr || (osName === 'windows' && path.basename(file) === 'Documents and Settings')) {
          settle();
          return;
        }

        const name = path.basename(file);
        const fullPath = path.join(path.dirname(file), name);

        if (stat && stat.isDirectory() && currentDepth < maxDepth) {
          directoryTreeToObj(file, currentDepth + 1, maxDepth, (childErr, res) => {
            resultsDir.push({
              name,
              path: fullPath,
              isFile: stat.isFile(),
              children: res,
            });
            settle();
          });
        } else if (stat) {
          const newFile = {
            name,
            path: fullPath,
            mimetype: mime.getType(file),
            size: stat.size,
            isFile: stat.isFile(),
          };
          if (stat.isFile()) resultsFile.push(newFile);
          else resultsDir.push(newFile);
          settle();
        } else {
          settle();
        }
      });
    });
  });
};

directoryTreeToObj(rootPath, rootDepth, depth, (err, res) => {
  if (err) console.error(err);

  let out;
  if (err || res === undefined || res === null) {
    const reason = err ? (err.code || err.message || 'unknown') : 'no-result';
    out = JSON.stringify({ error: reason, path: rootPath });
  } else {
    out = JSON.stringify(res);
  }

  console.log(PAYLOAD_START + out + PAYLOAD_END);
});
