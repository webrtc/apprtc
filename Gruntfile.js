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
        src: ['src/html/index.html'
        ]
      }
    },

    jscs: {
      src: 'src/**/*.js',
      options: {
        preset: 'google', // as per Google style guide – could use '.jscsrc' instead
        'excludeFiles': [
        'src/js/adapter.js'
        ],
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
          buildDir: 'out/chrome-app',
          zipFile: 'out/chrome-app/apprtc.zip',
          // If values for chromeBinary and keyFile are not provided, the packaging
          // step will be skipped.
          // chromeBinary should be set to the Chrome executable on your system.
          chromeBinary: null,
          // keyFile should be set to the key you want to use to create the crx package
          keyFile: null
        },
        files: [
          {
            expand: true,
            cwd: 'out/app_engine',
            src: [
              '**/*.js',
              '**/*.css',
              '**/images/apprtc*.png',
              '!**/*.pem'
            ],
            dest: 'out/chrome-app/'
          },
          {
            expand: true,
            cwd: 'src',
            src: [
              'js/background.js',
              'js/appwindow.js',
              '!**/*.pem'
            ],
            dest: 'out/chrome-app/'
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
            'src/js/adapter.js',
            'src/js/appcontroller.js',
            'src/js/call.js',
            'src/js/infobox.js',
            'src/js/peerconnectionclient.js',
            'src/js/roomselection.js',
            'src/js/sdputils.js',
            'src/js/signalingchannel.js',
            'src/js/stats.js',
            'src/js/storage.js',
            'src/js/util.js',
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
                                 'shell:buildVersion', 'shell:runPythonTests',
                                 'shell:buildAppEnginePackage', 'jstests']);
  grunt.registerTask('jstests', ['closurecompiler:debug', 'jstdPhantom']);
  grunt.registerTask('build', ['closurecompiler:debug', 'shell:buildVersion', 'grunt-chrome-build', 'shell:buildAppEnginePackage']);
  // also possible to call JavaScript directly in registerTask()
  // or to call external tasks with grunt.loadTasks()
};
