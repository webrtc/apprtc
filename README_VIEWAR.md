VIEWAR DOCUMENTATION:

How to issue an SSL certificate: 
use root@proxy and run /root/certbot-auto certonly --preferred-challenges tls-sni
Use a local temporary server in the selection. (Option 2)

Files are placed correctly and it should work right away.

CHANGE BUNDLE ID:

* In in src/web_app/html/index_template.html file:
** Search for "// Inject app." comment and set base64 - encoded appfiles url as first argument of inject function.
** Set values for window.bundleIdentifier and window.bundleVersion
* rebuild

BUILD:

* npm run build (creates ./out directory )
* Viewar core is located in src/web_app/js/ViewAR.js (before running build).
* You can also copy ViewAR.js (the viewar core) to out/app_engine/js/ after running build.

START:

Either run
* ./start.sh 
to run in a new screen or (for test purposes) run
* npm run start

CHANGE CORE VERSION:

Go to 'src/web_app/html/index_template.html