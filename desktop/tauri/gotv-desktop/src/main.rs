//! GoTV desktop app (Windows, macOS, Linux): starts the local server
//! (gotv-server) with the embedded app build and opens one window on it.
//! The page talks to KGS through the server's /json/access proxy - the same
//! setup as the Linux desktop app with desktop/goTV_local.py.

// No console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashSet;
use std::sync::Arc;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let server = gotv_server::Server::start(
                gotv_server::Config::default(),
                embedded_files(app.handle()),
            )?;
            eprintln!("GoTV: local server on {}", server.url());
            let url = server.url().parse()?;
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("GoTV")
                .inner_size(1280.0, 820.0)
                .min_inner_size(480.0, 360.0)
                .resizable(true)
                .build()?;
            // Keeps the server running as long as the app.
            app.manage(server);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("GoTV could not start");
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
