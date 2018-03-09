// Karma configuration
module.exports = function(config) {
  var browser = (process.env.BROWSER === '' || process.env.BROWSER === 'chrome')
      ? 'Chrome_no_sandbox' : process.env.BROWSER
  var travis = process.env.TRAVIS;
  var files = function() {
    // List of tests that can run in "any" browser.
    var filteredFiles = [
      'src/web_app/js/testpolyfills.js',
      'src/web_app/js/test_mocks.js',
      'out/app_engine/js/apprtc.debug.js',
      'src/web_app/js/appcontroller_test.js',
      'src/web_app/js/analytics_test.js',
      'src/web_app/js/call_test.js',
      'src/web_app/js/infobox_test.js',
      'src/web_app/js/peerconnectionclient_test.js',
      'src/web_app/js/remotewebsocket_test.js',
      'src/web_app/js/roomselection_test.js',
      'src/web_app/js/sdputils_test.js',
      'src/web_app/js/signalingchannel_test.js',
      'src/web_app/js/utils_test.js'
    ];
    if (browser.toLowerCase() === 'chrome') {
      // Chrome extension tests.
      filteredFiles.push('out/chrome_app/js/background.js');
      filteredFiles.push('src/web_app/js/background_test.js');
    }
    return filteredFiles;
  }

  let chromeFlags = [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--no-sandbox',
    '--headless', '--disable-gpu', '--remote-debugging-port=9222'
  ];
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'],

    // list of files / patterns to load in the browser
    // Make sure to have them in the correct order.
    files: files(),

    // list of files to exclude
    exclude: [
    ],

    // preprocess matching files before serving them to the browser
    // available preprocessors:
    // https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      // Enable this with the autoWatch feature below if you want eslint to run
      // on each file change.
      // 'src/web_app/js/*.js': ['eslint']
    },

    eslint: {
      stopOnError: false,
      stopOnWarning: false,
      showWarnings: true,
      engine: {
        configFile: 'build/.eslintrc'
      }
    },

    // Capture browser JavaScript console log output.
    client: {
      // Enable console capture on travis only.
      captureConsole: (travis) ? true : false
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress'],

    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR ||
    // config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    // Enable full logging on travis only.
    logLevel: (travis) ? config.LOG_DEBUG : config.LOG_DISABLE,

    // enable / disable watching file and executing tests whenever any file
    // changes
    autoWatch: false,

    // start these browsers
    // available browser launchers:
    // https://npmjs.org/browse/keyword/karma-launcher
    browsers: [browser[0].toUpperCase() + browser.substr(1)],

    customLaunchers: {
      Chrome_no_sandbox: {
        base: 'Chrome',
        flags: chromeFlags
      }
    },

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: 1
  })
}
