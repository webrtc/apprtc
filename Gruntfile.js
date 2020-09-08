'use strict';

/* globals module */
var out_app_engine_dir = 'out/app_engine';
var app_engine_path = 'temp/google-cloud-sdk/platform/google_appengine'
// Check if running on travis, if so do not install in User due to using
// pythonEnv.
var isTravis = ('TRAVIS' in process.env && 'CI' in process.env) ?
    '' : '--user';

module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt);

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
      copyAdapter: {
        command: ['python', './build/copy_portable.py',
                  'node_modules/webrtc-adapter/out/adapter.js',
                  'src/web_app/js/adapter.js'].join(' ')
      },
      copyJsFiles: {
        command: ['python', './build/copy_js_files.py',
                  'src/web_app/js', out_app_engine_dir + '/js'].join(' ')
      },
      runUnitTests: {
        command: 'bash ./build/start-tests.sh'
      },
    },
    karma: {
      unit: {
        configFile: 'karma.conf.js'
      }
    }
  });

  // Set default tasks to run when grunt is called without parameters.
  grunt.registerTask('default', ['runLinting', 'runPythonTests', 'build',
                                 'runUnitTests']);
  grunt.registerTask('runLinting', ['csslint', 'eslint']);
  grunt.registerTask('runPythonTests', ['shell:pipInstall',
                                        'shell:ensureGcloudSDKIsInstalled',
                                        'shell:buildAppEnginePackageWithTests',
                                        'shell:runPythonTests',
                                        'shell:removePythonTestsFromOutAppEngineDir']);
  grunt.registerTask('runUnitTests', [
                     'shell:genJsEnums', 'shell:copyAdapter', 'shell:runUnitTests']),
  grunt.registerTask('build', ['shell:buildAppEnginePackage',
                               'shell:genJsEnums',
                               'shell:copyAdapter',
                               'shell:copyJsFiles']);
};
