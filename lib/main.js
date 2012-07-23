(function() {
"use strict";

/*global console:false, require:false */

var contextMenu = require('context-menu');
var Request = require('request').Request;
var pageMod = require('page-mod');
var preferences = require('simple-prefs');
var self = require('self');
var tabs = require('tabs');
var widget = require('widget');

/** Automatically unfurl on pages? */
var autoEnabled = false;

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
 * Tells the worker to replace the old URL with the new one
 */
function replaceURL(oldURL, newURL, worker) {
    worker.port.emit('replace', JSON.stringify({
        oldURL: oldURL,
        newURL: newURL
    }));
}

/** Unfurl and replace links in the given worker */
function handleURL(url, worker) {
    var unfurlAndReplace = function(url, callback) {
        unfurlURL(url, function(unfurled) {
            try {
                replaceURL(url, unfurled, worker);
                // callback is only called if replacement succeeded
                // (If it failed at one level, no reason to go deeper.)
                callback(unfurled);
            } catch(e) {
                console.log('replaceURL failed due to exception', e);
            }
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

/**
 * Handles message from context menu listener. The message received is the URL
 * of the clicked link.
 */
function handleLinkClick(url) {
    var worker = tabs.activeTab.attach({
        contentScriptFile: self.data.url('replaceURL.js')
    });

    handleURL(url, worker);
}

// Add a context menu to all links
contextMenu.Item({
    label: 'Unfurl',
    context: contextMenu.SelectorContext('a[href]'),
    contentScriptFile: self.data.url('linkClick.js'),
    onMessage: handleLinkClick
});

(function() {
    var unfurlWidget, unfurlPageMod = null;

    var enabledIcon = self.data.url('spiral.png'),
        disabledIcon = self.data.url('spiral-gray.png');
    var enabledText = "Unfurl: click to stop expanding links automatically",
        disabledText = "Unfurl: click to expand links automatically";

    function toggleEnabled() {
        autoEnabled = ! autoEnabled;

        if(autoEnabled) {
            unfurlWidget.contentURL = enabledIcon;
            unfurlWidget.tooltip = enabledText;

            unfurlPageMod = new pageMod.PageMod({
                include: ['*'],
                contentScriptFile: self.data.url('replaceURL.js'),
                contentScriptWhen: 'ready',
                onAttach: function(worker) {
                    worker.on('message', function(url) {
                        handleURL(url, worker);
                    });

                    worker.port.emit('autoreplace');
                }
            });
            
            // Also attach to, and activate, the current page
            var curPageWorker = tabs.activeTab.attach({
                contentScriptFile: self.data.url('replaceURL.js')
            });
            curPageWorker.on('message', function(url) {
                handleURL(url, curPageWorker);
            });
            curPageWorker.port.emit('autoreplace');
        } else {
            unfurlWidget.contentURL = disabledIcon;
            unfurlWidget.tooltip = disabledText;

            if(unfurlPageMod) {
                unfurlPageMod.destroy();
                unfurlPageMod = null;
            }
        }
    }

    unfurlWidget = widget.Widget({
        id: 'unfurl',
        label: 'Unfurl',
        contentURL: enabledIcon,
        onClick: toggleEnabled
    });

    toggleEnabled();
})();

})();
