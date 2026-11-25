//! Request routing, DNS-rebinding guard and static-file lookup.
//!
//! Pure functions without I/O, so they are unit-tested directly. Behaviour
//! mirrors `desktop/goTV_local.py` (the Linux desktop server).

/// The KGS endpoint the app calls (built with `VITE_API_URL=/json/access`).
pub const PROXY_PATH: &str = "/json/access";

/// Reserved for a future IGS source; answers 501 until the IGS terms of
/// use are checked (AGENTS.md, "IgsTvSource - BLOCKIERT").
const IGS_BRIDGE_PATH: &str = "/igs-bridge";

const INDEX: &str = "index.html";

/// GoTV's releases on GitHub.
pub const RELEASES_URL: &str = "https://github.com/ajiai-labs/GoTV/releases";

/// The installers the app may open in the system browser (update notice):
/// the fixed names every release carries (.github/workflows/desktop.yml).
/// Only these - the endpoint never opens an address from the request.
pub const DOWNLOAD_FILES: [&str; 5] = [
    "GoTV-windows-x64-setup.exe",
    "GoTV-windows-x64.msi",
    "GoTV-macos-universal.dmg",
    "GoTV-linux-x86_64.AppImage",
    "GoTV-linux-amd64.deb",
];

const OPEN_DOWNLOAD_PREFIX: &str = "/desktop/open-download/";
const OPEN_RELEASES_PATH: &str = "/desktop/open-releases";

/// Where a request goes.
#[derive(Debug, PartialEq, Eq)]
pub enum Route {
    /// `/json/access` - forwarded to KGS.
    Proxy,
    /// `/igs-bridge` - deliberately not implemented (501).
    IgsBridge,
    /// `/desktop/open-download/<file>`, `/desktop/open-releases` - opens this
    /// GitHub address in the system browser (POST only).
    OpenUrl(String),
    /// A file of the build; the relative path ("" = the start page).
    Static(String),
    /// Characters outside `[A-Za-z0-9_\-./]` (400).
    BadRequest,
    /// The path leaves the build directory (403).
    Forbidden,
}

/// Maps a request URL (path plus optional query) to a route.
pub fn route(url: &str) -> Route {
    let path = url.split(['?', '#']).next().unwrap_or("");
    if path == PROXY_PATH {
        return Route::Proxy;
    }
    if path == IGS_BRIDGE_PATH || path.starts_with("/igs-bridge/") {
        return Route::IgsBridge;
    }
    if path == OPEN_RELEASES_PATH {
        return Route::OpenUrl(format!("{RELEASES_URL}/latest"));
    }
    if let Some(file) = path.strip_prefix(OPEN_DOWNLOAD_PREFIX) {
        return match DOWNLOAD_FILES.iter().find(|name| **name == file) {
            Some(name) => Route::OpenUrl(format!("{RELEASES_URL}/latest/download/{name}")),
            None => Route::Forbidden,
        };
    }
    if path.is_empty() || !path.chars().all(is_safe_path_char) {
        return Route::BadRequest;
    }
    match normalize(path) {
        Some(rel) => Route::Static(rel),
        None => Route::Forbidden,
    }
}

fn is_safe_path_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '/')
}

/// Resolves "." and ".." like `os.path.normpath`; None if the path would
/// leave the build directory.
fn normalize(path: &str) -> Option<String> {
    let mut parts: Vec<&str> = Vec::new();
    for segment in path.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                parts.pop()?;
            }
            other => parts.push(other),
        }
    }
    Some(parts.join("/"))
}

/// Files tried for a static route, in order: the path itself, `<path>.html`
/// (SvelteKit prerenders one file per page: /kalender -> kalender.html),
/// `<path>/index.html`, then the start page (SPA fallback).
pub fn static_candidates(rel: &str) -> Vec<String> {
    if rel.is_empty() {
        return vec![INDEX.to_string()];
    }
    vec![
        rel.to_string(),
        format!("{rel}.html"),
        format!("{rel}/{INDEX}"),
        INDEX.to_string(),
    ]
}

