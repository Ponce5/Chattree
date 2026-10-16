const fs = require('fs');
const path = require('path');

async function testWasm() {
  const wasmPath = path.join(__dirname, '../plugins/official/calendar/plugin.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  let capturedHostCalls = [];

  const importObject = {
    chattree: {
      host_call: (reqPtr, reqLen, resPtr, resMaxLen) => {
        const mem = new Uint8Array(instance.exports.memory.buffer);
        const reqStr = new TextDecoder('utf-8').decode(mem.subarray(reqPtr, reqPtr + reqLen));
        capturedHostCalls.push({ reqStr, reqPtr, reqLen, resPtr, resMaxLen });
        return 0; // Async simulation
      }
    }
  };

  const { instance } = await WebAssembly.instantiate(wasmBuffer, importObject);
  const mem = new Uint8Array(instance.exports.memory.buffer);

  let passed = 0;
  let failed = 0;

  function runCase(name, inputStr, expectedApi, expectedOp, inputOffset = 0) {
    capturedHostCalls = [];
    const inputBytes = new TextEncoder().encode(inputStr);
    mem.set(inputBytes, inputOffset);
    const res = instance.exports.calendar_entry(inputOffset, inputBytes.length);
    console.log(`\n=== CASE: ${name} ===`);
    console.log(`Input at offset ${inputOffset}: "${inputStr}" -> Result code: ${res}`);
    if (capturedHostCalls.length === 0) {
      console.error(`FAILED: No Host API call dispatched.`);
      failed++;
      return;
    }

    const payloadStr = capturedHostCalls[0].reqStr;
    console.log(`Payload: ${payloadStr}`);

    let parsed;
    try {
      parsed = JSON.parse(payloadStr);
      console.log(`JSON valid: YES`);
    } catch (e) {
      console.error(`FAILED: JSON parsing failed: ${e.message}`);
      failed++;
      return;
    }

    if (parsed.api !== expectedApi || parsed.operation !== expectedOp) {
      console.error(`FAILED: Expected api=${expectedApi}, op=${expectedOp}; got api=${parsed.api}, op=${parsed.operation}`);
      failed++;
      return;
    }

    console.log(`PASSED: Correctly routed to ${parsed.api}.${parsed.operation}`);
    passed++;
  }

  // 1. Single /calendar command without args (input at offset 0 like real device)
  runCase('1. Empty input (/calendar alone) at offset 0', '', 'calendar', 'events', 0);

  // 1.b Explicit /calendar list at offset 0
  runCase('1b. Explicit /calendar list at offset 0', 'list', 'calendar', 'events', 0);

  // 2. User exact query: "agendame una reunion hoy" placed at offset 0!
  runCase('2. User exact query (/calendar agendame una reunion hoy)', 'agendame una reunion hoy', 'calendar', 'create', 0);

  // 3. Natural title with accents and newlines (sanitization test)
  runCase('3. Accents and newlines (/calendar Reunión urgente\\ncon diseño)', 'Reunión urgente\ncon diseño', 'calendar', 'create', 0);

  // 4. Pipe syntax
  runCase('4. Pipe format (/calendar Reunión | 2026-10-16T15:00:00Z)', 'Reunión | 2026-10-16T15:00:00Z', 'calendar', 'create', 0);

  // 5. Direct JSON payload at offset 0
  runCase('5. Direct JSON at offset 0', JSON.stringify({ title: 'Sync Semanal' }), 'calendar', 'create', 0);

  // 6. Test resume callback with formatted JSON containing SPACES {"success": true, ...}
  console.log('\n=== TEST: resume callback (Create Meeting - Spaced JSON) ===');
  let mockRes = new TextEncoder().encode(JSON.stringify({ success: true, data: { eventId: 'evt_123', created: true } }, null, 2));
  mem.set(mockRes, 4096);
  let resumeLen = instance.exports.resume(4096, mockRes.length);
  let resumeText = new TextDecoder('utf-8').decode(mem.subarray(1024, 1024 + resumeLen));
  console.log(`Resume text: ${resumeText}`);
  let parsedResp = JSON.parse(resumeText);
  if (parsedResp.type === 'direct' && parsedResp.displayText.includes('Reunión agendada')) {
    console.log(`PASSED: Create meeting confirmation with spaced JSON.`);
    passed++;
  } else {
    console.error(`FAILED: Create meeting confirmation with spaced JSON.`);
    failed++;
  }

  // 7. Test resume callback with reversed key order {"data": ..., "success": true}
  console.log('\n=== TEST: resume callback (Create Meeting - Reversed Key Order) ===');
  mockRes = new TextEncoder().encode('{"data":{"eventId":"evt_999"},"error":null,"success":true}');
  mem.set(mockRes, 4096);
  resumeLen = instance.exports.resume(4096, mockRes.length);
  resumeText = new TextDecoder('utf-8').decode(mem.subarray(1024, 1024 + resumeLen));
  console.log(`Resume text: ${resumeText}`);
  parsedResp = JSON.parse(resumeText);
  if (parsedResp.type === 'direct' && parsedResp.displayText.includes('Reunión agendada')) {
    console.log(`PASSED: Create meeting confirmation with reversed key order.`);
    passed++;
  } else {
    console.error(`FAILED: Create meeting confirmation with reversed key order.`);
    failed++;
  }

  // 8. Test resume callback for List Agenda (Empty)
  // Re-run list case to set op=2
  runCase('8. List Agenda check', 'list', 'calendar', 'events', 0);
  console.log('\n=== TEST: resume callback (List Agenda - Empty with spaces) ===');
  mockRes = new TextEncoder().encode('{\n  "success": true,\n  "data": {\n    "events": []\n  }\n}');
  mem.set(mockRes, 4096);
  resumeLen = instance.exports.resume(4096, mockRes.length);
  resumeText = new TextDecoder('utf-8').decode(mem.subarray(1024, 1024 + resumeLen));
  console.log(`Resume text: ${resumeText}`);
  parsedResp = JSON.parse(resumeText);
  if (parsedResp.type === 'direct' && parsedResp.displayText.includes('Tu agenda está libre')) {
    console.log(`PASSED: List empty agenda.`);
    passed++;
  } else {
    console.error(`FAILED: List empty agenda.`);
    failed++;
  }

  // 9. Test resume callback for List Agenda (Active Events)
  console.log('\n=== TEST: resume callback (List Agenda - Active Events) ===');
  mockRes = new TextEncoder().encode('{"success": true, "data": {"events": [{"title": "Sprint Planning"}]}}');
  mem.set(mockRes, 4096);
  resumeLen = instance.exports.resume(4096, mockRes.length);
  resumeText = new TextDecoder('utf-8').decode(mem.subarray(1024, 1024 + resumeLen));
  console.log(`Resume text: ${resumeText}`);
  parsedResp = JSON.parse(resumeText);
  if (parsedResp.type === 'direct' && parsedResp.displayText.includes('Agenda de Eventos')) {
    console.log(`PASSED: List active agenda.`);
    passed++;
  } else {
    console.error(`FAILED: List active agenda.`);
    failed++;
  }

  // 10. Test resume callback for Explicit Permission Denied
  console.log('\n=== TEST: resume callback (Explicit Permission Denied) ===');
  mockRes = new TextEncoder().encode('{"success": false, "error": "Permiso denegado: falta calendar.read"}');
  mem.set(mockRes, 4096);
  resumeLen = instance.exports.resume(4096, mockRes.length);
  resumeText = new TextDecoder('utf-8').decode(mem.subarray(1024, 1024 + resumeLen));
  console.log(`Resume text: ${resumeText}`);
  parsedResp = JSON.parse(resumeText);
  if (parsedResp.type === 'error' && parsedResp.errorMessage.includes('permisos')) {
    console.log(`PASSED: Explicit permission error.`);
    passed++;
  } else {
    console.error(`FAILED: Explicit permission error.`);
    failed++;
  }

  console.log(`\n================================`);
  console.log(`TOTAL: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

testWasm().catch(err => {
  console.error(err);
  process.exit(1);
});
