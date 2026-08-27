use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

/*
 * Purpose-built read-only IO boundary for the extraction pipeline.
 *
 * The Tauri WebView fs-plugin scope does NOT grant read access to the OS temp
 * directory, so extracted resources under %TEMP%\LocalizationHub\job-<uuid>\
 * cannot be read via @tauri-apps/plugin-fs (this produced "88,195 errors" on a
 * real installed-game scan). Widening the global fs scope would be a security
 * regression. Instead, extraction resource reads go through guarded native
 * commands that only accept paths under an authorized root:
 *
 *   A) an active LocalizationHub temp job dir (auto-authorized on creation), or
 *   B) a user-selected scan root (registered for the duration of the scan).
 *
 * Paths are canonicalized before the check so `..` traversal and symlink/
 * junction escapes resolve to their real target and are denied when they leave
 * the authorized root. The WebView can therefore never read arbitrary
 * filesystem paths — only the active extraction resources.
 */

/// Canonicalized paths that extraction reads are permitted from.
pub struct ExtractionAuthorizedRoots(Mutex<HashSet<PathBuf>>);

impl Default for ExtractionAuthorizedRoots {
    fn default() -> Self {
        Self(Mutex::new(HashSet::new()))
    }
}

/// The LocalizationHub temp base (`%TEMP%/LocalizationHub`). Used by tests to
/// create isolated job dirs under the real temp root.
#[cfg(test)]
fn temp_base() -> PathBuf {
    std::env::temp_dir().join("LocalizationHub")
}

/// Authorize a root path (canonicalized). Returns the canonical path.
pub(crate) fn authorize_root(
    state: &ExtractionAuthorizedRoots,
    path: &Path,
) -> Result<PathBuf, String> {
    let canonical = path.canonicalize().map_err(|e| e.to_string())?;
    state.0.lock().unwrap().insert(canonical.clone());
    Ok(canonical)
}

/// De-authorize a root path (canonicalized, best-effort).
pub(crate) fn deauthorize_root(state: &ExtractionAuthorizedRoots, path: &Path) {
    if let Ok(canonical) = path.canonicalize() {
        state.0.lock().unwrap().remove(&canonical);
    }
}

/// Is `path` (after canonicalization) inside one of the authorized roots?
fn is_authorized(state: &ExtractionAuthorizedRoots, path: &Path) -> bool {
    let canonical = match path.canonicalize() {
        Ok(c) => c,
        Err(_) => return false,
    };
    let roots = state.0.lock().unwrap();
    roots.iter().any(|r| canonical.starts_with(r))
}

/// Register a user-selected scan root (folder or file) for the duration of the
/// scan. Only this root (and active temp job dirs) become readable.
#[tauri::command]
pub fn register_extraction_root(
    root: String,
    state: State<ExtractionAuthorizedRoots>,
) -> Result<(), String> {
    let path = PathBuf::from(&root);
    let canonical = path.canonicalize().map_err(|e| format!("Invalid scan root: {e}"))?;
    state.0.lock().unwrap().insert(canonical);
    Ok(())
}

#[tauri::command]
pub fn unregister_extraction_root(
    root: String,
    state: State<ExtractionAuthorizedRoots>,
) -> Result<(), String> {
    let path = PathBuf::from(&root);
    if let Ok(canonical) = path.canonicalize() {
        state.0.lock().unwrap().remove(&canonical);
    }
    Ok(())
}

#[tauri::command]
pub fn read_extraction_text(
    path: String,
    state: State<ExtractionAuthorizedRoots>,
) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !is_authorized(&state, &p) {
        return Err("Read denied: path is outside authorized extraction roots.".into());
    }
    fs::read_to_string(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_extraction_binary(
    path: String,
    state: State<ExtractionAuthorizedRoots>,
) -> Result<Vec<u8>, String> {
    let p = PathBuf::from(&path);
    if !is_authorized(&state, &p) {
        return Err("Read denied: path is outside authorized extraction roots.".into());
    }
    fs::read(&p).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn unique_root(tag: &str) -> PathBuf {
        let id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = temp_base().join(format!("job-test-{tag}-{id}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write(path: &Path, content: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }

    #[test]
    fn authorized_temp_root_reads_pass() {
        let state = ExtractionAuthorizedRoots::default();
        let root = unique_root("allow");
        let file = root.join("foo.txt");
        write(&file, "hello");

        authorize_root(&state, &root).unwrap();
        assert!(is_authorized(&state, &file));

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn outside_temp_root_denied() {
        let state = ExtractionAuthorizedRoots::default();
        let root = unique_root("outside");
        let outside = std::env::temp_dir().join("unrelated-file.txt");
        write(&outside, "nope");

        authorize_root(&state, &root).unwrap();
        assert!(!is_authorized(&state, &outside));

        fs::remove_file(&outside).ok();
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn sibling_temp_dir_denied() {
        let state = ExtractionAuthorizedRoots::default();
        let a = unique_root("sib-a");
        let b = unique_root("sib-b");
        let bfile = b.join("secret.txt");
        write(&bfile, "secret");

        authorize_root(&state, &a).unwrap();
        assert!(!is_authorized(&state, &bfile));

        fs::remove_dir_all(&a).ok();
        fs::remove_dir_all(&b).ok();
    }

    #[test]
    fn deauthorized_root_denied_after_removal() {
        let state = ExtractionAuthorizedRoots::default();
        let root = unique_root("deauth");
        let file = root.join("gone.txt");
        write(&file, "x");

        let canonical = authorize_root(&state, &root).unwrap();
        assert!(is_authorized(&state, &file));

        deauthorize_root(&state, &canonical);
        assert!(!is_authorized(&state, &file));

        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn path_traversal_escapes_are_denied() {
        let state = ExtractionAuthorizedRoots::default();
        let root = unique_root("trav");
        let secret = std::env::temp_dir().join("lhub-traversal-secret.txt");
        write(&secret, "secret");

        authorize_root(&state, &root).unwrap();

        // A `..` path that resolves outside the root must be denied (canonicalize
        // resolves it, and starts_with fails).
        let traversal = root.join("sub").join("..").join("..").join("..").join("lhub-traversal-secret.txt");
        assert!(!is_authorized(&state, &traversal));

        fs::remove_file(&secret).ok();
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn scan_root_file_authorizes_only_that_file() {
        let state = ExtractionAuthorizedRoots::default();
        let root = unique_root("scanroot");
        let file = root.join("dialogue.json");
        let other = root.join("other.json");
        write(&file, "{}");
        write(&other, "{}");

        // Register the exact file (not the dir).
        authorize_root(&state, &file).unwrap();
        assert!(is_authorized(&state, &file));
        assert!(!is_authorized(&state, &other));

        fs::remove_dir_all(&root).ok();
    }
}
