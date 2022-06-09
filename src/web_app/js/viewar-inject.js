function injectScript(url, alternativeUrl) {
  return new Promise(function(resolve, reject) {
    var script = document.createElement('script');

    if (urlExists(url)) {
      script.src = url;
    } else if(alternativeUrl) {
      script.src = alternativeUrl;
    } else {
      resolve();
    }

    script.onload = resolve.bind(this);
    script.onerror = reject.bind(this);
    document.body.appendChild(script);
  });
}

function urlExists(url) {
  const http = new XMLHttpRequest();
  http.open('HEAD', url, false);
  http.send();
  return http.status !== 404;
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
    const url = 'https://api.viewar.com/api20/configuration/bundleidentifier:' + appId + '/version:' + appVersion;
    console.log('[Inject] Configuration: ' + url);
    xhr.open('GET', url, true);
    xhr.send();
  });
}

window.inject = function(
  // appId = 'com.viewar.servicear.dev', appVersion = '100', coreVersion
  appId = 'com.viewar.streamingbare', appVersion = '100', coreVersion
) {
  console.log('[Inject] app ' + appId + ' ' + appVersion + '(core: ' + coreVersion + ')');

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
    document.head.appendChild(base);

    let coreFileAlternative;
    let coreFile;
    if (coreVersion) {
      coreFile = 'https://webversion.viewar.com/versions/' + coreVersion + '/viewar-core.js';
      coreFileAlternative = `https://unpkg.com/viewar-core@${coreVersion}/viewar-core.js`;
    } else {
      coreFile = `${window.location.origin}/js/ViewAR.js`;
    }

    Promise.resolve()
        .then(() => injectScript(coreFile, coreFileAlternative))
        .then(() => injectScript(vendorFile))
        .then(() => injectScript(indexFile));
  });
};
