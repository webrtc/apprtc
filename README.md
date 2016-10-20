[![Build Status](https://travis-ci.org/webrtc/apprtc.svg?branch=master)](https://travis-ci.org/webrtc/apprtc)

# AppRTC Demo Code

## Development

Detailed information on developing in the [webrtc](https://github.com/webrtc) github repo can be found in the [WebRTC GitHub repo developer's guide](https://docs.google.com/document/d/1tn1t6LW2ffzGuYTK3366w1fhTkkzsSvHsBnOHoDfRzY/edit?pli=1#heading=h.e3366rrgmkdk).

The development AppRTC server can be accessed by visiting [http://localhost:8080](http://localhost:8080).

Running AppRTC locally requires the [Google App Engine SDK for Python](https://cloud.google.com/appengine/downloads#Google_App_Engine_SDK_for_Python) and [Grunt](http://gruntjs.com/).

Detailed instructions for running on Ubuntu Linux are provided below.

### Running on Ubuntu Linux

Install grunt by first installing [npm](https://www.npmjs.com/). npm is
distributed as part of nodejs.

```
sudo apt-get install nodejs
sudo npm install -g npm
```

On Ubuntu 14.04 the default packages installs `/usr/bin/nodejs` but the `/usr/bin/node` executable is required for grunt. This is installed on some Ubuntu package sets; if it is missing, you can add this by installing the `nodejs-legacy` package,

```
sudo apt-get install nodejs-legacy
```

It is easiest to install a shared version of `grunt-cli` from `npm` using the `-g` flag. This will allow you access the `grunt` command from `/usr/local/bin`. More information can be found on [`gruntjs` Getting Started](http://gruntjs.com/getting-started).

```
sudo npm -g install grunt-cli
```

*Omitting the `-g` flag will install `grunt-cli` to the current directory under the `node_modules` directory.*

Finally, you will want to install grunt and required grunt dependencies. *This can be done from any directory under your checkout of the [webrtc/apprtc](https://github.com/webrtc/apprtc) repository.*

```
npm install
```

Before you start the AppRTC dev server and *everytime you update the source code you need to recompile the App Engine package by running,

```
grunt build
```

Start the AppRTC dev server from the `out/app_engine` directory by running the Google App Engine SDK dev server,

```
<path to sdk>/dev_appserver.py ./out/app_engine
```
Then navigate to http://localhost:8080 in your browser (given it's on the same machine).

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

### Deployment
Instructions were performed on Ubuntu 14.04 using Python 2.7.9 and Go 1.6.3.

1. Clone the AppRTC repository on the machine you want to host it on (git clone <this repo URL>)
2. Do all the steps in the [Collider instructions](https://github.com/webrtc/apprtc/blob/master/src/collider/README.md) then continue on step 3.
3. **(Only do this if you are using Google Cloud Engine VM's for Collider, otherwise go to step 4)** Open [src/app_engine/constants.py](https://github.com/webrtc/apprtc/blob/master/src/app_engine/constants.py#L60-L68) and change `WSS_INSTANCE_HOST_KEY WSS_`, `WSS_INSTANCE_NAME_KEY` and `WSS_INSTANCE_ZONE_KEY` to corresponding values for your VM instances in the Google Cloud Engine console.
4. Open [src/app_engine/constants.py](https://github.com/webrtc/apprtc/blob/master/src/app_engine/constants.py) and change `WSS_INSTANCE_HOST_KEY` to the hostname and port Collider is listening too, e.g. when running locally: `localhost:8089` or `otherHost:443`.
5. Install and start a Coturn TURN server according to the [instructions](https://github.com/coturn/coturn/wiki/CoturnConfig) on the project page.
6. Open [src/app_engine/constants.py](https://github.com/webrtc/apprtc/blob/master/src/app_engine/constants.py#L23-L40) and comment out [TURN_SERVER_OVERRIDE = []](https://github.com/webrtc/apprtc/blob/master/src/app_engine/constants.py#L23) and then uncomment [TURN_SERVER_OVERRIDE = [...]](https://github.com/webrtc/apprtc/blob/master/src/app_engine/constants.py#L26-L40) three lines below and fill your TURN server details, e.g.
```python
TURN_SERVER_OVERRIDE = [
  {
    "urls": [
      "turn:hostnameForYourTurnServer:19305?transport=udp",
      "turn:hostnameForYourTurnServer:19305?transport=tcp"
    ],
    "username": "TurnServerUsername",
    "credential": "TurnServerCredentials"
  },
  {
    "urls": [
      "stun:hostnameForYourStunServer:19302"
    ]
  }
]
```
7\. **(Only consider this if you skipped step 5 and 6)** AppRTC by default uses an ICE server provider to get TURN servers. Previously we used a [compute engine on demand service](https://github.com/juberti/computeengineondemand) (it created TURN server instances on demand in a region near the connecting users and stored them in shared memory) and web server with a REST API described in [draft-uberti-rtcweb-turn-rest-00](http://tools.ietf.org/html/draft-uberti-rtcweb-turn-rest-00). This has now been replaced with a Google service. It's similar from an AppRTC perspective but with a different [response format](https://github.com/webrtc/apprtc/blob/master/src/web_app/js/util.js#L77). You would have to setup this yourself or hard code your TURN servers in step 6.

8\. Now build AppRTC using `grunt build` and then start it using dev appserver provided by GAE
`pathToGAESDK/dev_appserver.py  out/app_engine/`.

9\. Open a WebRTC enabled browser and navigate to `http://localhost:8080` (`http://localhost:8080?wstls=false` if you have TLS disabled on Collider)

