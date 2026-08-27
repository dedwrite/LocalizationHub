use serde::Serialize;
use std::process::Command;

/*
 * Safe external-tool execution for the desktop extraction pipeline.
 *
 * Runs a configured CLI (repak / retoc / UAssetDumper / gdsdecomp / UnityPy)
 * with an argument array (no shell interpolation) and returns stdout/stderr and
 * the exit code. The caller is responsible for using isolated temp directories
 * and for never passing secrets through here except via explicit, ephemeral
 * arguments.
 */

#[derive(Serialize, Clone)]
pub struct ToolRunResult {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[tauri::command]
pub fn run_external_tool(
    executable: String,
    args: Vec<String>,
) -> Result<ToolRunResult, String> {
    if executable.trim().is_empty() {
        return Err("Executable path is empty.".into());
    }

    // Reject obviously dangerous inputs (no shell metacharacters in the
    // executable path). Arguments are passed verbatim as a Vec, never joined.
    if executable.contains(['|', '&', ';', '<', '>', '`']) {
        return Err("Executable path contains disallowed characters.".into());
    }

    let output = Command::new(&executable)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to run {executable}: {e}"))?;

    Ok(ToolRunResult {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}
