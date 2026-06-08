/**
 * Orignest Pre-Qual Widget Embed Script
 * Usage: Add to your HTML page, then paste the snippet from your widget settings.
 *
 * Auto-snippet (replace WIDGET_TOKEN with your token from Settings > Widget):
 *
 *   <div id="orignest-widget"></div>
 *   <script src="https://app.orignest.com/orignest-widget.js" data-token="WIDGET_TOKEN"></script>
 *
 * Or manual:
 *
 *   <div id="orignest-widget"></div>
 *   <script>
 *   (function(w,d,t,o){
 *     var f=d.createElement(t);
 *     f.src='https://app.orignest.com/widget/'+o;
 *     f.style='border:none;width:100%;min-height:600px;';
 *     var c=d.getElementById('orignest-widget');
 *     if(c)c.appendChild(f);
 *   })(window,document,'iframe','WIDGET_TOKEN');
 *   </script>
 */

(function () {
  'use strict';

  var BASE_URL = 'https://app.orignest.com';

  function embed(containerId, token) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.warn('[Orignest] Container #' + containerId + ' not found.');
      return;
    }

    var iframe = document.createElement('iframe');
    iframe.src = BASE_URL + '/widget/' + token;
    iframe.style.border = 'none';
    iframe.style.width = '100%';
    iframe.style.minHeight = '620px';
    iframe.style.maxWidth = '420px';
    iframe.style.display = 'block';
    iframe.style.margin = '0 auto';
    iframe.setAttribute('title', 'Mortgage Pre-Qualification');
    iframe.setAttribute('loading', 'lazy');

    // Respond to height messages from widget
    window.addEventListener('message', function (e) {
      if (e.origin !== BASE_URL) return;
      if (e.data && e.data.type === 'orignest-resize') {
        iframe.style.height = e.data.height + 'px';
      }
    });

    container.appendChild(iframe);
  }

  // Auto-init from script data attribute
  var scripts = document.querySelectorAll('script[data-token]');
  for (var i = 0; i < scripts.length; i++) {
    var s = scripts[i];
    var token = s.getAttribute('data-token');
    var containerId = s.getAttribute('data-container') || 'orignest-widget';
    if (token) {
      embed(containerId, token);
    }
  }

  // Expose for manual init
  window.OrignestWidget = { embed: embed };
})();
