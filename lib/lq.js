window.angular = require('angular');

window.onload = function() { angular.bootstrap(document, ['lq.core']); }

angular.module('lq.core', [])

  .service('QRC', () => {

    let wsQ = []; // queue for websocket messages
    const ws = new WebSocket('ws://10.0.0.136/qrc');
    ws.onopen = () => {
      console.log('# WebSocket connection opened!');
      ['LqCG', 'LqCcg'].map(Id => {
        exec('ChangeGroup.AddControl', { Id, Controls: [] });
        exec('ChangeGroup.AutoPoll', { Id, Rate: 0.05 });
      })
      wsQ.splice(0).map((msg) => ws.send(msg));
    }

    ws.onmessage = (msg) => {
      const rpcResponse = JSON.parse(msg.data);
      const rpcResponseId = parseInt(rpcResponse.id, 10);
      if(rpcResponse.method != 'ChangeGroup.Poll') return;
      if(rpcResponse.params.Changes.length == 0) return;
      if(rpcResponse.params.Id == 'LqCG') {
        rpcResponse.params.Changes.map(change => {
          if(controlHandlers[change.Name]) {
            controlHandlers[change.Name](change);
          }
        })
      } else if(rpcResponse.params.Id == 'LqCcG') {
        rpcResponse.params.Changes.map(change => {
          if(cmpCtlHandlers[change.Component][change.Name]) {
            cmpCtlHandlers[change.Component][change.Name](change);
          }
        })
      }
      if(handlers[rpcResponseId]) {
        const {resolve, reject} = handlers[rpcResponseId];
        if(rpcResponse.error) { reject(rpcResponse.error); }
        else { resolve(rpcResponse.result); }
      }
    }

    function send(msg) {
      if(ws.readyState == ws.OPEN) { ws.send(msg); }
      else { wsQ.push(msg); }
    }

    let rpcId = 0;
    let handlers = {};
    function exec(method, params) {
      send(JSON.stringify({
        jsonrpc: "2.0",
        method,
        id: rpcId++,
        params
      }));
    }
    function execPromise (method, params) {
      return new Promise((resolve, reject) => {
        handlers[rpcId] = {resolve, reject};
        exec(method, params);
      })
    };

    function getterFor(props, prefix) {
      return function(target, prop, receiver) {
        if(target[prop]) { return target[prop]; }
        if(~props.indexOf(prop)) {
          prefix = prefix ? (prefix + '.') : '';
          return (...args) => execPromise(prefix + prop, args);
        }
      }
    }

    let controlHandlers = {};
    let cmpCtlHandlers = {};

    const methods = new Proxy({
        Control: new Proxy({}, { get: getterFor(['Get', 'Set'], 'Control')}),
        ControlSet: function(control, _, val) {
          exec('Control.Set', { Name: control, Value: val });
        },
        ComponentControlSet: function(cmp, control, _, val) {
          exec('Component.Set', { Name: cmp, Controls: [
            { Name: control, Value: val }
          ]});
        },
        SubscribeControl: function(control, eventHandler) {
          if(!controlHandlers[control]) {
            exec('ChangeGroup.AddControl', { Id: 'LqCG', Controls: [control] });
            controlHandlers[control] = eventHandler;
          }
        },
        SubscribeComponentControl: function(cmp, ctl, eventHandler) {
          if(!cmpCtlHandlers[cmp]) { cmpCtlHandlers[cmp] = []; }
          if(!cmpCtlHandlers[cmp][ctl]) {
            cmpCtlHandlers[cmp][ctl] = eventHandler;
            exec('ChangeGroup.AddComponentControl', { Id: 'LqCcG',
              Component: {
                Name: cmp,
                Controls: [{ Name: ctl }]
              }
            });
          }
        }
      }, { get: getterFor(['NoOp', 'StatusGet']) }
    );

    return methods;

  })

  .run(($rootScope, QRC) => {

    window.scope = $rootScope;

    console.log('# Angular is a euphoric rabbit.');

    function Control(name, component) {
      let self = { data: {} };
      function apply(v) { $rootScope.$apply(() => {
        self.data = v;
      }) }
      if(component) {
        QRC.SubscribeComponentControl(component, name, apply)
      } else {
        QRC.SubscribeControl(name, apply);
      }
      return new Proxy(self, {
        get: (target, prop) => {
          return target.data[prop]
        },
        set: (_, prop, val) => {
          if(component) {
            QRC.ComponentControlSet(component, name, prop, val);
          } else {
            QRC.ControlSet(name, prop, val);
          }
          return true;
        }
      })
    }

    function Component(name) {
      return new Proxy({}, {
        get: function(target, prop) {
          if(target[prop]) { return target[prop]; }
          target[prop] = new Control(prop, name);
        }
      })
    }

    $rootScope.$apply(() => {

      $rootScope.Controls = new Proxy({}, {
        get: function(target, prop) {
          if(target[prop]) { return target[prop]; }
          target[prop] = new Control(prop);
        }
      });

      $rootScope.Components = new Proxy({}, {
        get: function(target, prop) {
          if(target[prop]) { return target[prop]; }
          target[prop] = new Component(prop);
        }
      })

    });

  })

  .service('QScoper', () => {
    return {
      apply: function(scope, path, value) {
        const [root, control, prop] =
          path.match(/([^.]+)\.(.*)\.([^.]+)/).slice(1,4);
        scope.$apply(() => {
          scope[root][control][prop] = value;
        });
      }
    };
  })

  // For buttons and such
  .directive('lqActive', (QRC, QScoper) => {
    return {
      restrict: 'A',
      compile: function(el) {
        return function link(scope, el, attr) {
          scope.$watch(attr.lqActive, (value) => {
            el.toggleClass('active', value);
          })
          el.on('mousedown', () => {
            scope.$eval(attr.lqActive + ' = 1')
          });
          el.on('mouseup mouseout', () => {
            scope.$eval(attr.lqActive + ' = 0')
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