window.angular = require('angular');

window.onload = function() { angular.bootstrap(document, ['lq.core']); }

angular.module('lq.core', [])

  .service('QRC', () => {

    const GROUPS = ['LqCG', 'LqCcG'];

    let wsQ = []; // queue for QRC init messages
    const ws = new WebSocket('ws://10.0.0.136/qrc');

    ws.onopen = () => {
      console.log('# WebSocket connection opened!');
      GROUPS.map(Id => { // create groups for polling
        send('ChangeGroup.AddControl', { Id, Controls: [] });
        send('ChangeGroup.AutoPoll', { Id, Rate: 0.05 });
      })
      console.log('open')
      wsQ.map(({method, params}) => send(method, params));
    }

    // [undefined] contains Named Control handlers
    let controlHandlers = { [undefined]: {} };
    ws.onmessage = (msg) => {
      const r = JSON.parse(msg.data);
      if(r.method != 'ChangeGroup.Poll') return;
      if(r.params.Changes.length == 0) return;
      console.log(r);
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

  .run(($rootScope, QRC) => {

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
    });

  })

  // For buttons and such
  .directive('lqActive', () => {
    return {
      restrict: 'A',
      compile: function(el) {
        return function link(scope, el, attr) {
          scope.$watch(attr.lqActive, (value) => {
            el.toggleClass('active', value);
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

  // For scoping
  .directive('component', ($rootScope) => {
    return {
      restrict: 'E',
      scope: { name: '=' },
      controller: function($scope) {
        console.log($scope);
      }
    }
  })