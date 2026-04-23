/**
 * Prey Switcher Sudoers Management
 * Updates sudoers configuration for the prey user
 */

const fs = require('fs');
const { exec } = require('child_process');
const common = require('./../common');
const shared = require('./shared');

const USER_NAME = 'prey';
const SUDOERS_FILE_50 = `/etc/sudoers.d/50_${USER_NAME}_switcher`;
const SUDOERS_FILE_51 = `/etc/sudoers.d/51_${USER_NAME}_switcher`;

// Commands that prey user can run with sudo
const SU_CMD = '/usr/bin/su';
const SUDOERS_ARGS = `${SU_CMD} [A-z]*, !${SU_CMD} root*, !${SU_CMD} -*`;

/**
 * Get additional commands for sudoers based on available system tools
 * Returns commands in the order: iwlist, dmidecode, nmcli
 */
const getAdditionalCommands = (callback) => {
  const toolsToCheck = [
    { cmd: 'iwlist', order: 1 },
    { cmd: 'dmidecode', order: 2 },
    { cmd: 'nmcli', order: 3 }
  ];

  const results = [];
  let checked = 0;

  const checkTool = (tool) => {
    exec(`which ${tool.cmd}`, { timeout: 5000 }, (err, stdout) => {
      if (!err && stdout.trim()) {
        results.push({
          path: stdout.trim(),
          order: tool.order
        });
      }
      checked++;
      if (checked === toolsToCheck.length) {
        // Sort by order and return only paths
        const sortedCommands = results
          .sort((a, b) => a.order - b.order)
          .map(item => item.path);
        callback(sortedCommands);
      }
    });
  };

  toolsToCheck.forEach(tool => checkTool(tool));
};

/**
 * Remove old sudoers file (version 50)
 */
const removeOldFile = (callback) => {
  fs.access(SUDOERS_FILE_50, fs.constants.F_OK, (err) => {
    if (err) {
      // File doesn't exist, nothing to remove
      return callback(null);
    }

    shared.log(`Removing old sudoers file: ${SUDOERS_FILE_50}`);
    exec(`rm -rf "${SUDOERS_FILE_50}"`, { timeout: 10000 }, (error) => {
      if (error) {
        return callback(new Error(`Failed to remove old sudoers file: ${error.message}`));
      }
      shared.log('Old sudoers file removed successfully');
      callback(null);
    });
  });
};

/**
 * Create new sudoers file (version 51)
 */
const createNewFile = (additionalCommands, callback) => {
  // Check if file already exists
  fs.access(SUDOERS_FILE_51, fs.constants.F_OK, (err) => {
    if (!err) {
      shared.log(`Sudoers file already exists: ${SUDOERS_FILE_51}`);
      return callback(null, false); // false = not created (already exists)
    }

    // Build sudoers line with additional commands
    let sudoersArgs = SUDOERS_ARGS;
    if (additionalCommands.length > 0) {
      sudoersArgs = additionalCommands.join(', ') + ', ' + SUDOERS_ARGS;
    }

    const sudoersLine = `${USER_NAME} ALL=(ALL) NOPASSWD: ${sudoersArgs}`;

    // Ensure /etc/sudoers.d directory exists
    exec('mkdir -p /etc/sudoers.d', { timeout: 10000 }, (mkdirErr) => {
      if (mkdirErr) {
        return callback(new Error(`Failed to create sudoers.d directory: ${mkdirErr.message}`));
      }

      // Make sure sudo includes files from /etc/sudoers.d
      exec('grep -q "^#includedir.*/etc/sudoers.d" /etc/sudoers || echo "#includedir /etc/sudoers.d" >> /etc/sudoers', { timeout: 10000 }, (grepErr) => {
        if (grepErr) {
          shared.log('Warning: Could not verify sudoers includes directive');
        }

        // Create the sudoers file with proper permissions (0440)
        const createCmd = `umask 226 && echo "${sudoersLine}" > "${SUDOERS_FILE_51}"`;
        exec(createCmd, { timeout: 10000 }, (createErr) => {
          if (createErr) {
            return callback(new Error(`Failed to create sudoers file: ${createErr.message}`));
          }

          shared.log(`Created new sudoers file: ${SUDOERS_FILE_51}`);
          callback(null, true); // true = created successfully
        });
      });
    });
  });
};

/**
 * Test impersonation to verify sudoers configuration works
 */
const testImpersonation = (callback) => {
  // Get an existing user to test impersonation
  exec("cat /etc/passwd | grep -E 'home.*bash' | tail -1 | cut -d':' -f1", { timeout: 5000 }, (err, stdout) => {
    if (err || !stdout.trim()) {
      shared.log('Warning: Could not find user to test impersonation');
      return callback(null); // Don't fail, just warn
    }

    const testUser = stdout.trim();
    shared.log(`Testing impersonation from ${USER_NAME} to ${testUser}...`);

    const testCmd = `sudo su ${USER_NAME} -c "sudo su ${testUser} -c whoami"`;
    exec(testCmd, { timeout: 15000 }, (testErr, testStdout) => {
      if (testErr || testStdout.trim() !== testUser) {
        shared.log('Warning: Impersonation test failed. You may need to verify sudoers configuration manually.');
        return callback(null); // Don't fail, just warn
      }

      shared.log('Impersonation test passed!');
      callback(null);
    });
  });
};

/**
 * Update switcher sudoers configuration
 * Main entry point for the update_switcher command
 */
exports.update = (values, callback) => {
  // Handle both (callback) and (values, callback) signatures
  if (typeof values === 'function') {
    callback = values;
    values = null;
  }

  // Ensure running as root
  if (process.getuid && process.getuid() !== 0) {
    return callback(new Error('This command must be run as root (sudo)'));
  }

  // Ensure running on Linux
  if (process.platform !== 'linux') {
    return callback(new Error('This command is only available on Linux'));
  }

  shared.log('Starting switcher sudoers update...');

  // Step 1: Get additional commands based on available tools
  getAdditionalCommands((additionalCommands) => {
    shared.log(`Found ${additionalCommands.length} additional system tools`);

    // Step 2: Remove old file (version 50)
    removeOldFile((removeErr) => {
      if (removeErr) {
        return callback(removeErr);
      }

      // Step 3: Create new file (version 51)
      createNewFile(additionalCommands, (createErr, created) => {
        if (createErr) {
          return callback(createErr);
        }

        if (!created) {
          shared.log('Sudoers file already up to date');
          return callback(null, 'Switcher sudoers already configured (version 51)');
        }

        // Step 4: Test impersonation (optional, won't fail if test fails)
        testImpersonation((testErr) => {
          if (testErr) {
            return callback(testErr);
          }

          callback(null, 'Switcher sudoers updated successfully (version 51)');
        });
      });
    });
  });
};
