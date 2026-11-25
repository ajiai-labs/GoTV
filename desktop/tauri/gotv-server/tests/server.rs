//! End-to-end tests: real sockets, a fake KGS upstream on 127.0.0.1, no
//! internet.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use gotv_server::{Config, Resolver, Server};

struct Reply {
    status: u16,
    headers: Vec<(String, String)>,
    body: String,
}

impl Reply {
    fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(n, _)| n.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.as_str())
    }

    fn all(&self, name: &str) -> Vec<&str> {
        self.headers
            .iter()
            .filter(|(n, _)| n.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.as_str())
            .collect()
    }
}

/// Sends a raw HTTP/1.1 request (full control over Host/Origin).
fn send(port: u16, method: &str, path: &str, headers: &[(&str, &str)], body: &str) -> Reply {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(20)))
        .unwrap();
    let mut text = format!("{method} {path} HTTP/1.1\r\nConnection: close\r\n");
    for (name, value) in headers {
        text.push_str(&format!("{name}: {value}\r\n"));
    }
    if !body.is_empty() {
        text.push_str(&format!("Content-Length: {}\r\n", body.len()));
    }
    text.push_str("\r\n");
    text.push_str(body);
    stream.write_all(text.as_bytes()).unwrap();

    let mut raw = Vec::new();
    stream.read_to_end(&mut raw).unwrap();
    let raw = String::from_utf8_lossy(&raw).to_string();
    let (head, body) = raw.split_once("\r\n\r\n").unwrap_or((&raw, ""));
    let mut lines = head.split("\r\n");
    let status = lines
        .next()
        .unwrap()
        .split(' ')
        .nth(1)
        .unwrap()
        .parse()
        .unwrap();
    let headers = lines
        .filter_map(|l| l.split_once(':'))
        .map(|(n, v)| (n.trim().to_string(), v.trim().to_string()))
        .collect();
    Reply {
        status,
        headers,
        body: body.to_string(),
    }
}

fn get(server: &Server, path: &str) -> Reply {
    let host = format!("127.0.0.1:{}", server.port());
    send(server.port(), "GET", path, &[("Host", &host)], "")
}

fn files() -> Resolver {
    let mut map: HashMap<String, Vec<u8>> = HashMap::new();
    for (path, body) in [
        ("index.html", "START"),
        ("kalender.html", "KALENDER"),
        ("docs/index.html", "DOCS"),
        ("_app/app.js", "JS"),
        ("katago/x.wasm", "WASM"),
    ] {
        map.insert(path.to_string(), body.as_bytes().to_vec());
    }
    Arc::new(move |path: &str| map.get(path).cloned())
}

fn start(upstream_url: &str) -> Server {
    Server::start(
        Config {
            upstream_url: upstream_url.to_string(),
            open_url: Arc::new(|_url: &str| Ok(())),
        },
        files(),
    )
    .unwrap()
}

#[test]
fn binds_to_loopback_on_a_free_port() {
    let a = start("http://127.0.0.1:9/json/access");
    let b = start("http://127.0.0.1:9/json/access");
    assert_ne!(a.port(), 0);
    assert_ne!(a.port(), b.port());
    assert_eq!(a.url(), format!("http://127.0.0.1:{}/", a.port()));
}

#[test]
fn serves_files_with_spa_fallback() {
    let server = start("http://127.0.0.1:9/json/access");
    let start_page = get(&server, "/");
    assert_eq!(
        (start_page.status, start_page.body.as_str()),
        (200, "START")
    );
    assert_eq!(
        start_page.header("Content-Type"),
        Some("text/html; charset=utf-8")
    );
    assert_eq!(start_page.header("Cache-Control"), Some("no-cache"));
    assert_eq!(get(&server, "/kalender").body, "KALENDER");
    assert_eq!(get(&server, "/kalender?x=1").body, "KALENDER");
    assert_eq!(get(&server, "/docs").body, "DOCS");
    assert_eq!(get(&server, "/watch/123").body, "START");
    let js = get(&server, "/_app/app.js");
    assert_eq!(js.body, "JS");
    assert_eq!(
        js.header("Content-Type"),
        Some("application/javascript; charset=utf-8")
    );
    assert_eq!(
        get(&server, "/katago/x.wasm").header("Content-Type"),
        Some("application/wasm")
    );
}

#[test]
fn head_sends_no_body() {
    let server = start("http://127.0.0.1:9/json/access");
    let host = format!("127.0.0.1:{}", server.port());
    let reply = send(server.port(), "HEAD", "/", &[("Host", &host)], "");
    assert_eq!(reply.status, 200);
    assert_eq!(reply.body, "");
}

#[test]
fn refuses_traversal_bad_paths_and_the_igs_bridge() {
    let server = start("http://127.0.0.1:9/json/access");
    assert_eq!(get(&server, "/../etc/passwd").status, 403);
    assert_eq!(get(&server, "/%2e%2e/etc/passwd").status, 400);
    assert_eq!(get(&server, "/igs-bridge").status, 501);
}

