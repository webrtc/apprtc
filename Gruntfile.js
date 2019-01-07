'use strict';

/* globals module */
var out_app_engine_dir = 'out/app_engine';
var app_engine_path = 'temp/google-cloud-sdk/platform/google_appengine'
// Check if running on travis, if so do not install in User due to using
// pythonEnv.
var isTravis = ('TRAVIS' in process.env && 'CI' in process.env) ?
    '' : '--user';

module.exports = function(grunt) {
  // configure project
  grunt.initConfig({
    // make node configurations available
    pkg: grunt.file.readJSON('package.json'),

    csslint: {
      options: {
        csslintrc: 'build/.csslintrc'
      },
      strict: {
        options: {
          import: 2
        },
        src: ['src/**/*.css'
        ]
      },
      lax: {
        options: {
          import: false
        },
        src: ['src/**/*.css'
        ]
      }
    },

    htmllint: {
      all: {
        src: [
          'src/**/*_template.html'
        ]
      }
    },
    eslint: {
      options: {
        configFile: 'build/.eslintrc'
      },
      target: ['src/**/*.js', '!src/**/enums.js', '!src/**/adapter.js' ]
    },

    shell: {
      pipInstall : {
        command: ['pip install', isTravis, '--requirement requirements.txt']
            .join(' ')
      },
      ensureGcloudSDKIsInstalled: {
        command: 'python build/ensure_gcloud_sdk_is_installed.py'
      },
      runPythonTests: {
        command: ['python', 'build/run_python_tests.py',
                  app_engine_path, out_app_engine_dir].join(' ')
      },
      buildAppEnginePackage: {
        command: ['python', './build/build_app_engine_package.py', 'src',
                  out_app_engine_dir].join(' ')
      },
      buildAppEnginePackageWithTests: {
        command: ['python', './build/build_app_engine_package.py', 'src',
                  out_app_engine_dir, '--include-tests'].join(' ')
      },
      removePythonTestsFromOutAppEngineDir: {
        command: ['python', './build/remove_python_tests.py',
                  out_app_engine_dir].join(' ')
      },
      genJsEnums: {
        command: ['python', './build/gen_js_enums.py', 'src',
                  'src/web_app/js'].join(' ')
      },
      runUnitTests: {
        command: 'bash ./build/start-tests.sh'
      }
    },

    'grunt-chrome-build' : {
      apprtc: {
        options: {
          buildDir: 'out/chrome_app',
          zipFile: 'out/chrome_app/apprtc.zip',
          // If values for chromeBinary and keyFile are not provided, the packaging
          // step will be skipped.
          // chromeBinary should be set to the Chrome executable on your system.
          chromeBinary: null,
          // keyFile should be set to the key you want to use to create the crx package
          keyFile: null,
          appwindowHtmlSrc: 'src/web_app/html/index_template.html',
          appwindowHtmlDest: 'out/chrome_app/appwindow.html'
        },
        files: [
          {
            expand: true,
            cwd: 'src/web_app/chrome_app',
            src: [
              'manifest.json'
            ],
            dest: 'out/chrome_app/'
          },
          {
            expand: true,
            cwd: out_app_engine_dir,
            src: [
              '**/*.js',
              '**/*.css',
              '**/images/apprtc*.png',
              '!**/*.pem'
            ],
            dest: 'out/chrome_app/'
          },
          {
            expand: true,
            cwd: 'src/web_app',
            src: [
              'js/background.js',
              'js/appwindow.js',
              '!**/*.pem'
            ],
            dest: 'out/chrome_app/'
          }
        ],
      }
    },

    closurecompiler: {
      debug: {
        files: {
          // Destination: [source files]
          'out/app_engine/js/apprtc.debug.js': [
            'node_modules/webrtc-adapter/out/adapter.js',
            'src/web_app/js/analytics.js',
            'src/web_app/js/enums.js',
            'src/web_app/js/appcontroller.js',
            'src/web_app/js/call.js',
            'src/web_app/js/constants.js',
            'src/web_app/js/infobox.js',
            'src/web_app/js/peerconnectionclient.js',
            'src/web_app/js/remotewebsocket.js',
            'src/web_app/js/roomselection.js',
            'src/web_app/js/sdputils.js',
            'src/web_app/js/signalingchannel.js',
            'src/web_app/js/stats.js',
            'src/web_app/js/storage.js',
            'src/web_app/js/util.js',
            'src/web_app/js/windowport.js',
          ]
        },
        options: {
          'compilation_level': 'WHITESPACE_ONLY',
          'language_in': 'ECMASCRIPT5',
          'formatting': 'PRETTY_PRINT'
        },
      },
    },
    karma: {
      unit: {
        configFile: 'karma.conf.js'
      }
    }
  });

  // Enable plugins.
  grunt.loadNpmTasks('grunt-contrib-csslint');
  grunt.loadNpmTasks('grunt-html');
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-closurecompiler-new-grunt');
  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadTasks('build/grunt-chrome-build');

  // Set default tasks to run when grunt is called without parameters.
  grunt.registerTask('default', ['runLinting', 'runPythonTests', 'build',
                                 'runUnitTests']);
  grunt.registerTask('runLinting', ['csslint', 'eslint']);
  grunt.registerTask('runPythonTests', ['shell:pipInstall',
                                        'shell:ensureGcloudSDKIsInstalled',
                                        'shell:buildAppEnginePackageWithTests',
                                        'shell:runPythonTests',
                                        'shell:removePythonTestsFromOutAppEngineDir']);
  grunt.registerTask('runUnitTests', ['shell:runUnitTests']),
  grunt.registerTask('build', ['shell:buildAppEnginePackage', 'shell:genJsEnums', 'closurecompiler:debug', 'grunt-chrome-build']);
};
