// Send the URL of the link on which the context menu was triggered
self.on('click', function(node) {
    self.postMessage(node.href);
});
