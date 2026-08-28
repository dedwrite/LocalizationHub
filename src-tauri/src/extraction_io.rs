use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::State;
use serde::Serialize;

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
///
/// Wrapped in an `Arc` so blocking-worker tasks can clone the handle cheaply
/// and check authorization off Tauri's main thread.
#[derive(Clone)]
pub struct ExtractionAuthorizedRoots(Arc<Mutex<HashSet<PathBuf>>>);

impl Default for ExtractionAuthorizedRoots {
    fn default() -> Self {
        Self(Arc::new(Mutex::new(HashSet::new())))
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

/*
 * Guarded file COPY for the derived-copy conversion pipeline.
 *
 * `src` must be inside an authorized root (a registered scan root or an active
 * temp job dir); `dst` must be inside an authorized root too (an active temp
 * job dir). This lets the pipeline copy a binary Godot resource into a temp
 * dir and convert it there, never modifying the original source file.
 */
pub(crate) fn copy_file_guarded(
    state: &ExtractionAuthorizedRoots,
    src: String,
    dst: String,
) -> Result<(), String> {
    let src_path = PathBuf::from(&src);
    let dst_path = PathBuf::from(&dst);
    if !is_authorized(state, &src_path) {
        return Err("Copy denied: source is outside authorized extraction roots.".into());
    }
    // The destination may not exist yet, so canonicalize its PARENT (after
    // creating it) and verify the parent is inside an authorized root.
    let parent = dst_path.parent().unwrap_or(dst_path.as_path());
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    if !is_authorized(state, parent) {
        return Err("Copy denied: destination is outside authorized extraction roots.".into());
    }
    fs::copy(&src_path, &dst_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn copy_extraction_file(
    src: String,
    dst: String,
    state: State<ExtractionAuthorizedRoots>,
) -> Result<(), String> {
    copy_file_guarded(state.inner(), src, dst)
}

/*
 * Guarded BATCH reads.
 *
 * A large game ships tens of thousands of text resources; reading them one
 * Tauri invoke per file means tens of thousands of IPC round-trips (the
 * "Not Responding" minute-long scan). The batch commands below read up to
 * `MAX_BATCH_SIZE` files in a single guarded call — every path still goes
 * through the SAME canonicalize + authorized-root check, so there is no
 * weakening of the boundary. Per-file errors are returned in-band so one bad
 * file never aborts the batch.
 */

/// Bounded batch size: caps per-call latency, IPC payload, and memory peak.
const MAX_BATCH_SIZE: usize = 256;

#[derive(Serialize)]
pub struct BatchTextResult {
    pub path: String,
    pub text: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct BatchBinaryResult {
    pub path: String,
    /// base64-encoded bytes (compact IPC vs. a nested number[] JSON array).
    pub data: Option<String>,
    pub error: Option<String>,
}

/// Core batch-text logic, testable without a Tauri `State`.
pub(crate) fn read_text_batch(
    state: &ExtractionAuthorizedRoots,
    paths: Vec<String>,
) -> Result<Vec<BatchTextResult>, String> {
    if paths.len() > MAX_BATCH_SIZE {
        return Err(format!(
            "Batch size {} exceeds the maximum of {MAX_BATCH_SIZE}.",
            paths.len()
        ));
    }
    let mut out = Vec::with_capacity(paths.len());
    for path in paths {
        let p = PathBuf::from(&path);
        if !is_authorized(state, &p) {
            out.push(BatchTextResult {
                path,
                text: None,
                error: Some("Read denied: path is outside authorized extraction roots.".into()),
            });
            continue;
        }
        match fs::read_to_string(&p) {
            Ok(text) => out.push(BatchTextResult { path, text: Some(text), error: None }),
            Err(e) => out.push(BatchTextResult { path, text: None, error: Some(e.to_string()) }),
        }
    }
    Ok(out)
}

#[tauri::command]
pub async fn read_extraction_text_batch(
    paths: Vec<String>,
    state: State<'_, ExtractionAuthorizedRoots>,
) -> Result<Vec<BatchTextResult>, String> {
    let roots = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || read_text_batch(&roots, paths))
        .await
        .map_err(|e| e.to_string())?
}

/// Core batch-binary logic, testable without a Tauri `State`.
pub(crate) fn read_binary_batch(
    state: &ExtractionAuthorizedRoots,
    paths: Vec<String>,
) -> Result<Vec<BatchBinaryResult>, String> {
    if paths.len() > MAX_BATCH_SIZE {
        return Err(format!(
            "Batch size {} exceeds the maximum of {MAX_BATCH_SIZE}.",
            paths.len()
        ));
    }
    let mut out = Vec::with_capacity(paths.len());
    for path in paths {
        let p = PathBuf::from(&path);
        if !is_authorized(state, &p) {
            out.push(BatchBinaryResult {
                path,
                data: None,
                error: Some("Read denied: path is outside authorized extraction roots.".into()),
            });
            continue;
        }
        match fs::read(&p) {
            Ok(bytes) => out.push(BatchBinaryResult {
                path,
                data: Some(base64_encode(&bytes)),
                error: None,
            }),
            Err(e) => out.push(BatchBinaryResult { path, data: None, error: Some(e.to_string()) }),
        }
    }
    Ok(out)
}

#[tauri::command]
pub async fn read_extraction_binary_batch(
    paths: Vec<String>,
    state: State<'_, ExtractionAuthorizedRoots>,
) -> Result<Vec<BatchBinaryResult>, String> {
    let roots = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || read_binary_batch(&roots, paths))
        .await
        .map_err(|e| e.to_string())?
}

const BASE64_ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn base64_encode(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(BASE64_ALPHABET[(n >> 18) as usize & 63] as char);
        out.push(BASE64_ALPHABET[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 {
            BASE64_ALPHABET[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            BASE64_ALPHABET[n as usize & 63] as char
        } else {
            '='
        });
    }
    out
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

    #[test]
    fn base64_round_trips_bytes() {
        assert_eq!(base64_encode(b""), "");
        assert_eq!(base64_encode(b"f"), "Zg==");
        assert_eq!(base64_encode(b"fo"), "Zm8=");
        assert_eq!(base64_encode(b"foo"), "Zm9v");
        assert_eq!(base64_encode(b"foob"), "Zm9vYg==");
        assert_eq!(base64_encode(b"fooba"), "Zm9vYmE=");
        assert_eq!(base64_encode(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn batch_text_serves_authorized_and_denies_others_per_file() {
        let state = ExtractionAuthorizedRoots::default();
        let root = unique_root("batchtext");
        let inside = root.join("a.txt");
        let outside = std::env::temp_dir().join("lhub-batch-secret.txt");
        write(&inside, "hello");
        write(&outside, "secret");

        authorize_root(&state, &root).unwrap();

        let results = read_text_batch(
            &state,
            vec![inside.to_string_lossy().to_string(), outside.to_string_lossy().to_string()],
        )
        .unwrap();

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].text.as_deref(), Some("hello"));
        assert!(results[0].error.is_none());
        assert!(results[1].text.is_none());
        assert!(results[1].error.as_deref().unwrap().contains("denied"));

        fs::remove_file(&outside).ok();
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn batch_binary_serves_authorized_and_denies_others_per_file() {
        let state = ExtractionAuthorizedRoots::default();
        let root = unique_root("batchbin");
        let inside = root.join("a.inkb");
        let outside = std::env::temp_dir().join("lhub-batch-bin-secret.inkb");
        write(&inside, "hello");
        write(&outside, "secret");

        authorize_root(&state, &root).unwrap();

        let results = read_binary_batch(
            &state,
            vec![inside.to_string_lossy().to_string(), outside.to_string_lossy().to_string()],
        )
        .unwrap();

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].data.as_deref(), Some("aGVsbG8=")); // "hello"
        assert!(results[0].error.is_none());
        assert!(results[1].data.is_none());
        assert!(results[1].error.as_deref().unwrap().contains("denied"));

        fs::remove_file(&outside).ok();
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn batch_read_rejects_oversized_requests() {
        let state = ExtractionAuthorizedRoots::default();
        let paths: Vec<String> = (0..(MAX_BATCH_SIZE + 1)).map(|i| format!("{i}.txt")).collect();
        let result = read_text_batch(&state, paths);
        assert!(result.is_err());
    }

    #[test]
    fn copy_extraction_file_serves_authorized_to_authorized_and_denies_otherwise() {
        let state = ExtractionAuthorizedRoots::default();
        let root = unique_root("copyfile");
        let src = root.join("a.scn");
        let dst = root.join("out").join("a.scn");
        let outside = std::env::temp_dir().join("lhub-copy-secret.scn");
        write(&src, "binary-scene");

        authorize_root(&state, &root).unwrap();

        // Authorized src + authorized dst → allowed.
        let result = copy_file_guarded(
            &state,
            src.to_string_lossy().to_string(),
            dst.to_string_lossy().to_string(),
        );
        assert!(result.is_ok());
        assert!(dst.exists());

        // Authorized src + UNauthorized dst → denied.
        let denied = copy_file_guarded(
            &state,
            src.to_string_lossy().to_string(),
            outside.to_string_lossy().to_string(),
        );
        assert!(denied.is_err());
        assert!(!outside.exists());

        fs::remove_file(&outside).ok();
        fs::remove_dir_all(&root).ok();
    }
}
