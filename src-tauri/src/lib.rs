mod deepl;
mod external_tool;
mod extraction_io;
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
        .manage(extraction_io::ExtractionAuthorizedRoots::default())
        .invoke_handler(
            tauri::generate_handler![
                translation::translate_with_google,
                translation::translate_with_gemini,
                deepl::translate_with_deepl,
                scan::scan_directory,
                external_tool::run_external_tool,
                tempdir::create_temp_job_dir,
                tempdir::remove_temp_dir,
                extraction_io::register_extraction_root,
                extraction_io::unregister_extraction_root,
                extraction_io::read_extraction_text,
                extraction_io::read_extraction_binary,
                extraction_io::read_extraction_text_batch,
                extraction_io::read_extraction_binary_batch,
                extraction_io::copy_extraction_file,
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