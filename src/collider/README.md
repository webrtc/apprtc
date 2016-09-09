# Collider

A websocket-based signaling server in Go.

## Building

1. Install the Go tools and workspaces as documented at http://golang.org/doc/install and http://golang.org/doc/code.html

2. Checkout the `apprtc` repository

        git clone https://github.com/webrtc/apprtc.git

3. Make sure to set the $GOPATH according to the Go instructions in step 1

  E.g. `export GOPATH=$HOME/goWorkspace/`
  `mkdir $GOPATH/src`

4. Link the collider directories into `$GOPATH/src`

        ln -s `pwd`/apprtc/src/collider/collider $GOPATH/src
        ln -s `pwd`/apprtc/src/collider/collidermain $GOPATH/src
        ln -s `pwd`/apprtc/src/collider/collidertest $GOPATH/src

5. Install dependencies

        go get collidermain

6. Install `collidermain`

        go install collidermain


## Running

    $GOPATH/bin/collidermain -port=8089 -tls=true

## Testing

    go test collider

