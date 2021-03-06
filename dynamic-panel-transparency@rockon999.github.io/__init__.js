/* exported prefs */

/* Get the extension path. */
const Me = imports.misc.extensionUtils.getCurrentExtension();
const PREFS_PATH = Me['path'] + '/prefs.js/';

/* Add the prefs.js files to the searchPath */
if (imports.searchPath.indexOf(PREFS_PATH) === -1) {
    imports.searchPath.unshift(PREFS_PATH);
}

/* Define prefs so that imports can find it. */
const prefs = imports.preferences.main;