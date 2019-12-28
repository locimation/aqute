# LQHtml

LQHtml is a library for building AngularJS user interfaces that control QSC's Q-Sys cores.

## Getting Started

To begin with, simply clone this repository:
```
git clone https://github.com/locimation/LQHtml.git
```

(Note: for now, you'll need to change the core's IP in `lib/lq.js`.)

Then run `npm install`, and `npm run-script serve`.

You can now open http://localhost:1234/ in a browser and see the sample UCI.

Edit `src/index.html`, `src/uci.js` and `src/uci.css` to suit your needs and UCI design.


## Deployment
*Note:* Production deployment is currently a work-in-progress.

The intended behaviour is that you'll be able to run `npm build`, then copy the resulting .html file to any webserver of your choice for public access.

Currently, it is possible to upload HTML files to the core's media directories and access them at http://<core-ip/media/.
Whilst this may change in future, it presently offers a way to host HTML-based UCI's on the core itself. 


## Architecture

LQHtml binds [named controls](https://q-syshelp.qsc.com/Content/Schematic_Library/external_control.htm) and the controls of [named components](https://training.qsc.com/mod/book/view.php?id=1178) to the Angular root scope.

For example, you can display the contents of a Q-Sys text field using ng-bind:

```html
<h1 ng-bind="Controls.my_text_control.String"></h1>
```

This binding is bi-directional, so an HTML text-field will update the Q-Sys control as it changes:
```html
<input type="text" ng-model="Controls.my_text_control.String" />
```

LQHtml also provides helper directives for bridging the logical gaps between Q-Sys controls and HTML entities.
(These are a work in progress - documentation will follow as they develop.)


## Q-Sys Interaction

LQHtml connects to the core using the same websocket URL (http://<core-ip>/qrc) as the built-in HTML5 UCI Viewer.

Via this websocket, it uses QRC (Q-Sys Remote Control) protocol documented in the [Q-Sys help file](https://q-syshelp.qsc.com/Content/External_Control/Q-Sys_Remote_Control/QRC.htm).

Specifically, it creates a change group for any controls and component controls used in the interface, then automatically polls this group.

As such, only the *Control.Set*, *ChangeGroup.AddControl*, *ChangeGroup.AddComponentControl* and *ChangeGroup.AutoPoll* methods are used.
