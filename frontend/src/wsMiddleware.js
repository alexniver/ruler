const encoder = new TextEncoder(); // always utf-8, Uint8Array()
const decoder = new TextDecoder();

export const wsMiddleware = store => {
  let ws = null;


  return next => action => {
    switch (action.type) {
      case 'ws/connect':
        if (ws !== null) {
          ws.close();
        }
        ws = new WebSocket(action.payload.url);
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
          console.log("open");
          // storeAPI.dispatch({ type: 'ws/connect' });
          queryMsgArr(ws);
        };
        ws.onclose = () => {
          console.log("close");
          // storeAPI.dispatch({ type: 'ws/close' });
        };
        ws.onmessage = event => {
          process_msg(store, event.data);
        };
        break;
      case 'ws/sendMsg':
        const method_arr = new Uint8Array(1);
        method_arr[0] = 3;

        let text = action.payload.data;
        const text_arr = encoder.encode(text);
        const text_len_arr = intToArray(text_arr.length);

        // method(1), text_len(4), text(text_len)
        let sendData = new Uint8Array(1 + 4 + text_arr.length);
        let idx = 0;

        sendData.set(new Uint8Array(method_arr), idx);
        idx += 1;

        sendData.set(new Uint8Array(text_len_arr), idx);
        idx += 4;

        sendData.set(new Uint8Array(text_arr), idx);
        ws.send(sendData);
        break;
      case 'ws/sendFile':
        let filename = action.payload.data;
        console.log("send:" + filename);
        break;

      case 'ws/disconnect':
        if (ws !== null) {
          ws.close();
        }
        ws = null;
        break;
      default:
        return next(action);
    }
  };
};

// query msg arr, method: 1
function queryMsgArr(ws) {
  const method_arr = new Uint8Array(1);
  method_arr[0] = 1;

  ws.send(method_arr);
}

function process_msg(store, data) {
  let data_view = new DataView(data);
  let method = data_view.getInt8(0, true);

  let i = 1;
  if (method == 61) { // msg list
    while (i < data_view.byteLength) {
      i = deal_msg(store, data_view, i);
    }
  } else if (method == 62) { // one msg
    deal_msg(store, data_view, i);
  }
}

function deal_msg(store, data_view, i) {
  let [msg, new_i] = parse_msg_data(data_view, i);
  store.dispatch({ type: "ruler/addMsg", payload: { data: msg } });
  return new_i;
}

function parse_msg_data(data_view, i) {
  let id_len = data_view.getInt32(i, true);
  i += 4;
  let id = data_view.getInt32(i, true);
  i += 4;

  let msg_type_len = data_view.getInt32(i, true);
  i += 4;
  let msg_type = data_view.getInt32(i, true);
  i += 4;

  let text_len = data_view.getInt32(i, true);
  i += 4;
  let text = decoder.decode(data_view.buffer.slice(i, i + text_len));
  i += text_len;
  return [{ id, msg_type, text }, i]
}


// little edian
function intToArray(i) {
  return Uint8Array.of(
    (i & 0x000000ff) >> 0,
    (i & 0x0000ff00) >> 8,
    (i & 0x00ff0000) >> 16,
    (i & 0xff000000) >> 24,
  );
}

// little edian
function arrayToInt(bs, start) {
  start = start || 0;
  const bytes = bs.subarray(start, start + 4).reverse();
  let n = 0;
  for (const byte of bytes.values()) {
    n = (n << 8) | byte;
  }
  return n;
}
