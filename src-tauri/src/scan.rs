use serde::Serialize;
use std::fs;
use std::path::Path;

/*
 * Read-only game resource discovery for the v0.7 "Scan Game" flow.
 *
 * Walks a directory recursively and returns only candidate localization
 * resources (by extension), with a hard cap to bound memory. Never writes to
 * the source directory.
 */

#[derive(Serialize, Clone)]
pub struct ScannedFile {
    pub path: String,
    pub size: u64,
}

const MAX_FILES: usize = 200_000;

const CANDIDATE_EXTENSIONS: &[&str] = &[
    // Unreal
    "pak", "utoc", "ucas", "uasset", "uexp", "ubulk", "locres", "locmeta", "umap",
    // Godot
    "pck", "godot", "tres", "res", "tscn", "scn", "translation", "gd",
    // Unity
    "assets", "unity3d", "bundle", "sharedassets",
    // Text / structured
    "json", "csv", "po", "pot", "txt", "ink",
];

fn is_candidate(path: &Path) -> bool {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) => CANDIDATE_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()),
        None => false,
    }
}

#[tauri::command]
pub fn scan_directory(root: String) -> Result<Vec<ScannedFile>, String> {
    let root_path = Path::new(&root);
    if !root_path.is_dir() {
        return Err("Scan root is not a directory.".into());
    }

    let mut files: Vec<ScannedFile> = Vec::new();
    walk(root_path, root_path, &mut files)?;

    // Stable ordering for reproducible results.
    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(files)
}

fn walk(
    root: &Path,
    current: &Path,
    files: &mut Vec<ScannedFile>,
) -> Result<(), String> {
    if files.len() >= MAX_FILES {
        return Ok(());
    }

    let entries = fs::read_dir(current).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        if files.len() >= MAX_FILES {
            break;
        }
        let path = entry.path();
        if path.is_dir() {
            // Skip common non-localization directories to bound the walk.
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_ascii_lowercase();
            if name == "node_modules" || name == ".git" || name == "target" || name == "dist" {
                continue;
            }
            walk(root, &path, files)?;
        } else if path.is_file() {
            if is_candidate(&path) {
                let relative = path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                files.push(ScannedFile { path: relative, size });
            }
        }
    }

    Ok(())
}