/// DNS-rebinding guard: the Host header must be exactly 127.0.0.1:<port> or
/// localhost:<port>; an Origin header, if present, must be exactly
/// http://127.0.0.1:<port> or http://localhost:<port>. Err = reason for 403.
pub fn check_guard(
    host: Option<&str>,
    origin: Option<&str>,
    port: u16,
) -> Result<(), &'static str> {
    let host = host.map(str::trim).unwrap_or("");
    let allowed_host = [format!("127.0.0.1:{port}"), format!("localhost:{port}")];
    if !allowed_host.iter().any(|h| h == host) {
        return Err("Forbidden host");
    }
    let origin = origin.map(str::trim).unwrap_or("");
    if !origin.is_empty() {
        let allowed_origin = [
            format!("http://127.0.0.1:{port}"),
            format!("http://localhost:{port}"),
        ];
        if !allowed_origin.iter().any(|o| o == origin) {
            return Err("Forbidden origin");
        }
    }
    Ok(())
}

/// Content type by file extension (same table as goTV_local.py).
pub fn content_type(path: &str) -> &'static str {
    let file = path.rsplit('/').next().unwrap_or(path);
    let ext = match file.rfind('.') {
        Some(i) => file[i + 1..].to_ascii_lowercase(),
        None => String::new(),
    };
    match ext.as_str() {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "application/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "webmanifest" => "application/manifest+json",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "eot" => "application/vnd.ms-fontobject",
        "txt" => "text/plain; charset=utf-8",
        "sgf" => "application/x-go-sgf",
        "wasm" => "application/wasm",
        "xml" => "application/xml",
        _ => "application/octet-stream",
    }
}

