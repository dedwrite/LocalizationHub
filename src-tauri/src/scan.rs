use serde::Serialize;
use std::fs;
use std::path::Path;

/*
 * Read-only game resource discovery for the v0.7 "Scan Game" flow.
 *
 * Walks a directory recursively and returns:
 *   - candidate localization files (by extension AND exact extensionless
 *     Unity signature filenames)
 *   - directory names (for engine-detection directory evidence such as
 *     `*_Data`, `StreamingAssets`, `Addressables`)
 *
 * Never writes to the source directory. Bounded by MAX_FILES.
 */

#[derive(Serialize, Clone)]
pub struct ScannedFile {
    pub path: String,
    pub size: u64,
}

#[derive(Serialize, Clone)]
pub struct ScanDiscovery {
    pub files: Vec<ScannedFile>,
    pub directories: Vec<String>,
}

const MAX_FILES: usize = 200_000;
const MAX_DIRECTORIES: usize = 50_000;

const CANDIDATE_EXTENSIONS: &[&str] = &[
    // Unreal
    "pak", "utoc", "ucas", "uasset", "uexp", "ubulk", "locres", "locmeta", "umap",
    // Godot
    "pck", "godot", "tres", "res", "tscn", "scn", "translation", "gd", "gdc",
    // Unity
    "assets", "unity3d", "bundle", "sharedassets",
    // Text / structured
    "json", "csv", "po", "pot", "txt", "ink", "yarn", "xml", "yaml",
    // Ink story (Until Then compiled Ink — must reach the native reader)
    "inkb",
];

// Unity serialized files often have no extension and must be matched by exact
// filename or pattern, not extension alone.
const EXTENSIONLESS_CANDIDATE_NAMES: &[&str] = &[
    "globalgamemanagers",
    "globalgamemanagers.assets",
    "data.unity3d",
    "level0",
    "projectsettings",
    "unitydefaultresources",
];

fn is_candidate(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    // Exact extensionless Unity signature files.
    if EXTENSIONLESS_CANDIDATE_NAMES.contains(&name.as_str()) {
        return true;
    }

    // `level*` serialized files (level0, level1, ...) and `sharedassets*.assets`.
    if name.starts_with("level") && !name.contains('.') {
        return true;
    }
    if name.starts_with("sharedassets") && name.ends_with(".assets") {
        return true;
    }

    match path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) => CANDIDATE_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()),
        None => false,
    }
}

#[tauri::command]
pub async fn scan_directory(root: String) -> Result<ScanDiscovery, String> {
    // The recursive walk can touch tens of thousands of files and take seconds;
    // running it synchronously would block Tauri's main thread and make Windows
    // report "Not Responding". Offload it to a blocking worker.
    tauri::async_runtime::spawn_blocking(move || scan_directory_sync(root))
        .await
        .map_err(|e| e.to_string())?
}

fn scan_directory_sync(root: String) -> Result<ScanDiscovery, String> {
    let root_path = Path::new(&root);
    if !root_path.is_dir() {
        return Err("Scan root is not a directory.".into());
    }

    let mut files: Vec<ScannedFile> = Vec::new();
    let mut directories: Vec<String> = Vec::new();
    walk(root_path, root_path, &mut files, &mut directories)?;

    files.sort_by(|a, b| a.path.cmp(&b.path));
    directories.sort();
    Ok(ScanDiscovery { files, directories })
}

fn walk(
    root: &Path,
    current: &Path,
    files: &mut Vec<ScannedFile>,
    directories: &mut Vec<String>,
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
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_ascii_lowercase();
            // Skip common non-localization directories to bound the walk.
            if name == "node_modules" || name == ".git" || name == "target" || name == "dist" {
                continue;
            }
            if directories.len() < MAX_DIRECTORIES {
                let relative = path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");
                directories.push(relative);
            }
            walk(root, &path, files, directories)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    /*
     * DISCOVERY PARITY CONTRACT.
     *
     * `packages/core/src/extraction/scanGame.ts` (`classifyFileKind`) routes
     * every one of these extensions to a PARSER (not "unknown"/"structural"),
     * and `packages/core/src/extraction/orchestrate.ts` (`buildArchivePlan`)
     * turns the archive ones into external-tool jobs. If a file type is
     * recognized by core but NOT discovered here, the desktop scan silently
     * drops localizable content — this is exactly the `.inkb` → Dialogue=0
     * regression and the missing `.gdc` binary-resource reporting.
     *
     * Keep this list in sync with the core lists in scanGame.ts /
     * orchestrate.ts. A counterpart Vitest (`discoveryParity.test.ts`) asserts
     * the same matrix from the TypeScript side.
     */
    const CORE_ROUTEABLE_EXTENSIONS: &[&str] = &[
        // text-resource
        "json", "csv", "po", "pot", "tscn", "tres", "txt", "ink",
        // script
        "gd",
        // unreal-binary
        "locres", "locmeta",
        // godot-binary
        "res", "scn", "translation", "gdc",
        // inkb-story
        "inkb",
        // archive (scanGame)
        "pak", "utoc", "ucas", "pck", "assets", "unity3d", "bundle",
        // archive jobs (orchestrate buildArchivePlan)
        "uasset", "uexp", "ubulk",
    ];

    #[test]
    fn native_discovery_covers_every_core_routeable_extension() {
        for ext in CORE_ROUTEABLE_EXTENSIONS {
            let name = format!("sample.{ext}");
            let path = std::path::Path::new(&name);
            assert!(
                is_candidate(path),
                "core recognizes .{ext} but native scan_directory drops it — add it to CANDIDATE_EXTENSIONS"
            );
        }
    }

    #[test]
    fn scan_directory_returns_inkb_and_gdc_files() {
        let base = std::env::temp_dir().join(format!(
            "lhub-scan-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&base).unwrap();
        fs::write(base.join("story.inkb"), b"x").unwrap();
        fs::write(base.join("shader.gdc"), b"y").unwrap();
        fs::write(base.join("noise.zzz"), b"z").unwrap();

        let discovery = scan_directory_sync(base.to_string_lossy().to_string()).unwrap();
        let exts: Vec<&str> = discovery
            .files
            .iter()
            .map(|f| f.path.rsplit('.').next().unwrap_or(""))
            .collect();

        assert!(exts.contains(&"inkb"), "discovered: {exts:?}");
        assert!(exts.contains(&"gdc"), "discovered: {exts:?}");
        assert!(!exts.contains(&"zzz"), "unknown extension should be skipped: {exts:?}");

        fs::remove_dir_all(&base).ok();
    }
}
