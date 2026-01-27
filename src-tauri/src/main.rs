// BMAD Studio - Desktop Entry Point
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    bmad_studio_lib::run()
}