/// Makes a KGS Set-Cookie usable on http://127.0.0.1:<port>: drops the
/// Domain attribute (the cookie then belongs to the local host; Path=/json
/// still matches /json/access) and Secure (the local hop is plain http,
/// WebKit would refuse the cookie). SameSite=None needs Secure, so it goes
/// too - the requests are same-origin anyway.
pub fn rewrite_set_cookie(value: &str) -> String {
    value
        .split(';')
        .enumerate()
        .filter(|(i, part)| {
            if *i == 0 {
                return true;
            }
            let attr = part.trim().to_ascii_lowercase();
            let name = attr.split('=').next().unwrap_or("").trim();
            !(name == "domain"
                || name == "secure"
                || (name == "samesite" && attr.ends_with("none")))
        })
        .map(|(_, part)| part.trim())
        .collect::<Vec<_>>()
        .join("; ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routes_the_kgs_endpoint_with_and_without_query() {
        assert_eq!(route("/json/access"), Route::Proxy);
        assert_eq!(route("/json/access?x=1"), Route::Proxy);
        assert_eq!(route("/json/accessx"), Route::Static("json/accessx".into()));
    }

    #[test]
    fn reserves_the_igs_bridge() {
        assert_eq!(route("/igs-bridge"), Route::IgsBridge);
        assert_eq!(route("/igs-bridge/x"), Route::IgsBridge);
    }

    #[test]
    fn opens_only_the_known_installers_and_the_release_page() {
        assert_eq!(
            route("/desktop/open-download/GoTV-linux-x86_64.AppImage"),
            Route::OpenUrl(
                "https://github.com/ajiai-labs/GoTV/releases/latest/download/GoTV-linux-x86_64.AppImage"
                    .into()
            )
        );
        assert_eq!(
            route("/desktop/open-releases"),
            Route::OpenUrl("https://github.com/ajiai-labs/GoTV/releases/latest".into())
        );
        for file in DOWNLOAD_FILES {
            assert!(matches!(
                route(&format!("/desktop/open-download/{file}")),
                Route::OpenUrl(_)
            ));
        }
        assert_eq!(route("/desktop/open-download/evil.exe"), Route::Forbidden);
        assert_eq!(route("/desktop/open-download/"), Route::Forbidden);
        assert_eq!(
            route("/desktop/open-download/https://evil.example/x"),
            Route::Forbidden
        );
    }

    #[test]
    fn maps_paths_to_build_files() {
        assert_eq!(route("/"), Route::Static(String::new()));
        assert_eq!(route("/kalender"), Route::Static("kalender".into()));
        assert_eq!(route("/_app/x.js?v=1"), Route::Static("_app/x.js".into()));
        assert_eq!(route("/a/./b//c"), Route::Static("a/b/c".into()));
        assert_eq!(route("/a/../b"), Route::Static("b".into()));
    }

    #[test]
    fn blocks_path_traversal() {
        assert_eq!(route("/../secret"), Route::Forbidden);
        assert_eq!(route("/a/../../secret"), Route::Forbidden);
        assert_eq!(route("/%2e%2e/secret"), Route::BadRequest);
        assert_eq!(route("/a\\..\\b"), Route::BadRequest);
        assert_eq!(route("http://evil.example/"), Route::BadRequest);
        assert_eq!(route(""), Route::BadRequest);
    }

    #[test]
    fn tries_file_html_page_directory_index_then_start_page() {
        assert_eq!(static_candidates(""), vec!["index.html"]);
        assert_eq!(
            static_candidates("kalender"),
            vec![
                "kalender",
                "kalender.html",
                "kalender/index.html",
                "index.html"
            ]
        );
    }

    #[test]
    fn guard_accepts_local_hosts_and_origins() {
        assert!(check_guard(Some("127.0.0.1:4000"), None, 4000).is_ok());
        assert!(check_guard(Some("localhost:4000"), Some("http://localhost:4000"), 4000).is_ok());
        assert!(check_guard(Some("127.0.0.1:4000"), Some("http://127.0.0.1:4000"), 4000).is_ok());
        assert!(check_guard(Some("127.0.0.1:4000"), Some(""), 4000).is_ok());
    }

    #[test]
    fn guard_rejects_foreign_hosts_and_origins() {
        assert_eq!(check_guard(None, None, 4000), Err("Forbidden host"));
        assert_eq!(
            check_guard(Some("evil.example:4000"), None, 4000),
            Err("Forbidden host")
        );
        assert_eq!(
            check_guard(Some("127.0.0.1:4001"), None, 4000),
            Err("Forbidden host")
        );
        assert_eq!(
            check_guard(Some("127.0.0.1"), None, 4000),
            Err("Forbidden host")
        );
        assert_eq!(
            check_guard(Some("127.0.0.1:4000"), Some("http://evil.example"), 4000),
            Err("Forbidden origin")
        );
        assert_eq!(
            check_guard(Some("127.0.0.1:4000"), Some("https://127.0.0.1:4000"), 4000),
            Err("Forbidden origin")
        );
        assert_eq!(
            check_guard(Some("127.0.0.1:4000"), Some("null"), 4000),
            Err("Forbidden origin")
        );
    }

    #[test]
    fn content_types_follow_the_extension() {
        assert_eq!(content_type("index.html"), "text/html; charset=utf-8");
        assert_eq!(content_type("katago/tfjs/x.WASM"), "application/wasm");
        assert_eq!(content_type("tv/demo.sgf"), "application/x-go-sgf");
        assert_eq!(content_type("a.b/noext"), "application/octet-stream");
    }

    #[test]
    fn set_cookie_loses_domain_and_secure() {
        assert_eq!(
            rewrite_set_cookie("JSESSIONID=abc; Path=/json; Domain=.gokgs.com; Secure; HttpOnly"),
            "JSESSIONID=abc; Path=/json; HttpOnly"
        );
        assert_eq!(
            rewrite_set_cookie("a=b; SameSite=None; Secure; path=/json"),
            "a=b; path=/json"
        );
        assert_eq!(rewrite_set_cookie("a=b; SameSite=Lax"), "a=b; SameSite=Lax");
        assert_eq!(rewrite_set_cookie("domain=x; Path=/"), "domain=x; Path=/");
    }
}
