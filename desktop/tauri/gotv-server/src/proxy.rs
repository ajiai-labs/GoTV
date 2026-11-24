//! Forwards `/json/access` to KGS.
//!
//! The Origin header is deliberately NOT forwarded: even the regular
//! /json/access endpoint enforces KGS' origin whitelist and answers 403 for
//! http://127.0.0.1:<port>; without Origin it answers 200 + cookie
//! (measured, see AGENTS.md "Proxy-Begründung").

use std::io::Read;
use std::time::Duration;

use tiny_http::{Header, Request, Response, StatusCode};
use ureq::http;

/// Headers passed from the app to KGS; everything else (Origin, Host,
/// Referer, Accept-Encoding, ...) is dropped.
const REQUEST_HEADERS: &[&str] = &[
    "accept",
    "accept-language",
    "content-type",
    "cookie",
    "user-agent",
    "x-requested-with",
];

/// Headers passed from KGS back to the app (Content-Length is set anew).
const RESPONSE_HEADERS: &[&str] = &[
    "content-type",
    "set-cookie",
    "cache-control",
    "expires",
    "pragma",
];

/// Largest request body accepted from the app (KGS messages are small).
const MAX_REQUEST_BODY: u64 = 1024 * 1024;
/// Largest KGS response read.
const MAX_RESPONSE_BODY: u64 = 32 * 1024 * 1024;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
/// POST/OPTIONS; GET is KGS long-polling and has no timeout at all.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(60);

pub struct Proxy {
    upstream_url: String,
    /// For GET: KGS keeps the request open until messages arrive.
    long_poll: ureq::Agent,
    /// For POST/OPTIONS.
    short: ureq::Agent,
}

impl Proxy {
    pub fn new(upstream_url: String) -> Self {
        Self {
            upstream_url,
            long_poll: agent(None),
            short: agent(Some(REQUEST_TIMEOUT)),
        }
    }

    pub fn handle(&self, mut request: Request) {
        let response = match self.forward(&mut request) {
            Ok(response) => response,
            Err(err) => {
                eprintln!("gotv-server proxy error: {err}");
                crate::text_response(502, "KGS proxy error")
            }
        };
        let _ = request.respond(response);
    }

    fn forward(&self, request: &mut Request) -> Result<Response<std::io::Cursor<Vec<u8>>>, String> {
        let method = request.method().as_str().to_ascii_uppercase();
        let (agent, method) = match method.as_str() {
            "GET" => (&self.long_poll, http::Method::GET),
            "POST" => (&self.short, http::Method::POST),
            "OPTIONS" => (&self.short, http::Method::OPTIONS),
            _ => return Ok(crate::text_response(501, "Unsupported method")),
        };

        let mut body = Vec::new();
        request
            .as_reader()
            .take(MAX_REQUEST_BODY)
            .read_to_end(&mut body)
            .map_err(|e| format!("reading request body: {e}"))?;

        let mut builder = http::Request::builder()
            .method(method)
            .uri(&self.upstream_url);
        for header in request.headers() {
            let name = header.field.as_str().as_str().to_ascii_lowercase();
            if REQUEST_HEADERS.contains(&name.as_str()) {
                builder = builder.header(name, header.value.as_str());
            }
        }

        let result = if body.is_empty() {
            agent.run(builder.body(()).map_err(|e| e.to_string())?)
        } else {
            agent.run(builder.body(body).map_err(|e| e.to_string())?)
        };
        let upstream = result.map_err(|e| e.to_string())?;

        let status = upstream.status().as_u16();
        let mut headers = Vec::new();
        for (name, value) in upstream.headers() {
            let name = name.as_str();
            if !RESPONSE_HEADERS.contains(&name) {
                continue;
            }
            let Ok(value) = value.to_str() else { continue };
            let value = if name == "set-cookie" {
                crate::routing::rewrite_set_cookie(value)
            } else {
                value.to_string()
            };
            if let Ok(header) = Header::from_bytes(name.as_bytes(), value.as_bytes()) {
                headers.push(header);
            }
        }
        let data = upstream
            .into_body()
            .with_config()
            .limit(MAX_RESPONSE_BODY)
            .read_to_vec()
            .map_err(|e| format!("reading KGS response: {e}"))?;

        let mut response = Response::from_data(data).with_status_code(StatusCode(status));
        for header in headers {
            response.add_header(header);
        }
        Ok(response)
    }
}

fn agent(timeout: Option<Duration>) -> ureq::Agent {
    ureq::Agent::config_builder()
        // KGS status codes (403, 500, ...) go to the app unchanged.
        .http_status_as_error(false)
        .max_redirects(0)
        .timeout_connect(Some(CONNECT_TIMEOUT))
        .timeout_global(timeout)
        .build()
        .into()
}
