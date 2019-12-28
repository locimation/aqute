window.angular = require('angular');

window.onload = function() { angular.bootstrap(document, ['lq.core']); }

angular.module('lq.core', [])

  .service('QRC', () => {

    let wsQ = []; // queue for websocket messages
    const ws = new WebSocket('ws://10.0.0.136/qrc');
    ws.onopen = () => {
      console.log('# WebSocket connection opened!');
      exec('ChangeGroup.AddControl', { Id: 'LqCG', Controls: [] });
      exec('ChangeGroup.AutoPoll', { Id: 'LqCG', Rate: 0.05 });
      wsQ.splice(0).map((msg) => ws.send(msg));
    }

    ws.onmessage = (msg) => {
      const rpcResponse = JSON.parse(msg.data);
      const rpcResponseId = parseInt(rpcResponse.id, 10);
      //console.log(rpcResponse);
      if(rpcResponse.method == 'ChangeGroup.Poll'
        && rpcResponse.params.Id == 'LqCG') {
          rpcResponse.params.Changes.map(change => {
            console.log('change', change.Name, change.String);
            if(controlHandlers[change.Name]) {
              controlHandlers[change.Name](change);
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
      console.log(msg);
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

    const methods = new Proxy({
        Control: new Proxy({}, { get: getterFor(['Get', 'Set'], 'Control')}),
        ControlSet: function(control, prop, val) {
          exec('Control.Set', { Name: control, Value: val });
        },
        SubscribeControl: function(control, eventHandler) {
          if(!controlHandlers[control]) {
            exec('ChangeGroup.AddControl', { Id: 'LqCG', Controls: [control] });
            controlHandlers[control] = eventHandler;
          }
        }
      }, { get: getterFor(['NoOp', 'StatusGet']) }
    );

    return methods;

  })

  .run(($rootScope, QRC) => {

    console.log('# Angular is a euphoric rabbit.');

    function Control(name) {
      let self = { data: {} };
      QRC.SubscribeControl(name, value =>
        $rootScope.$apply(() => { self.data = value })
      );
      return new Proxy(self, {
        get: (target, prop) => {
          return target.data[prop]
        },
        set: (_, prop, val) => {
          QRC.ControlSet(name, prop, val);
          return true;
        }
      })
    }

    $rootScope.$apply(() => {
      $rootScope.Controls = new Proxy({}, {
        get: function(target, prop, receiver) {
          if(target[prop]) { return target[prop]; }
          target[prop] = new Control(prop);
        }
      });
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
            QScoper.apply(scope, attr.lqActive, 1);
          });
          el.on('mouseup mouseout', () => {
            QScoper.apply(scope, attr.lqActive, 0);
          })
        }
      }
    }
  })