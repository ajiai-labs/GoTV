//! Local HTTP server of the GoTV desktop apps (Windows, macOS, Linux).
//!
//! Same behaviour as `desktop/goTV_local.py`, the Linux desktop server:
//! listens on 127.0.0.1 only (here on a free port), serves the app build
//! with SPA fallback, guards against DNS rebinding and forwards
//! `/json/access` to KGS without the Origin header (AGENTS.md,
//! "Proxy-Begründung"). Static files come from an injected resolver, so the
//! Tauri app can serve its embedded assets and tests can use a map - this
//! crate has no Tauri dependency.

mod open;
mod proxy;
pub mod routing;

/// Opens a URL in the system browser (also used by the desktop app for
/// links that a page opens in a new window).
pub use open::open_in_browser;

use std::io;
use std::sync::Arc;
use std::thread::{self, JoinHandle};

use tiny_http::{Header, Method, Request, Response};

use routing::Route;

/// The KGS JSON endpoint for clients outside the browser.
pub const KGS_UPSTREAM_URL: &str = "https://www.gokgs.com/json/access";

/// Returns the bytes of a build file by its relative path ("index.html",
/// "_app/immutable/x.js"), or None if there is no such file.
pub type Resolver = Arc<dyn Fn(&str) -> Option<Vec<u8>> + Send + Sync>;

/// Opens an address in the system browser.
pub type Opener = Arc<dyn Fn(&str) -> io::Result<()> + Send + Sync>;

#[derive(Clone)]
pub struct Config {
    /// Where `/json/access` goes; tests point it at a local fake.
    pub upstream_url: String,
    /// Opens the GoTV download addresses (`/desktop/open-...`); tests record
    /// the address instead of starting a browser.
    pub open_url: Opener,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            upstream_url: KGS_UPSTREAM_URL.to_string(),
            open_url: Arc::new(open::open_in_browser),
        }
    }
}

/// A running server; stops when dropped.
pub struct Server {
    port: u16,
    http: Arc<tiny_http::Server>,
    thread: Option<JoinHandle<()>>,
}

impl Server {
    /// Binds 127.0.0.1 on a free port and serves in a background thread
    /// (one more thread per request, so long-polling never blocks others).
    pub fn start(config: Config, resolver: Resolver) -> io::Result<Self> {
        let http = tiny_http::Server::http("127.0.0.1:0").map_err(io::Error::other)?;
        let port = http
            .server_addr()
            .to_ip()
            .map(|addr| addr.port())
            .ok_or_else(|| io::Error::other("no TCP port"))?;
        let http = Arc::new(http);
        let context = Arc::new(Context {
            port,
            resolver,
            proxy: proxy::Proxy::new(config.upstream_url),
            open_url: config.open_url,
        });

        let server = Arc::clone(&http);
        let thread = thread::Builder::new()
            .name("gotv-server".into())
            .spawn(move || {
                for request in server.incoming_requests() {
                    let context = Arc::clone(&context);
                    let spawned = thread::Builder::new()
                        .name("gotv-request".into())
                        .spawn(move || context.handle(request));
                    if let Err(err) = spawned {
                        eprintln!("gotv-server: cannot start request thread: {err}");
                    }
                }
            })?;

        Ok(Self {
            port,
            http,
            thread: Some(thread),
        })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    /// The start page, e.g. http://127.0.0.1:49152/
    pub fn url(&self) -> String {
        format!("http://127.0.0.1:{}/", self.port)
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        self.http.unblock();
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

struct Context {
    port: u16,
    resolver: Resolver,
    proxy: proxy::Proxy,
    open_url: Opener,
}

impl Context {
    fn handle(&self, request: Request) {
        let host = header_value(&request, "Host");
        let origin = header_value(&request, "Origin");
        if let Err(reason) = routing::check_guard(host.as_deref(), origin.as_deref(), self.port) {
            let _ = request.respond(text_response(403, reason));
            return;
        }

        let method = request.method().clone();
        let response = match routing::route(request.url()) {
            Route::Proxy => return self.proxy.handle(request),
            Route::IgsBridge => text_response(
                501,
                "/igs-bridge ist reserviert fuer eine kuenftige IGS-Quelle. Solange die \
                 IGS-Nutzungsbedingungen nicht geprueft sind, wird nichts implementiert.",
            ),
            Route::OpenUrl(url) => match method {
                Method::Post => match (self.open_url)(&url) {
                    Ok(()) => text_response(200, "OK"),
                    Err(err) => {
                        eprintln!("gotv-server: cannot open {url}: {err}");
                        text_response(500, "Browser konnte nicht gestartet werden")
                    }
                },
                _ => text_response(405, "Method not allowed"),
            },
            Route::BadRequest => text_response(400, "Bad request"),
            Route::Forbidden => text_response(403, "Forbidden"),
            Route::Static(rel) => match method {
                Method::Get | Method::Head | Method::Post => self.serve_static(&rel),
                Method::Options => text_response(404, "Not found"),
                _ => text_response(501, "Unsupported method"),
            },
        };
        // tiny_http leaves out the body for HEAD itself.
        let _ = request.respond(response);
    }

    fn serve_static(&self, rel: &str) -> Response<io::Cursor<Vec<u8>>> {
        for candidate in routing::static_candidates(rel) {
            if let Some(data) = (self.resolver)(&candidate) {
                return Response::from_data(data)
                    .with_header(header("Content-Type", routing::content_type(&candidate)))
                    .with_header(header("Cache-Control", "no-cache"));
            }
        }
        text_response(404, "Not found")
    }
}

fn header_value(request: &Request, name: &str) -> Option<String> {
    request
        .headers()
        .iter()
        .find(|h| h.field.as_str().as_str().eq_ignore_ascii_case(name))
        .map(|h| h.value.as_str().to_string())
}

fn header(name: &str, value: &str) -> Header {
    Header::from_bytes(name.as_bytes(), value.as_bytes()).expect("valid header")
}

pub(crate) fn text_response(status: u16, text: &str) -> Response<io::Cursor<Vec<u8>>> {
    Response::from_string(format!("{text}\n"))
        .with_status_code(status)
        .with_header(header("Content-Type", "text/plain; charset=utf-8"))
}
