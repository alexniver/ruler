//! Run with
//!
//!
//! ```not_rust
//! cargo run -p file-transfer
//! ```
//!
use std::{
    net::SocketAddr,
    sync::{Arc, Mutex},
};

use axum::{
    body::{self, Full},
    extract::{
        ws::{Message, WebSocket},
        Path, State, WebSocketUpgrade,
    },
    http::{header, HeaderValue, Response, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};
use bytes::{Buf, BufMut, Bytes, BytesMut};
use futures::{SinkExt, StreamExt};
use tokio::{
    fs::File,
    io::{BufReader, BufWriter},
    sync::broadcast,
};
use tower_http::services::ServeDir;
use tracing::{debug, error};
use tracing_subscriber::{prelude::__tracing_subscriber_SubscriberExt, util::SubscriberInitExt};

const UPLOAD_DIR: &str = "upload";

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "ruler=trace".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let _ = tokio::fs::create_dir_all(UPLOAD_DIR).await;

    let state = Arc::new(AppState::new());

    // state.files.lock().unwrap().push(value);

    let app = Router::new()
        .nest_service("/", ServeDir::new("../frontend/build/"))
        .route("/ws", get(websocket_handler))
        .route("/queryfile/*path", get(query_file))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    debug!("listening on {:?}", &addr);

    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn websocket_handler(
    wsu: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    wsu.on_upgrade(|ws| websocket(ws, state))
}

async fn websocket(ws: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut reader) = ws.split();

    let state_for_send = state.clone();
    let mut rx = state.tx.subscribe();
    let tx = state.tx.clone();

    // send all msg
    let mut bts = BytesMut::new();
    bts.put_u8(61);
    for msg in state.msg_arr.lock().unwrap().iter() {
        bts.put_i32_le(4);
        bts.put_i32_le(msg.id);

        bts.put_i32_le(4);
        bts.put_i32_le(msg.msg_type);

        let text_byte_arr = msg.text.as_bytes();
        bts.put_i32_le(text_byte_arr.len() as i32);
        bts.put(text_byte_arr);
    }
    let _ = sender.send(Message::Binary(bts.to_vec())).await;

    let mut recv = tokio::spawn(async move {
        while let Some(Ok(data)) = reader.next().await {
            if let Message::Binary(data) = data {
                let mut bts = Bytes::from(data);

                let method_u8 = bts.get_u8();
                debug!("method: {:?}", method_u8);

                match method_u8 {
                    // query all
                    1 => {
                        // TOOD;
                    }
                    // query single
                    2 => {
                        let id = bts.get_i32_le();
                        let _ = tx.send(QueryType::Single(id));
                    }
                    // client send msg
                    3 => {
                        let msg_len = bts.get_i32_le() as usize;
                        let buf = bts.take(msg_len).into_inner().to_vec();
                        let msg = String::from_utf8(buf).unwrap();
                        let id = state.next_id();
                        // debug!("id: {:?}, msg: {:?}", id, msg);
                        state
                            .msg_arr
                            .lock()
                            .unwrap()
                            .push(Msg::new(id, MSG_T_TEXT, msg));
                        let _ = tx.send(QueryType::Single(id));
                    }
                    // send file
                    4 => {}
                    5 => {
                        // 2: upload file, totallen-len-filename-len-filedata
                        let name_len = bts.get_i32_le() as usize;

                        let name = String::from_utf8(bts.split_to(name_len).to_vec()).unwrap();

                        let data_len = bts.get_i32_le() as usize;
                        let path = std::path::Path::new(UPLOAD_DIR).join(name);
                        let mut file = BufWriter::new(File::create(path).await.unwrap());
                        let v = bts.take(data_len).into_inner().to_vec();
                        let mut data_reader = BufReader::new(v.as_slice());

                        // Copy the body into the file.
                        tokio::io::copy(&mut data_reader, &mut file).await.unwrap();

                        let _ = tx.send(QueryType::Single(0));
                    }
                    _ => {}
                }
            }
        }
    });

    let mut send = tokio::spawn(async move {
        while let Ok(query_type) = rx.recv().await {
            match query_type {
                QueryType::All => {}
                QueryType::Single(id) => {
                    let mut bts = BytesMut::new();
                    bts.put_u8(62);
                    if let Some(msg) = state_for_send
                        .msg_arr
                        .lock()
                        .unwrap()
                        .iter()
                        .find(|m| m.id == id)
                    {
                        debug!("single, id: {id}");
                        bts.put_i32_le(4);
                        bts.put_i32_le(msg.id);

                        bts.put_i32_le(4);
                        bts.put_i32_le(msg.msg_type);

                        let text_byte_arr = msg.text.as_bytes();
                        bts.put_i32_le(text_byte_arr.len() as i32);
                        bts.put(text_byte_arr);
                    }
                    if !bts.is_empty() {
                        let _ = sender.send(Message::Binary(bts.to_vec())).await;
                    }
                }
            }
        }
    });

    tokio::select! {
        _ = (&mut recv) => send.abort(),
        _ = (&mut send) => recv.abort(),
    }
}

async fn query_file(Path(path): Path<String>) -> impl IntoResponse {
    let path = path.trim_start_matches('/');
    let mime_type = mime_guess::from_path(path).first_or_text_plain();

    let path = std::path::Path::new(UPLOAD_DIR).join(path);
    if let Ok(file) = tokio::fs::read(path).await {
        Response::builder()
            .status(StatusCode::OK)
            .header(
                header::CONTENT_TYPE,
                HeaderValue::from_str(mime_type.as_ref()).unwrap(),
            )
            .body(body::boxed(Full::from(file)))
            .unwrap()
    } else {
        Response::builder()
            .status(StatusCode::NO_CONTENT)
            .header(header::CONTENT_TYPE, "")
            .body(body::boxed(Full::default()))
            .unwrap()
    }
}

struct AppState {
    tx: broadcast::Sender<QueryType>,
    id_gen: Mutex<i32>,
    msg_arr: Mutex<Vec<Msg>>,
}

impl AppState {
    fn new() -> Self {
        let (tx, _) = broadcast::channel(128);
        AppState {
            tx,
            id_gen: Mutex::new(0),
            msg_arr: Mutex::new(vec![]),
        }
    }

    fn next_id(&self) -> i32 {
        let result = *self.id_gen.lock().unwrap();
        *self.id_gen.lock().unwrap() += 1;
        result
    }
}

type MsgType = i32;
const MSG_T_TEXT: MsgType = 1;
const MSG_T_FILE: MsgType = 2;

struct Msg {
    id: i32,
    msg_type: MsgType,
    text: String,
}

impl Msg {
    fn new(id: i32, msg_type: MsgType, text: String) -> Self {
        Self { id, msg_type, text }
    }
}

#[derive(Clone, Copy)]
enum QueryType {
    All,
    Single(i32),
}
