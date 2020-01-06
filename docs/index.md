# Aqute

LQHtml is a library for building AngularJS user interfaces that control QSC's Q-Sys cores.


## Getting Started

*Requirements: NodeJS w/ NPM*

To begin with, simply clone this repository:
```
git clone https://github.com/locimation/LQHtml.git
```

In `src/index.html`, change the `core-ip` meta tag to the IP address of your core:
```html
<meta name="core-ip" content="ip.goes.here" />
```

Then run `npm install`, and `npm run-script serve`.

You can now open http://localhost:1234/ in a browser and see the sample UCI.

Edit `src/index.html`, `src/uci.js` and `src/uci.css` to suit your needs and UCI design.


## Deployment
**Note:** The production deployment process is currently a work-in-progress.

The intended behaviour is that you'll be able to run `npm build`, then copy the resulting .html file to any webserver of your choice.

Currently, it's possible to upload HTML files to a Q-Sys core's `media` directories and access them at http://&lt;core-ip&gt;/media/.

Whilst this may change in future, it presently offers a way to host HTML-based UCI's on the core itself.


## Bindings

[Named controls](https://q-syshelp.qsc.com/Content/Schematic_Library/external_control.htm) and any controls belonging to [named components](https://training.qsc.com/mod/book/view.php?id=1178) are bound to the Angular root scope.

For example, you can display the contents of a Q-Sys text field using ng-bind:

```html
<!-- Named control binding -->
<h1 ng-bind="Controls.my_text_control.String"></h1>

<!-- Named component binding -->
<h3 ng-bind="Components.my_component.text_control.String"></h3>
```

This binding is bi-directional, so an HTML text-field will update the Q-Sys control as it changes:
```html
<input type="text" ng-model="Controls.my_text_control.String" />
```

These controls are bound through lazy-loading, such that only the required controls are requested from the core.

### Scoped Bindings

A helper directive (`Component`) is provided for scoping nested bindings to a particular named component:
```html
<Component name="my_component">
  <span ng-bind="Controls.text_control.String"></span>
</Component>
```

### URL Parameters

URL parameters are also bound to the root scope under the `Properties` object, such that named components may be referenced dynamically.
For example, to have the URL `/uci.html?room=foyer` access the `foyer` named component:
```html
<Component name="{{Properties.room}}">
  <h1 ng-bind="Controls.room_name.String"></h1>
</Component>
```
This allows many rooms to share a user interface.

### Button directives

HTML buttons are typically stateless, so a number of helper functions are provided to allow the buttons to have momentary or toggle behaviour.

These directives change a Q-Sys control's value between `0` and `1`, and apply an `active` css class if the value is 1.

The included stylesheet (`src/uci.css`) sets buttons to be light gray by default, and white when the `active` class is present.

```html
<!-- Toggle button -->
<button lq-toggle="Controls.my_button">Click Me</button>

<!-- Momentary button -->
<button lq-momentary="Controls.my_other_button">Click!</button>
```

A directive is also provided to allow buttons to be used as shortcuts to set the `String` value of a control. When the button is clicked, the `value` property will be applied. When the control's `String` value matches the element's `value` attribute, the `active` class will be applied and the button will (by default) turn white.

```html
<!-- String buttons -->
<button lq-string="Controls.text" value="HDMI 1">Blu-Ray</button>
<button lq-string="Controls.text" value="HDMI 2">Apple TV</button>
```

## Q-Sys Interaction

LQHtml connects to the core using the same websocket URL (http://&lt;core-ip&gt;/qrc) as the built-in HTML5 UCI Viewer.

Via this websocket, it uses the QRC (Q-Sys Remote Control) protocol documented in the [Q-Sys help file](https://q-syshelp.qsc.com/Content/External_Control/Q-Sys_Remote_Control/QRC.htm).

Specifically, it creates two change groups:
- **LqCG** for any named controls, and
- **LqCcg** for any component controls.

These are then automatically polled with an interval of 50ms.

As such, the only methods implemented are:
- **ChangeGroup.AddComponentControl**
- **ChangeGroup.AddControl**
- **ChangeGroup.AutoPoll**
- **Component.Set**
- **Control.Set**
