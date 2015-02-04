'use strict';

/* globals module */

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

    htmlhint: {
      html1: {
        src: [
          'src/**/*_template.html'
        ]
      }
    },

    jscs: {
      src: 'src/**/*.js',
      options: {
        preset: 'google', // as per Google style guide – could use '.jscsrc' instead
        requireCurlyBraces: ['if']
      }
    },

    jshint: {
      options: {
        jshintrc: 'build/.jshintrc'
      },
      // files to validate
      // can choose more than one name + array of paths
      // usage with this name: grunt jshint:files
      files: ['src/**/*.js']
    },

    shell: {
      runPythonTests: {
        command: './build/run_python_tests.sh'
      },
      buildVersion: {
        command: './build/build_version_file.sh',
        options: {
          stdout: true,
          stderr: true
        }
      },
      buildAppEnginePackage: {
        command: './build/build_app_engine_package.sh',
        options: {
          stdout: true,
          stderr: true
        }
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
            cwd: 'out/app_engine',
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

    jstdPhantom: {
      options: {
        useLatest : true,
        port: 9876,
      },
      files: [
        'build/js_test_driver.conf',
      ]},

    closurecompiler: {
      debug: {
        files: {
          // Destination: [source files]
          'out/app_engine/js/apprtc.debug.js': [
            'src/web_app/js/adapter.js',
            'src/web_app/js/appcontroller.js',
            'src/web_app/js/call.js',
            'src/web_app/js/infobox.js',
            'src/web_app/js/peerconnectionclient.js',
            'src/web_app/js/roomselection.js',
            'src/web_app/js/sdputils.js',
            'src/web_app/js/signalingchannel.js',
            'src/web_app/js/stats.js',
            'src/web_app/js/storage.js',
            'src/web_app/js/util.js',
          ]
        },
        options: {
          'compilation_level': 'WHITESPACE_ONLY',
          'language_in': 'ECMASCRIPT5',
          'formatting': 'PRETTY_PRINT'
        },
      },
    },
  });

  // enable plugins
  grunt.loadNpmTasks('grunt-contrib-csslint');
  grunt.loadNpmTasks('grunt-htmlhint');
  grunt.loadNpmTasks('grunt-jscs');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-jstestdriver-phantomjs');
  grunt.loadNpmTasks('grunt-closurecompiler');
  grunt.loadTasks('build/grunt-chrome-build');

  // set default tasks to run when grunt is called without parameters
  grunt.registerTask('default', ['csslint', 'htmlhint', 'jscs', 'jshint',
                                 'shell:buildVersion', 'runPythonTests', 'jstests']);
  grunt.registerTask('runPythonTests', ['shell:buildAppEnginePackage', 'shell:runPythonTests']);
  grunt.registerTask('jstests', ['closurecompiler:debug', 'jstdPhantom']);
  grunt.registerTask('build', ['closurecompiler:debug', 'shell:buildVersion', 'shell:buildAppEnginePackage', 'grunt-chrome-build']);
  // also possible to call JavaScript directly in registerTask()
  // or to call external tasks with grunt.loadTasks()
};
