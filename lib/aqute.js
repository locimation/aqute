window.angular = require('angular');

window.onload = function() { angular.bootstrap(document, ['aq.core']); }

angular.module('aq.core', [])

  .service('QRC', () => {

    const GROUPS = ['AqCG', 'AqCcG'];

    let wsQ = []; // queue for QRC init messages
    const wsURL = document.getElementsByTagName('meta')['core-ip'].content;
    const ws = new WebSocket('ws://' + wsURL + '/qrc');

    ws.onopen = () => {
      console.log('# WebSocket connection opened!');
      GROUPS.map(Id => { // create groups for polling
        send('ChangeGroup.AddControl', { Id, Controls: [] });
        send('ChangeGroup.AutoPoll', { Id, Rate: 0.05 });
      });
      wsQ.map(({method, params}) => send(method, params));
    }

    // [undefined] contains Named Control handlers
    let controlHandlers = { [undefined]: {} };
    ws.onmessage = (msg) => {
      const r = JSON.parse(msg.data);
      if(r.method != 'ChangeGroup.Poll') return;
      if(r.params.Changes.length == 0) return;
      if(~GROUPS.indexOf(r.params.Id)) {
        r.params.Changes.map(ch => {
          try { controlHandlers[ch.Component][ch.Name](ch) }
          catch(e) { console.error(ch.Component, ch.Name, e); }
        });
      }
    }

    let rpcId = 0;
    function send(method, params) {
      ws.send(JSON.stringify({
        jsonrpc: "2.0",
        method,
        id: rpcId++,
        params
      }));
    }

    function exec(method, params) {
      wsQ.push({method, params}); // re-send on reconnect
      if(ws.readyState == ws.OPEN) { send(method, params) }
    }

    return {
      SetValue: function(cmp, ctl, prop, val) {
        if(prop != 'Position') { prop = 'Value'; }
        let params = { Name: ctl, [prop]: val };
        console.log(params)
        if(cmp) { params = { Name: cmp, Controls: [params] } };
        exec(cmp ? 'Component.Set' : 'Control.Set', params);
      },
      Subscribe: function(cmp, ctl, eventHandler) {
        if(!controlHandlers[cmp]) { controlHandlers[cmp] = []; }
        if(!controlHandlers[cmp][ctl]) {
          controlHandlers[cmp][ctl] = eventHandler;
          if(!cmp) {
            exec('ChangeGroup.AddControl', { Id: GROUPS[0], Controls: [ctl] });
          } else {
            exec('ChangeGroup.AddComponentControl', {
              Id: GROUPS[1],
              Component: {
                Name: cmp,
                Controls: [{ Name: ctl }]
              }
            });
          }
        }
      }
    };

  })

  .config(($locationProvider) => {
    $locationProvider.html5Mode({
      enabled: true,
      requireBase: false
    })
  })

  .run(($rootScope, $location, QRC) => {

    console.log('# Angular is a euphoric rabbit.');
    window.scope = $rootScope;

    function Control(name, component) {
      let self = { data: {} };
      QRC.Subscribe(component, name, (v) => {
        if(self.blocked) { return; }
        $rootScope.$apply(() => { self.data = v; });
      });
      return new Proxy(self, {
        get: (target, prop) => target.data[prop],
        set: (target, prop, val) => {
          setTimeout(() => { target.blocked = false }, 250)
          target.data[prop] = val;
          QRC.SetValue(component, name, prop, val);
          return true; // set must return true
        }
      })
    }

    function lazyGenerator(T, parent) {
      return new Proxy({}, {
        get: (target, prop) => target[prop] ||
          (target[prop] = new T(prop, parent))
      });
    }

    function Component(name) {
      return lazyGenerator(Control, name)
    }

    $rootScope.$apply(() => {
      $rootScope.Controls = lazyGenerator(Control);
      $rootScope.Components = lazyGenerator(Component);
      $rootScope.Properties = $location.search();
    });

  })

  // For scoping
  .directive('component', ($rootScope) => {
    return {
      restrict: 'E',
      scope: {},
      transclude: true,
      link: function(scope, el, attr, _, transclude) {
        transclude(scope, (clone) => el.append(clone));
        scope.Controls = new Proxy({}, {
          get: (_, p) => $rootScope.Components[attr.name][p]
        });
      }
     }
  })

  // Button directives
  .directive('aqToggle', () => {
    return {
      restrict: 'A',
      link: function(scope, el, attr) {
        const value = attr.aqToggle + '.Value';
        scope.$watch(value, (value) => {
          el.toggleClass('active', value == 1);
        })
        el.on('mouseup', () =>
          scope.$eval(value + ' = 1 - ' + value)
        )
      }
    }
  })

  .directive('aqMomentary', () => {
    return {
      restrict: 'A',
      link: function(scope, el, attr) {
        const value = attr.aqMomentary + '.Value';
        scope.$watch(value, (value) => {
          el.toggleClass('active', value == 1);
        })
        el.on('mousedown mouseup mouseout', (e) => {
          const state = e.type == 'mousedown';
          if(state == el.hasClass('active')) { return; }
          scope.$eval(value + ' = ' + (
            state ? '1' : '0'
          ))
        })
      }
    }
  })

  .directive('aqString', () => {
    return {
      restrict: 'A',
      link: function(scope, el, attr) {
        const control = scope.$eval(attr.aqString);
        el.on('mouseup', () => { control.String = attr.value; });
        scope.$watch(attr.aqString + '.String', (value) =>
          el.toggleClass('active', value == attr.value));
      }
    }
  })