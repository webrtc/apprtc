[![Build Status](https://travis-ci.org/webrtc/apprtc.svg?branch=master)](https://travis-ci.org/webrtc/apprtc)

# AppRTC Demo Code

## Development

Detailed information on developing in the [webrtc](https://github.com/webrtc) github repo can be found in the [WebRTC GitHub repo developer's guide](https://docs.google.com/document/d/1tn1t6LW2ffzGuYTK3366w1fhTkkzsSvHsBnOHoDfRzY/edit?pli=1#heading=h.e3366rrgmkdk).

The development AppRTC server can be accessed by visiting [http://localhost:8080](http://localhost:8080).

Running AppRTC locally requires [Google App Engine SDK for Python](https://cloud.google.com/appengine/downloads#Google_App_Engine_SDK_for_Python),
[Node.js](https://nodejs.org) and [Grunt](http://gruntjs.com/).

Follow the instructions on [Node.js website](https://nodejs.org), [Python PIP](https://pip.pypa.io/en/stable/installing/) and on [Grunt website](http://gruntjs.com/) to install them.

When Node.js and Grunt are available you can install the required dependencies
running `npm install` and `pip install -r requirements.txt` from the project root folder.

Before you start the AppRTC dev server and everytime you update the source code
you need to recompile the App Engine package by running `grunt build`.

Start the AppRTC dev server from the `out/app_engine` directory by running the Google App Engine SDK dev server,

```
<path to sdk>/dev_appserver.py ./out/app_engine
```
Then navigate to http://localhost:8080 in your browser (given it's on the same machine).

## Testing

You can run all tests by running `grunt`.

To run only the Python tests you can call,

```
grunt runPythonTests
```

## Deployment
Instructions were performed on Ubuntu 14.04 using Python 2.7.6 and Go 1.6.3.

1. Clone the AppRTC repository
2. Do all the steps in the [Collider instructions](https://github.com/webrtc/apprtc/blob/master/src/collider/README.md) then continue on step 3.
3. Install and start a Coturn TURN server according to the [instructions](https://github.com/coturn/coturn/wiki/CoturnConfig) on the project page.
4. Open [src/app_engine/constants.py](https://github.com/webrtc/apprtc/blob/master/src/app_engine/constants.py) and do the following:

### Collider
 * **If using Google Cloud Engine VM's for Collider**
    * Change `WSS_INSTANCE_HOST_KEY`, `WSS_INSTANCE_NAME_KEY` and `WSS_INSTANCE_ZONE_KEY` to corresponding values for your VM instances which can be found in the Google Cloud Engine management console.
 * **Else if using other VM hosting solution**
    *  Change `WSS_INSTANCE_HOST_KEY` to the hostname and port Collider is listening too, e.g. `localhost:8089` or `otherHost:443`.

### TURN/STUN
 * **If using TURN and STUN servers directly**
    * Comment out `TURN_SERVER_OVERRIDE = []` and then uncomment `TURN_SERVER_OVERRIDE = [ { "urls":...]` three lines below and fill your TURN server details, e.g.

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

* **Else if using ICE Server provider [1]**
  * Change `ICE_SERVER_BASE_URL` to your ICE server provider host.
  * Change `ICE_SERVER_URL_TEMPLATE` to a path or empty string depending if your ICE server provider has a specific URL path or not.
  * Change `ICE_SERVER_API_KEY` to an API key or empty string depending if your ICE server provider requires an API key to access it or not.

  ```python
  ICE_SERVER_BASE_URL = 'https://networktraversal.googleapis.com'
  ICE_SERVER_URL_TEMPLATE = '%s/v1alpha/iceconfig?key=%s'
  ICE_SERVER_API_KEY = os.environ.get('ICE_SERVER_API_KEY')
  ```

8\. Build AppRTC using `grunt build` then deploy/run:
* **If running locally using the Google App Engine dev server (dev/testing purposes)**
    * Start it using dev appserver provided by the Google app engine SDK `pathToGcloudSDK/platform/google_appengine/dev_appserver.py  out/app_engine/`.

* **Else if running on Google App Engine in the Google Cloud (production)**
  * Make sure you have a [Google Cloud Account and Google App Engine enabled](https://cloud.google.com/appengine/docs/python/quickstart).
  * [Download the Google Cloud SDK and initialize it](https://cloud.google.com/appengine/docs/python/tools/uploadinganapp).
  * Deploy your AppRTC app by executing the following in the out/app_engine directory `gcloud app deploy --project [YOUR_PROJECT_ID] -v [YOUR_VERSION_ID]` (You can find the [YOUR_PROJECT_ID] and [YOUR_VERSION_ID] in your Google cloud console).

9\. Open a WebRTC enabled browser and navigate to `http://localhost:8080` or
`https://[YOUR_VERSION_ID]-dot-[YOUR_PROJECT_ID]` (append `?wstls=false` to the
URL if you have TLS disabled on Collider for dev/testing purposes).

## Advanced Topics
### Enabling Local Logging

*Note that logging is automatically enabled when running on Google App Engine using an implicit service account.*

By default, logging to a BigQuery from the development server is disabled. Log information is presented on the console. Unless you are modifying the analytics API you will not need to enable remote logging.

Logging to BigQuery when running LOCALLY requires a `secrets.json` containing Service Account credentials to a Google Developer project where BigQuery is enabled. DO NOT COMMIT `secrets.json` TO THE REPOSITORY.

To generate a `secrets.json` file in the Google Developers Console for your
project:

1. Go to the project page.
2. Under *APIs & auth* select *Credentials*.
3. Confirm a *Service Account* already exists or create it by selecting *Create new Client ID*.
4. Select *Generate new JSON key* from the *Service Account* area to create and download JSON credentials.
5. Rename the downloaded file to `secrets.json` and place in the directory containing `analytics.py`.

When the `Analytics` class detects that AppRTC is running locally, all data is logged to `analytics` table in the `dev` dataset. You can bootstrap the `dev` dataset by following the instructions in the [Bootstrapping/Updating BigQuery](#bootstrappingupdating-bigquery).

### BigQuery

When running on App Engine the `Analytics` class will log to `analytics` table in the `prod` dataset for whatever project is defined in `app.yaml`.

#### Schema

`bigquery/analytics_schema.json` contains the fields used in the BigQuery table. New fields can be added to the schema and the table updated. However, fields *cannot* be renamed or removed. *Caution should be taken when updating the production table as reverting schema updates is difficult.*

Update the BigQuery table from the schema by running,

```
bq update -t prod.analytics bigquery/analytics_schema.json
```

#### Bootstrapping

Initialize the required BigQuery datasets and tables with the following,

```
bq mk prod
bq mk -t prod.analytics bigquery/analytics_schema.json
```

[1] ICE Server provider
AppRTC by default uses an ICE server provider to get TURN servers. Previously we used a [compute engine on demand service](https://github.com/juberti/computeengineondemand) (it created TURN server instances on demand in a region near the connecting users and stored them in shared memory) and web server with a REST API described in [draft-uberti-rtcweb-turn-rest-00](http://tools.ietf.org/html/draft-uberti-rtcweb-turn-rest-00). This has now been replaced with a Google service. It's similar from an AppRTC perspective but with a different [response format](https://github.com/webrtc/apprtc/blob/master/src/web_app/js/util.js#L77).
