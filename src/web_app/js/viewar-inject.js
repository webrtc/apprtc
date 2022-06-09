function injectScript(url) {
  return new Promise(function(resolve, reject) {
    var script = document.createElement('script');
    script.src = url;
    script.onload = resolve.bind(this);
    script.onerror = reject.bind(this);
    document.body.appendChild(script);
  });
}

// function injectStyle(url) {
//   return new Promise(function(resolve, reject) {
//     var link = document.createElement('link');
//     link.rel = 'stylesheet';
//     link.type = "text/css";
//     link.href = url;
//     link.onload = resolve.bind(this);
//     link.onerror = reject.bind(this);

//     document.head.appendChild(link);
//   });
// }

// function loadFile() {
//   return new Promise(function(resolve) {
//     var xhttp = new XMLHttpRequest();
//     xhttp.onreadystatechange = function() {
//       if (this.readyState === 4 && this.status === 200) {
//         resolve(this.responseText);
//       }
//     };
//     xhttp.open('GET', 'ajax_info.txt', true);
//     xhttp.send();
//   });
// }

function getBase64EncodedAppFiles(appId, appVersion) {
  return new Promise(function(resolve) {
    // Get app files url.
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (this.readyState === 4 && this.status === 200) {
        const appConfig = JSON.parse(this.responseText);
        resolve(btoa(encodeURIComponent(appConfig.config.appFiles)));
      }
    };
    const url = 'https://api.viewar.com/api20/configuration/bundleidentifier:' + appId + '/fakeversion:' + appVersion;
    console.log('[Inject] Configuration: ' + url);
    xhr.open('GET', url, true);
    xhr.send();
  });
}

window.inject = function(
  // appId = 'com.viewar.servicear.dev', appVersion = '100'
  appId = 'com.viewar.streamingbare', appVersion = '100'
) {
  console.log('[Inject] app ' + appId + ' ' + appVersion);

  window.bundleIdentifier = appId;
  window.bundleVersion = appVersion;

  getBase64EncodedAppFiles(appId, appVersion).then(appFiles => {
    console.log('[inject] appFiles: ' + appFiles);
    const vendorFile = 'https://webversion.viewar.com/web/action:proxy/appFiles:' + appFiles + '/vendor~index.js';
    const indexFile = 'https://webversion.viewar.com/web/action:proxy/appFiles:' + appFiles + '/index.js';

    // Set base url for images.
    const base = document.createElement('base');
    base.setAttribute('href', 'https://webversion.viewar.com/web/action:proxy/appFiles:' + appFiles + '/');
    base.setAttribute('target', 'self');
    // document.head.appendChild(base);

    // const coreFile = 'https://webversion.viewar.com/versions/' + coreVersion + '/viewar-core.js';
    const coreFile = 'https://webversion.viewar.com/versions/11.113.47/viewar-core.js';

    // TODO: Inject html content directly, but probably only
    // possible in php (because of CORS policy restriction).
    // const htmlFile =
    //      `https://webversion.viewar.com/web/action:proxy/appFiles:${appFiles}/index.html`;
    // const htmlContent = await loadFile(htmlFile):

    Promise.resolve()
    // Don't inject core file, gives us a stack error somewhere.
    // Just include it as script directly in the html.
        .then(() => injectScript(coreFile))
        .then(() => injectScript(vendorFile))
        .then(() => injectScript(indexFile));
  });
};
