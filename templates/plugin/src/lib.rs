//! Chattree Plugin Starter Template in Rust
//!
//! Build target: wasm32-unknown-unknown
//!
//! Command:
//!   cargo build --target wasm32-unknown-unknown --release

use std::slice;
use std::str;

// Linear memory buffers
static mut OUTPUT_BUFFER: [u8; 8192] = [0; 8192];
static mut RES_BUFFER: [u8; 4096] = [0; 4096];

// Optional Host API import for plugins requiring host services
extern "C" {
    fn host_call(req_ptr: i32, req_len: i32, res_ptr: i32, res_max_len: i32) -> i32;
}

/// Primary entrypoint function called by Chattree.
///
/// Matches the `entrypoint` specified in `plugin.json`.
/// - `input_ptr`: Points to the UTF-8 input string written by Chattree at offset 0.
/// - `input_len`: Byte length of the input.
/// - Return: Byte length of the UTF-8 response written to `OUTPUT_BUFFER` (offset 1024).
#[no_mangle]
pub extern "C" fn starter_entry(input_ptr: *const u8, input_len: usize) -> i32 {
    let input_str = unsafe {
        if input_len > 0 && !input_ptr.is_null() {
            let bytes = slice::from_raw_parts(input_ptr, input_len);
            str::from_utf8(bytes).unwrap_or("")
        } else {
            ""
        }
    };

    let response = if input_str.trim().is_empty() {
        "Hello from Chattree Plugin Template! Pass text after /starter to echo.".to_string()
    } else {
        format!("Starter Plugin received: {}", input_str)
    };

    let bytes = response.as_bytes();
    unsafe {
        let len = bytes.len().min(OUTPUT_BUFFER.len());
        OUTPUT_BUFFER[..len].copy_from_slice(&bytes[..len]);
        len as i32
    }
}
