//! Chattree Plugin Starter Template in Rust
//!
//! Build target: wasm32-unknown-unknown
//!
//! Command:
//!   cargo build --target wasm32-unknown-unknown --release

use std::slice;
use std::str;

const OUTPUT_OFFSET: usize = 1024;
const MAX_OUTPUT_LEN: usize = 8192;
static mut RES_BUFFER: [u8; 4096] = [0; 4096];

// Optional Host API import for plugins requiring host services
extern "C" {
    fn host_call(req_ptr: i32, req_len: i32, res_ptr: i32, res_max_len: i32) -> i32;
}

fn handle_execution(input_str: &str) -> String {
    if input_str.trim().is_empty() {
        "Hello from Chattree Plugin Template! Pass text after /starter to echo.".to_string()
    } else {
        format!("Starter Plugin received: {}", input_str)
    }
}

// ─── Universal ABI v2 (Dynamic Linear Memory up to 16 MB) ────────────────────

#[no_mangle]
pub extern "C" fn chattree_allocate(size: usize) -> *mut u8 {
    let mut buf = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[no_mangle]
pub extern "C" fn chattree_deallocate(ptr: *mut u8, size: usize) {
    if !ptr.is_null() && size > 0 {
        unsafe {
            let _ = Vec::from_raw_parts(ptr, 0, size);
        }
    }
}

#[no_mangle]
pub extern "C" fn chattree_dispatch(req_ptr: *const u8, req_len: usize) -> u64 {
    let input_str = unsafe {
        if req_len > 0 && !req_ptr.is_null() {
            let bytes = slice::from_raw_parts(req_ptr, req_len);
            str::from_utf8(bytes).unwrap_or("")
        } else {
            ""
        }
    };
    let response = handle_execution(input_str);
    let bytes = response.into_bytes();
    let len = bytes.len();
    let ptr = bytes.as_ptr();
    std::mem::forget(bytes);
    ((ptr as u64) << 32) | (len as u64)
}

/// Legacy ABI v1 entrypoint function called by Chattree.
///
/// Matches the `entrypoint` specified in `plugin.json`.
/// - `input_ptr`: Points to the UTF-8 input string written by Chattree at offset 0.
/// - `input_len`: Byte length of the input.
/// - Return: Byte length of the UTF-8 response written to offset 1024 (`OUTPUT_OFFSET`).
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

    let response = handle_execution(input_str);
    let bytes = response.as_bytes();
    unsafe {
        let len = bytes.len().min(MAX_OUTPUT_LEN);
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), OUTPUT_OFFSET as *mut u8, len);
        len as i32
    }
}
