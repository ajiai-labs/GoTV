//! GoTV desktop app (Windows, macOS, Linux): starts the local server
//! (gotv-server) with the embedded app build and opens one window on it.
//! The page talks to KGS through the server's /json/access proxy - the same
//! setup as the Linux desktop app with desktop/goTV_local.py.
//!
//! Game windows (window.open of /partie or /bretter, opened empty by name
//! and then loaded - app/src/lib/gameWindows.ts) open as
//! further app windows on the same server; they share the KGS connection of
//! the first window in the page (windowLink.ts). Links that a page opens in
//! a new window to anywhere else (e.g. from a stream player) go to the
//! system browser.

// No console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashSet;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use tauri::webview::{NewWindowFeatures, NewWindowResponse};
use tauri::{AppHandle, Manager, Runtime, Url, WebviewUrl, WebviewWindowBuilder};

/// Numbers the labels of further windows ("fenster-1", ...).
static WINDOW_COUNT: AtomicUsize = AtomicUsize::new(0);

type NewWindowHandler<R> =
    Box<dyn Fn(Url, NewWindowFeatures) -> NewWindowResponse<R> + Send + 'static>;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let server = gotv_server::Server::start(
                gotv_server::Config::default(),
                embedded_files(app.handle()),
            )?;
            eprintln!("GoTV: local server on {}", server.url());
            let url: Url = server.url().parse()?;
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.clone()))
                .title("GoTV")
                .inner_size(1280.0, 820.0)
                .min_inner_size(480.0, 360.0)
                .resizable(true)
                .on_new_window(new_window_handler(app.handle().clone(), url))
                .build()?;
            // Keeps the server running as long as the app.
            app.manage(server);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("GoTV could not start");
}

/// window.open in a GoTV window: a page of the local server becomes another
/// app window (related to the opener, so window.open returns it and the
/// windows share storage); anything else opens in the system browser.
fn new_window_handler<R: Runtime>(app: AppHandle<R>, server: Url) -> NewWindowHandler<R> {
    Box::new(move |url, features| {
        // GoTV opens its windows empty by name first (gameWindows.ts) and
        // then loads the page itself; that is "about:blank".
        let local = url.origin() == server.origin() || url.as_str() == "about:blank";
        if !local {
            if matches!(url.scheme(), "http" | "https") {
                if let Err(err) = gotv_server::open_in_browser(url.as_str()) {
                    eprintln!("GoTV: could not open {url}: {err}");
                }
            }
            return NewWindowResponse::Deny;
        }
        let label = format!(
            "fenster-{}",
            WINDOW_COUNT.fetch_add(1, Ordering::Relaxed) + 1
        );
        let blank = match "about:blank".parse() {
            Ok(blank) => blank,
            Err(_) => return NewWindowResponse::Deny,
        };
        let built = WebviewWindowBuilder::new(&app, label, WebviewUrl::External(blank))
            .window_features(features)
            .title("GoTV")
            .min_inner_size(480.0, 360.0)
            .on_document_title_changed(|window, title| {
                let _ = window.set_title(&title);
            })
            .on_new_window(new_window_handler(app.clone(), server.clone()))
            .build();
        match built {
            Ok(window) => NewWindowResponse::Create { window },
            Err(err) => {
                eprintln!("GoTV: could not open a window: {err}");
                NewWindowResponse::Deny
            }
        }
    })
}

/// The app build (frontendDist, embedded at compile time) as a resolver.
/// Only exact file names are looked up: Tauri's own resolver would fall
/// back to index.html, but gotv-server does its own SPA fallback.
fn embedded_files(handle: &tauri::AppHandle) -> gotv_server::Resolver {
    let names: HashSet<String> = handle
        .asset_resolver()
        .iter()
        .map(|(name, _)| name.trim_start_matches('/').to_string())
        .collect();
    let handle = handle.clone();
    Arc::new(move |path: &str| {
        if !names.contains(path) {
            return None;
        }
        handle
            .asset_resolver()
            .get(path.to_string())
            .map(|asset| asset.bytes)
    })
}
