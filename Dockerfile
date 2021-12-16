#######DEMO APP, DO NOT USE THIS FOR ANYTHING BUT TESTING PURPOSES, ITS NOT MEANT FOR PRODUCTION######

FROM golang:1.17.5-alpine3.15

# Install and download deps.
RUN apk add --no-cache git curl python2
RUN git clone https://github.com/webrtc/apprtc.git

# AppRTC GAE setup

# Required to run GAE dev_appserver.py.
RUN curl https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-sdk-367.0.0-linux-x86_64.tar.gz --output gcloud.tar.gz
RUN tar -xf gcloud.tar.gz
RUN google-cloud-sdk/bin/gcloud components install app-engine-python-extras app-engine-python cloud-datastore-emulator --quiet

# Mimick build step by manually copying everything into the appropriate folder and run build script.
WORKDIR apprtc
RUN python build/build_app_engine_package.py src/ out/
RUN curl https://webrtc.github.io/adapter/adapter-latest.js --output src/web_app/js/adapter.js
RUN cp src/web_app/js/*.js out/js/

# Wrap AppRTC GAE app in a bash script due to needing to run two apps within one container.
# Make sure we are in the /go/ root folder.
WORKDIR ../
RUN echo -e "#!/bin/sh\n" > start.sh
RUN echo -e "`pwd`/google-cloud-sdk/bin/dev_appserver.py --host 0.0.0.0 `pwd`/apprtc/out/app.yaml &\n" >> start.sh

# Collider setup

# Go environment setup.
RUN export GOPATH=$HOME/goWorkspace/
RUN go env -w GO111MODULE=off
RUN  ln -s `pwd`/apprtc/src/collider/collidermain $GOPATH/src
RUN  ln -s `pwd`/apprtc/src/collider/collidertest $GOPATH/src
RUN  ln -s `pwd`/apprtc/src/collider/collider $GOPATH/src
WORKDIR $GOPATH/src

# Download all the dependencies
RUN go get collidermain

# Install the package
RUN go install collidermain

# Add Collider executable to the start.sh bash script.
WORKDIR ../
RUN echo -e "$GOPATH/bin/collidermain -port=8089 -tls=false -room-server=http://localhost &\n" >> start.sh
RUN echo -e "wait -n\n" >> start.sh
RUN echo -e "exit $?\n" >> start.sh
# Make it executable.
RUN chmod +x start.sh

# Start the bash wrapper that keeps both collider and the AppRTC GAE app running. 
CMD ./start.sh

## Instructions (Tested on Debian 11 only):
# - Download the Dockerfile from the AppRTC repo and put it in a folder, e.g. 'apprtc'
# - Build the Dockerfile into an image: 'sudo docker build apprtc/'
#   Note the image ID from the build command, e.g. something like 'Successfully built 503621f4f7bd'.
# - Run: 'sudo docker run -p 8080:8080 -p 8089:8089 --rm -ti 503621f4f7bd'
#   The container will now run in interactive mode and output logging. This can ofc be prevent if you run in 
#   non-interactive mode. The -p are port mappings to the GAE app and Collider instances, the host ones can be changed.
#
# - On the same machine that this docker image is running on you can now join apprtc calls using 
#   http://localhost:8080/?wshpp=localhost:8089&wstls=false,  once you join the URL will have 
#   appended the room name which you can share, e.g. 'http://localhost:8080/r/315402015?wshpp=localhost:8089&wstls=false'.
#   
#   Keep in mind that you need to pass in those 'wshpp' and 'wstls' URL parameters everytime you join with as they override 
#   the websocket server address and turns off secure websockets.
#
# NOTE: that localhost is special (at least on Chrome) allowing getusermedia to be accessed without TLS. If you host it on a different hostname
# or host alltogheter, TLS is most likely required unless you can do fancy forwarding (so that each client appears
# to be using localhost but forwards the traffic to the machine running the docker container, not sure if this is possible).
# The steps assume sudo is required for docker, that can be avoided but is out of scope.

## TODO
# Investigate if TLS support can be added using self signed certificates. 
# Verify if this docker container run on more OS's?

