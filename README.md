[![Build Status](https://travis-ci.org/webrtc/apprtc.svg?branch=master)](https://travis-ci.org/webrtc/apprtc)

# AppRTC Demo Code

## Development

Detailed information on devloping in the [webrtc](https://github.com/webrtc) github repo can be found in the [WebRTC GitHub repo developer's guide](https://docs.google.com/document/d/1tn1t6LW2ffzGuYTK3366w1fhTkkzsSvHsBnOHoDfRzY/edit?pli=1#heading=h.e3366rrgmkdk).

The development AppRTC server can be accessed by visiting [http://localhost:8080](http://localhost:8080).

Running AppRTC locally requires the [Google App Engine SDK for Python](https://cloud.google.com/appengine/downloads#Google_App_Engine_SDK_for_Python) and [Grunt](http://gruntjs.com/).

Detailed instructions for running on Ubuntu Linux are provided below.

### Running on Ubuntu Linux

Install grunt by first installing [npm](https://www.npmjs.com/),

```
sudo apt-get install npm
```

On Ubuntu 14.04 the default packages installs `/usr/bin/nodejs` but the `/usr/bin/node` executable is required for grunt. You can add this by installing the `nodejs-legacy` package,

```
sudo apt-get install nodejs-legacy
```

It is easiest to install a shared version of `grunt-cli` from `npm` using the `-g` flag. This will allow you access the `grunt` command from `/usr/local/bin`. More information can be found on [`gruntjs` Getting Started](http://gruntjs.com/getting-started).

```
sudo npm -g install grunt-cli
```

*Omitting the `-g` flag will install `grunt-cli` to the current directory under the `node_modules` directory.*

Finally, you will want to install grunt and required grunt dependencies. *This can be done from any directory under your checkout of the [GoogleChrome/webrtc](https://github.com/GoogleChrome/webrtc) repository.*

```
npm install
```

Before you start the AppRTC dev server and *everytime you update the source code you need to recompile the App Engine package by running,

```
grunt build
```

See GCM section below about compiling the package with a GCM API key. Start the AppRTC dev server from the `out/app_engine` directory by running the Google App Engine SDK dev server,

```
<path to sdk>/dev_appserver.py ./out/app_engine
```

### Testing

All tests by running `grunt`.

To run only the Python tests you can call,

```
grunt runPythonTests
```

### Enabling Local Logging

*Note that logging is automatically enabled when running on Google App Engine using an implicit service account.*

By default, logging to a BigQuery from the development server is disabled. Log information is presented on the console. Unless you are modifying the analytics API you will not need to enable remote logging.

Logging to BigQuery when running LOCALLY requires a `secrets.json` containing Service Account credentials to a Google Developer project where BigQuery is enabled. DO NOT COMMIT `secrets.json` TO THE REPOSITORY.

To generate a `secrets.json` file in the Google Developers Console for your project:
1. Go to the project page.
1. Under *APIs & auth* select *Credentials*.
1. Confirm a *Service Account* already exists or create it by selecting *Create new Client ID*.
1. Select *Generate new JSON key* from the *Service Account* area to create and download JSON credentials.
1. Rename the downloaded file to `secrets.json` and place in the directory containing `analytics.py`.

When the `Analytics` class detects that AppRTC is running locally, all data is logged to `analytics` table in the `dev` dataset. You can bootstrap the `dev` dataset by following the instructions in the [Bootstrapping/Updating BigQuery](#bootstrappingupdating-bigquery).

## GCM

Call notifications are sent and received using GCM. In order for the server to send GCM messages, an API key is required. This key should be obtained from the developer console for the app engine project. It should be placed in a file named gcm_api_key in the following location:

```
out/app_engine/gcm_api_key
```

This must be provided for GCM notifications to work correctly. See internal documentation (Google only) for a script that will generate this for you.

## PyCrypto

We use the PyCrypto module for AES encryption and SHA256 hashing. This module is not included in the Google AppEngine SDK. In order to run a local development server, please install PyCrypto into your local site-packages directory. You can download it from:

https://pypi.python.org/pypi/pycrypto

If using pip or easy_install you may run into egg problems with the dev appserver; if so, install the module manually.

Two files should be provided, one named aes_key and another named hash_salt. They should contain the relevant encryption key and hash salt and be placed in:

```
out/app_engine/aes_key
out/app_engine/hash_salt
```

These must be provided for encryption to work correctly. See internal documentation (Google only) for a script that will generate this for you.

## BigQuery

When running on App Engine the `Analytics` class will log to `analytics` table in the `prod` dataset for whatever project is defined in `app.yaml`.

### Schema

`bigquery/analytics_schema.json` contains the fields used in the BigQuery table. New fields can be added to the schema and the table updated. However, fields *cannot* be renamed or removed. *Caution should be taken when updating the production table as reverting schema updates is difficult.*

Update the BigQuery table from the schema by running,

```
bq update -t prod.analytics bigquery/analytics_schema.json
```

### Bootstrapping

Initialize the required BigQuery datasets and tables with the following,

```
bq mk prod
bq mk -t prod.analytics bigquery/analytics_schema.json
```