#[test]
fn guards_against_dns_rebinding() {
    let server = start("http://127.0.0.1:9/json/access");
    let port = server.port();
    let local = format!("127.0.0.1:{port}");
    let localhost = format!("localhost:{port}");
    let origin = format!("http://localhost:{port}");

    let foreign_host = send(port, "GET", "/", &[("Host", "evil.example")], "");
    assert_eq!(
        (foreign_host.status, foreign_host.body.trim()),
        (403, "Forbidden host")
    );
    let other_port = send(port, "GET", "/", &[("Host", "127.0.0.1:1")], "");
    assert_eq!(other_port.status, 403);
    let foreign_origin = send(
        port,
        "GET",
        "/",
        &[("Host", &local), ("Origin", "http://evil.example")],
        "",
    );
    assert_eq!(
        (foreign_origin.status, foreign_origin.body.trim()),
        (403, "Forbidden origin")
    );
    // The proxy is guarded too.
    let proxied = send(
        port,
        "POST",
        "/json/access",
        &[("Host", "evil.example")],
        "{}",
    );
    assert_eq!(proxied.status, 403);

    assert_eq!(
        send(port, "GET", "/", &[("Host", &localhost)], "").status,
        200
    );
    assert_eq!(
        send(
            port,
            "GET",
            "/",
            &[("Host", &local), ("Origin", &origin)],
            ""
        )
        .status,
        200
    );
}

/// What the fake KGS received.
#[derive(Debug, Clone)]
struct Seen {
    method: String,
    url: String,
    headers: Vec<(String, String)>,
    body: String,
}

impl Seen {
    fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(n, _)| n.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.as_str())
    }
}

