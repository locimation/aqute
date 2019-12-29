window.angular = require('angular');

window.onload = function() { angular.bootstrap(document, ['lq.core']); }

angular.module('lq.core', [])

  .service('QRC', () => {

    const GROUPS = ['LqCG', 'LqCcG'];

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

    function send(method, params) {
      ws.send(JSON.stringify({
        jsonrpc: "2.0",
        method,
        id: rpcId++,
        params
      }));
    }

    let rpcId = 0;
    function exec(method, params) {
      wsQ.push({method, params}); // re-send on reconnect
      if(ws.readyState == ws.OPEN) { send(method, params) }
    }

    return {
      SetValue: function(cmp, ctl, val) {
        let params = { Name: ctl, Value: val };
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
      QRC.Subscribe(component, name, (v) =>
        $rootScope.$apply(() => { self.data = v; })
      );
      return new Proxy(self, {
        get: (target, prop) => target.data[prop], // set must return true
        set: (_, __, val) => QRC.SetValue(component, name, val) || true
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

  // For buttons and such
  .directive('lqActive', () => {
    return {
      restrict: 'A',
      compile: function(el) {
        return function link(scope, el, attr) {
          scope.$watch(attr.lqActive, (value) => {
            el.toggleClass('active', value == 1);
          })
          el.on('mousedown mouseup mouseout', (e) => {
            scope.$eval(attr.lqActive + ' = ' + (
              e.type == 'mousedown' ? '1' : '0'
            ))
          })
        }
      }
    }
  })