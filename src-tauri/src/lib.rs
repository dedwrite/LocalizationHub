mod deepl;
mod external_tool;
mod scan;
mod tempdir;
mod translation;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(
            tauri::generate_handler![
                translation::translate_with_google,
                translation::translate_with_gemini,
                deepl::translate_with_deepl,
                scan::scan_directory,
                external_tool::run_external_tool,
                tempdir::create_temp_job_dir,
                tempdir::remove_temp_dir,
            ],
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}