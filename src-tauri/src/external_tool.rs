use serde::Serialize;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/*
 * Safe external-tool execution for the desktop extraction pipeline.
 *
 * Runs a configured CLI with an argument array (no shell interpolation) and:
 *   - a configurable timeout (kills the child on timeout)
 *   - bounded stdout/stderr capture (truncates at a cap, never unbounded)
 *   - exit-code handling
 *   - executable existence validation via the spawn error
 *
 * The caller passes the AES key (when required) as an explicit ephemeral
 * argument; it is never logged here.
 */

const DEFAULT_TIMEOUT_MS: u64 = 120_000;
const MAX_OUTPUT_BYTES: usize = 1_000_000;

#[derive(Serialize, Clone)]
pub struct ToolRunResult {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
    pub timed_out: bool,
    pub output_truncated: bool,
}

#[tauri::command]
pub fn run_external_tool(
    executable: String,
    args: Vec<String>,
    timeout_ms: Option<u64>,
) -> Result<ToolRunResult, String> {
    if executable.trim().is_empty() {
        return Err("Executable path is empty.".into());
    }

    // Reject obviously dangerous inputs (no shell metacharacters in the
    // executable path). Arguments are passed verbatim as a Vec, never joined.
    if executable.contains(['|', '&', ';', '<', '>', '`']) {
        return Err("Executable path contains disallowed characters.".into());
    }

    let timeout = Duration::from_millis(timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));

    let mut child = Command::new(&executable)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to run {executable}: {e}"))?;

    let stdout_pipe = child.stdout.take();
    let stderr_pipe = child.stderr.take();

    let stdout_handle = std::thread::spawn(move || read_bounded(stdout_pipe));
    let stderr_handle = std::thread::spawn(move || read_bounded(stderr_pipe));

    // Poll with timeout; kill the child if it exceeds the timeout.
    let start = Instant::now();
    let mut timed_out = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    timed_out = true;
                    break None;
                }
                std::thread::sleep(Duration::from_millis(25));
            }
            Err(e) => {
                return Err(format!("Failed to wait for {executable}: {e}"));
            }
        }
    };

    let (stdout, stdout_truncated) = stdout_handle.join().unwrap_or((String::new(), false));
    let (stderr, stderr_truncated) = stderr_handle.join().unwrap_or((String::new(), false));

    let code = if timed_out {
        -1
    } else {
        status.and_then(|s| s.code()).unwrap_or(-1)
    };

    Ok(ToolRunResult {
        code,
        stdout,
        stderr,
        timed_out,
        output_truncated: stdout_truncated || stderr_truncated,
    })
}

fn read_bounded<R: std::io::Read>(pipe: Option<R>) -> (String, bool) {
    let Some(mut pipe) = pipe else {
        return (String::new(), false);
    };

    let mut buf = Vec::with_capacity(4096);
    let mut chunk = [0u8; 4096];
    let mut truncated = false;

    loop {
        match pipe.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                let remaining = MAX_OUTPUT_BYTES.saturating_sub(buf.len());
                if n > remaining {
                    buf.extend_from_slice(&chunk[..remaining]);
                    truncated = true;
                    // Drain the rest without storing it.
                    let mut sink = [0u8; 4096];
                    while let Ok(m) = pipe.read(&mut sink) {
                        if m == 0 {
                            break;
                        }
                    }
                    break;
                }
                buf.extend_from_slice(&chunk[..n]);
            }
            Err(_) => break,
        }
    }

    (String::from_utf8_lossy(&buf).into_owned(), truncated)
}