/// A fake KGS on 127.0.0.1. GET waits for `release` (long-polling).
fn fake_kgs() -> (String, Arc<Mutex<Vec<Seen>>>, mpsc::Sender<()>) {
    let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
    let port = server.server_addr().to_ip().unwrap().port();
    let seen = Arc::new(Mutex::new(Vec::new()));
    let (release, released) = mpsc::channel::<()>();
    let released = Arc::new(Mutex::new(released));
    let log = Arc::clone(&seen);
    thread::spawn(move || {
        for mut request in server.incoming_requests() {
            let log = Arc::clone(&log);
            let released = Arc::clone(&released);
            thread::spawn(move || {
                let mut body = String::new();
                request.as_reader().read_to_string(&mut body).unwrap();
                let entry = Seen {
                    method: request.method().as_str().to_string(),
                    url: request.url().to_string(),
                    headers: request
                        .headers()
                        .iter()
                        .map(|h| {
                            (
                                h.field.as_str().as_str().to_string(),
                                h.value.as_str().to_string(),
                            )
                        })
                        .collect(),
                    body: body.clone(),
                };
                log.lock().unwrap().push(entry);
                let header = |n: &str, v: &str| tiny_http::Header::from_bytes(n, v).unwrap();
                let response = match request.method() {
                    tiny_http::Method::Get => {
                        released
                            .lock()
                            .unwrap()
                            .recv_timeout(Duration::from_secs(15))
                            .unwrap();
                        tiny_http::Response::from_string(r#"{"messages":[{"type":"HELLO"}]}"#)
                            .with_header(header("Content-Type", "application/json;charset=UTF-8"))
                    }
                    tiny_http::Method::Options => {
                        tiny_http::Response::from_string("").with_status_code(204)
                    }
                    _ if body.contains("bad") => {
                        tiny_http::Response::from_string("nope").with_status_code(403)
                    }
                    _ => tiny_http::Response::from_string(format!("echo:{body}"))
                        .with_header(header("Content-Type", "text/plain;charset=UTF-8"))
                        .with_header(header(
                            "Set-Cookie",
                            "JSESSIONID=abc; Path=/json; Domain=www.gokgs.com; Secure; HttpOnly",
                        ))
                        .with_header(header("Set-Cookie", "other=1; Path=/json"))
                        .with_header(header("X-Internal", "secret"))
                        .with_header(header("Cache-Control", "no-store")),
                };
                request.respond(response).unwrap();
            });
        }
    });
    (
        format!("http://127.0.0.1:{port}/json/access"),
        seen,
        release,
    )
}

#[test]
fn proxies_post_without_origin_and_with_cookies() {
    let (upstream, seen, _release) = fake_kgs();
    let server = start(&upstream);
    let port = server.port();
    let host = format!("127.0.0.1:{port}");
    let origin = format!("http://127.0.0.1:{port}");

    let reply = send(
        port,
        "POST",
        "/json/access",
        &[
            ("Host", &host),
            ("Origin", &origin),
            ("Cookie", "JSESSIONID=abc"),
            ("Content-Type", "application/json;charset=UTF-8"),
            ("Referer", &origin),
        ],
        r#"{"type":"LOGIN"}"#,
    );
    assert_eq!(reply.status, 200);
    assert_eq!(reply.body, r#"echo:{"type":"LOGIN"}"#);
    assert_eq!(
        reply.header("Content-Type"),
        Some("text/plain;charset=UTF-8")
    );
    assert_eq!(reply.header("Cache-Control"), Some("no-store"));
    assert_eq!(reply.header("X-Internal"), None);
    assert_eq!(
        reply.all("Set-Cookie"),
        vec![
            "JSESSIONID=abc; Path=/json; HttpOnly",
            "other=1; Path=/json"
        ]
    );

    let request = seen.lock().unwrap()[0].clone();
    assert_eq!(request.method, "POST");
    assert_eq!(request.url, "/json/access");
    assert_eq!(request.body, r#"{"type":"LOGIN"}"#);
    assert_eq!(request.header("Origin"), None, "Origin must not reach KGS");
    assert_eq!(request.header("Referer"), None);
    assert_eq!(request.header("Cookie"), Some("JSESSIONID=abc"));
    assert_eq!(
        request.header("Content-Type"),
        Some("application/json;charset=UTF-8")
    );
    assert_eq!(
        request.header("Host"),
        Some(
            upstream
                .trim_start_matches("http://")
                .trim_end_matches("/json/access")
        )
    );
}

#[test]
fn passes_kgs_errors_and_options_through() {
    let (upstream, _seen, _release) = fake_kgs();
    let server = start(&upstream);
    let host = format!("127.0.0.1:{}", server.port());
    let denied = send(
        server.port(),
        "POST",
        "/json/access",
        &[("Host", &host)],
        "bad",
    );
    assert_eq!((denied.status, denied.body.as_str()), (403, "nope"));
    let options = send(
        server.port(),
        "OPTIONS",
        "/json/access",
        &[("Host", &host)],
        "",
    );
    assert_eq!(options.status, 204);
}

#[test]
fn long_polling_get_does_not_block_other_requests() {
    let (upstream, seen, release) = fake_kgs();
    let server = start(&upstream);
    let port = server.port();
    let host = format!("127.0.0.1:{port}");

    let poll_host = host.clone();
    let poll = thread::spawn(move || {
        send(
            port,
            "GET",
            "/json/access",
            &[("Host", &poll_host), ("Cookie", "JSESSIONID=abc")],
            "",
        )
    });
    // Wait until the GET is held open upstream.
    let deadline = Instant::now() + Duration::from_secs(10);
    while !seen.lock().unwrap().iter().any(|s| s.method == "GET") {
        assert!(Instant::now() < deadline, "GET never reached the fake KGS");
        thread::sleep(Duration::from_millis(20));
    }

    // Meanwhile: static files and a POST still answer.
    assert_eq!(get(&server, "/").body, "START");
    let post = send(port, "POST", "/json/access", &[("Host", &host)], "x");
    assert_eq!(post.body, "echo:x");
    assert!(!poll.is_finished());

    release.send(()).unwrap();
    let reply = poll.join().unwrap();
    assert_eq!(reply.status, 200);
    assert_eq!(reply.body, r#"{"messages":[{"type":"HELLO"}]}"#);
    let get_seen = seen
        .lock()
        .unwrap()
        .iter()
        .find(|s| s.method == "GET")
        .cloned()
        .unwrap();
    assert_eq!(get_seen.header("Cookie"), Some("JSESSIONID=abc"));
}

#[test]
fn unreachable_kgs_gives_502() {
    // Port 9 (discard) is closed on loopback.
    let server = start("http://127.0.0.1:9/json/access");
    let host = format!("127.0.0.1:{}", server.port());
    let reply = send(
        server.port(),
        "POST",
        "/json/access",
        &[("Host", &host)],
        "x",
    );
    assert_eq!(reply.status, 502);
}

#[test]
fn opens_a_known_installer_in_the_browser_on_post_only() {
    let opened: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    let record = Arc::clone(&opened);
    let server = Server::start(
        Config {
            upstream_url: "http://127.0.0.1:9/json/access".to_string(),
            open_url: Arc::new(move |url: &str| {
                record.lock().unwrap().push(url.to_string());
                Ok(())
            }),
        },
        files(),
    )
    .unwrap();
    let host = format!("127.0.0.1:{}", server.port());
    let origin = format!("http://127.0.0.1:{}", server.port());
    let path = "/desktop/open-download/GoTV-windows-x64-setup.exe";

    // GET does not open anything.
    assert_eq!(get(&server, path).status, 405);
    // An unknown file is refused.
    let unknown = send(
        server.port(),
        "POST",
        "/desktop/open-download/other.exe",
        &[("Host", &host), ("Origin", &origin)],
        "",
    );
    assert_eq!(unknown.status, 403);
    // Another website cannot trigger it.
    let foreign = send(
        server.port(),
        "POST",
        path,
        &[("Host", &host), ("Origin", "https://evil.example")],
        "",
    );
    assert_eq!(foreign.status, 403);
    assert!(opened.lock().unwrap().is_empty());

    let reply = send(
        server.port(),
        "POST",
        path,
        &[("Host", &host), ("Origin", &origin)],
        "",
    );
    assert_eq!(reply.status, 200);
    assert_eq!(
        *opened.lock().unwrap(),
        vec![
            "https://github.com/ajiai-labs/GoTV/releases/latest/download/GoTV-windows-x64-setup.exe"
                .to_string()
        ]
    );
}
