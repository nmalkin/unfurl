(function() {
"use strict";

/*global console:false, require:false */

var contextMenu = require('context-menu');
var Request = require('request').Request;
var preferences = require('simple-prefs');
var self = require('self');
var tabs = require('tabs');

/** Logs the given log */
function log(message) {
    console.log(message);
}

/**
 * Returns a copy of the object, with the keys converted to lower case.
 *
 * (Note: this is not a deep copy; only the property references are copied
 * over.)
 */
function lowerCaseObjectProperties(obj) {
    var newObj = {};

    for(var key in obj) {
        newObj[key.toLowerCase()] = obj[key];
    }

    return newObj;
}

/**
 * Retrieves the true ("unfurled") location of given URL from the server,
 * calls callback with it.
 * If there is no redirection, or if anything goes wrong, the callback will be
 * called with the original URL.
 */
function unfurlURL(url, callback) {
    var request = new Request({
        url: preferences.prefs.server + '?url=' + encodeURIComponent(url),
        onComplete: function(response) {
            if(response.status === 0) {
                console.log('Failed to reach the Unfurl server');
            }

            switch(parseInt(response.status, 10)) {
                case 200: // Successfully identified redirect
                    callback(response.json.location);
                    break;
                case 204: // Server couldn't identify redirect
                case 500: // Server had some other problem
                default:
                    // We say the unfurled URL is the original one
                    callback(url);
                    break;
            }
            return;
        }
    }).get();
}

/**
 * Replaces the old URL in the current tab with the new one
 */
function replaceURL(oldURL, newURL) {
    var worker = tabs.activeTab.attach({
        contentScriptFile: self.data.url('replaceURL.js')
    });

    worker.port.emit('replace', JSON.stringify({
        oldURL: oldURL,
        newURL: newURL
    }));
}

/**
 * Handles message from context menu listener. The message received is the URL
 * of the clicked link.
 */
function handleLinkClick(url) {
    var unfurlAndReplace = function(url, callback) {
        unfurlURL(url, function(unfurled) {
            replaceURL(url, unfurled);
            callback(unfurled);
        });
    };

    // Follow links up to a depth specified by the preferences
    var i = 0;
    var unfurlAgain = function(url) {
        if(i < preferences.prefs.depth) {
            i++;
            unfurlAndReplace(url, unfurlAgain);
        }
    };

    unfurlAgain(url);
}

// Add a context menu to all links
contextMenu.Item({
    label: 'Unfurl',
    context: contextMenu.SelectorContext('a[href]'),
    contentScriptFile: self.data.url('linkClick.js'),
    onMessage: handleLinkClick
});

})();
