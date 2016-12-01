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

## Deployment
These instructions assume you are using Debian 7/8 and Go 1.6.3.

1. Change [roomSrv](https://github.com/webrtc/apprtc/blob/master/src/collider/collidermain/main.go#L16) to your AppRTC server instance e.g.

```go
var roomSrv = flag.String("room-server", "https://your.apprtc.server", "The origin of the room server")
```

2. Then repeat step 6 in the Building section.

### Install Collider
1. Login on the machine that is going to run Collider.
2. Create a Collider directory, this guide assumes it's created in the root (`/collider`).
3. Create a certificate directory, this guide assumes it's created in the root (`/cert`).
4. Copy `$GOPATH/bin/collidermain ` from your development machine to the `/collider` directory on your Collider machine.

### Certificates
If you are deploying this in production, you should use certificates so that you can use secure websockets. Place the `cert.pem` and `key.pem` files in `/cert/`. E.g. `/cert/cert.pem` and `/cert/key.pem`

### Auto restart
1\. Add a `/collider/start.sh` file:

```bash
/usr/local/bin/node /node/send_restart_alert.js $(hostname) 2>>/collider/collider.log
/collider/collidermain 2>> /collider/collider.log
```

2\. Make it executable by running `chmod 744 start.sh`.

3\. Add the following line to `/etc/inittab` to allow automatic restart of the Collider process (make sure to either add `coll` as an user or replace it below with the user that should run collider):
```bash
coll:2:respawn:/collider/start.sh
```
4\. Run `init q` to apply the inittab change without rebooting.

#### Rotating Logs
To enable rotation of the `/collider/collider.log` file add the following contents to the `/etc/logrotate.d/collider` file:

```
/collider/collider.log {
    daily
    compress
    copytruncate
    dateext
    missingok
    notifempty
    rotate 10
    sharedscripts
}
```

The log is rotated daily and removed after 10 days. Archived logs are in `/collider`.
