export const wsMiddleware = storeAPI => {
  let socket = null;

  return next => action => {
    switch (action.type) {
      case 'ws/connect':
        if (socket !== null) {
          socket.close();
        }
        socket = new WebSocket(action.payload.url);
        socket.onopen = () => {
          console.log("open");
          // storeAPI.dispatch({ type: 'ws/connect' });
        };
        socket.onclose = () => {
          console.log("close");
          // storeAPI.dispatch({ type: 'ws/close' });
        };
        socket.onmessage = event => {
          const data = JSON.parse(event.data);
          storeAPI.dispatch({ type: data.type, payload: data.payload });
        };
        break;
      case 'ws/send':
        socket.send(JSON.stringify(action.payload.data));
        break;
      case 'ws/disconnect':
        if (socket !== null) {
          socket.close();
        }
        socket = null;
        break;
      default:
        return next(action);
    }
  };
};
