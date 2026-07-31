/* Compatibility loader: preserves parser behavior while installing the UI/UX refresh. */
(function loadSmartQuoteParser() {
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = './ux-refresh.css?v=1';
    document.head.appendChild(css);
    document.write('<script src="./parser-core-original.js"><\/script>');
    document.write('<script src="./ux-refresh.js?v=1"><\/script>');
})();
