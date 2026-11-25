//! Opens an address in the system browser (update notice: the installer
//! download). Only called with the fixed GitHub addresses of `routing`.

use std::io;
use std::process::{Command, Stdio};

pub fn open_in_browser(url: &str) -> io::Result<()> {
    command(url)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
}

#[cfg(target_os = "windows")]
fn command(url: &str) -> Command {
    // explorer.exe hands a URL to the default browser, without a console.
    let mut command = Command::new("explorer.exe");
    command.arg(url);
    command
}

#[cfg(target_os = "macos")]
fn command(url: &str) -> Command {
    let mut command = Command::new("open");
    command.arg(url);
    command
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn command(url: &str) -> Command {
    let mut command = Command::new("xdg-open");
    command.arg(url);
    // An AppImage sets its own library paths; the browser must not get them.
    for var in [
        "LD_LIBRARY_PATH",
        "LD_PRELOAD",
        "GTK_PATH",
        "GIO_MODULE_DIR",
    ] {
        command.env_remove(var);
    }
    command
}
