self.port.on('replace', function(data) {
    var urls = JSON.parse(data);

    // Strip the protocol from the URLs
    // (We will use these to look for, and replace, any mentions of the old URL
    // in the anchor text.)
    var coreURL = /.+:\/\/(.*)/;
    var oldURLCore = new RegExp(coreURL.exec(urls.oldURL)[1]);
    var newURLCore = coreURL.exec(urls.newURL)[1];

    var links = document.querySelectorAll('a[href="' + urls.oldURL + '"]');

    // links is a NodeList, not an array, so we can't iterate over it directly
    // But we can do this (via https://developer.mozilla.org/en/DOM/NodeList):
    Array.prototype.forEach.call(links, function(link) {
        link.href = urls.newURL;
        link.innerHTML = link.innerHTML.replace(oldURLCore, newURLCore);
    });
});

self.port.on('autoreplace', function() {
    var links = document.querySelectorAll('a[href]');
    Array.prototype.forEach.call(links, function(link) {
        self.postMessage(link.href);
    });
});
