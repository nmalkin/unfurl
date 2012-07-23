function replaceURL(oldURL, newURL) {
    // Strip the protocol from the URLs
    // (We will use these to look for, and replace, any mentions of the old URL
    // in the anchor text.)
    var coreURL = /.+:\/\/(.*)/;
    var oldURLCore = null,
        newURLCore = null;
    try {
        oldURLCore = new RegExp(coreURL.exec(oldURL)[1]);
        newURLCore = coreURL.exec(newURL)[1];
    } catch(e) {}

    var links = document.querySelectorAll('a[href="' + oldURL + '"]');

    // links is a NodeList, not an array, so we can't iterate over it directly
    // But we can do this (via https://developer.mozilla.org/en/DOM/NodeList):
    Array.prototype.forEach.call(links, function(link) {
        link.href = newURL;
        link.innerHTML = link.innerHTML.replace(oldURLCore, newURLCore);
    });
}

function autoReplace() {
    var thisHost = window.location.hostname;
    var host = /.+:\/\/([^\/]+)\//;

    var links = document.querySelectorAll('a[href]');
    Array.prototype.forEach.call(links, function(link) {
        // Find the origin (hostname) of this link
        var curHost = null;
        var match = host.exec(link.href);
        if(match) {
            curHost = match[1];
        }

        // Only unfurl URLs with a different origin
        if(curHost !== thisHost) {
            self.postMessage(link.href);
        }
    });
}

self.port.on('replace', function(data) {
    var urls = JSON.parse(data);
    replaceURL(urls.oldURL, urls.newURL);
});

self.port.on('autoreplace', function() {
    autoReplace();
});
