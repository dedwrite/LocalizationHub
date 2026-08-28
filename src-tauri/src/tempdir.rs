use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::extraction_io::{authorize_root, deauthorize_root, ExtractionAuthorizedRoots};

/*
 * Isolated temp-directory management for the extraction pipeline.
 *
 * Each extraction job gets a unique directory under the OS temp root:
 *   <temp>/LocalizationHub/job-<uuid>/
 *
 * Cleanup is recursive and only ever operates on directories created under the
 * LocalizationHub temp root (never arbitrary paths). Job dirs are also
 * authorized as extraction read roots so the guarded native reader can serve
 * extracted resources to the pipeline (the WebView fs-plugin cannot read the
 * OS temp directory).
 */

#[derive(Serialize, Clone)]
pub struct TempDir {
    pub path: String,
}

#[tauri::command]
pub fn create_temp_job_dir(state: State<ExtractionAuthorizedRoots>) -> Result<TempDir, String> {
    let base = std::env::temp_dir().join("LocalizationHub");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    let id = uuid_like_id();
    let dir = base.join(format!("job-{id}"));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    // Authorize reads under this new job dir for the guarded extraction reader.
    authorize_root(&state, &dir).map_err(|e| e.to_string())?;

    Ok(TempDir {
        path: dir.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
pub async fn remove_temp_dir(
    path: String,
    state: State<'_, ExtractionAuthorizedRoots>,
) -> Result<(), String> {
    let roots = state.inner().clone();
    // `remove_dir_all` on a large extracted tree (tens of thousands of files)
    // is slow; offload it so the main thread stays responsive during cleanup.
    tauri::async_runtime::spawn_blocking(move || remove_temp_dir_sync(&roots, path))
        .await
        .map_err(|e| e.to_string())?
}

fn remove_temp_dir_sync(state: &ExtractionAuthorizedRoots, path: String) -> Result<(), String> {
    // Safety guard: only delete directories under the LocalizationHub temp root.
    let base = std::env::temp_dir().join("LocalizationHub");
    let target = PathBuf::from(&path);

    let base_canonical = base.canonicalize().map_err(|e| e.to_string())?;
    let target_canonical = match target.canonicalize() {
        Ok(p) => p,
        Err(_) => return Ok(()), // already gone
    };

    if !target_canonical.starts_with(&base_canonical) {
        return Err("Refusing to remove a directory outside the LocalizationHub temp root.".into());
    }

    // De-authorize reads for this job dir (best-effort, before removal).
    deauthorize_root(state, &target_canonical);

    fs::remove_dir_all(&target_canonical).map_err(|e| e.to_string())
}

fn uuid_like_id() -> String {
    let mut buf = [0u8; 16];
    fill_random(&mut buf);
    let hex: String = buf.iter().map(|b| format!("{b:02x}")).collect();
    // Insert hyphens for readability; uniqueness comes from the 16 random bytes.
    format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
}

fn fill_random(buf: &mut [u8]) {
    // Best-effort: combine system time + process id + a monotonic counter.
    // No external RNG crate; this is unique enough for temp job dirs.
    static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let counter = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let nanos = now.as_nanos().to_le_bytes();
    let pid = std::process::id().to_le_bytes();
    let counter_bytes = counter.to_le_bytes();
    for (i, b) in buf.iter_mut().enumerate() {
        *b = nanos[i % nanos.len()]
            ^ pid[i % pid.len()]
            ^ counter_bytes[i % counter_bytes.len()]
            ^ (i as u8).wrapping_mul(31);
    }
}
