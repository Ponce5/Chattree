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

  function runCase(name, inputStr, expectedApi, expectedOp) {
    capturedHostCalls = [];
    const inputBytes = new TextEncoder().encode(inputStr);
    mem.set(inputBytes, 5000);
    const res = instance.exports.calendar_entry(5000, inputBytes.length);
    console.log(`\n=== CASE: ${name} ===`);
    console.log(`Input: "${inputStr}" -> Result code: ${res}`);
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

  // 1. Single /calendar command without args -> List Agenda
  runCase('1. Empty input (/calendar alone)', '', 'calendar', 'events');

  // 1.b Explicit /calendar list -> List Agenda
  runCase('1b. Explicit /calendar list', 'list', 'calendar', 'events');

  // Test resume for List Agenda with empty events
  console.log('\n=== TEST: resume callback (List Agenda - Empty) ===');
  let mockRes = new TextEncoder().encode(JSON.stringify({ success: true, data: { events: [] } }));
  mem.set(mockRes, 4096);
  let resumeLen = instance.exports.resume(4096, mockRes.length);
  let resumeText = new TextDecoder('utf-8').decode(mem.subarray(1024, 1024 + resumeLen));
  console.log(`Resume text: ${resumeText}`);
  let parsedResp = JSON.parse(resumeText);
  if (parsedResp.type === 'direct' && parsedResp.displayText.includes('Tu agenda está libre')) {
    console.log(`PASSED: List empty agenda.`);
    passed++;
  } else {
    console.error(`FAILED: List empty agenda.`);
    failed++;
  }

  // Test resume for List Agenda with active events
  console.log('\n=== TEST: resume callback (List Agenda - Active Events) ===');
  mockRes = new TextEncoder().encode(JSON.stringify({ success: true, data: { events: [{ title: 'Reunión de Diseño' }] } }));
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

  // 2. /calendar with arguments -> Intelligently create meeting
  runCase('2. Natural title (/calendar Reunión de equipo)', 'Reunión de equipo', 'calendar', 'create');
  runCase('3. Full pipe (/calendar Reunión | 2026-10-16T15:00:00Z)', 'Reunión | 2026-10-16T15:00:00Z', 'calendar', 'create');
  runCase('4. Conversational (/calendar creame una reunion con Pedro)', 'creame una reunion con Pedro', 'calendar', 'create');
  runCase('5. JSON payload', JSON.stringify({ title: 'Sync Semanal' }), 'calendar', 'create');

  // Test resume for Create Meeting
  console.log('\n=== TEST: resume callback (Create Meeting Success) ===');
  mockRes = new TextEncoder().encode(JSON.stringify({ success: true, data: { eventId: 'evt_123' } }));
  mem.set(mockRes, 4096);
  resumeLen = instance.exports.resume(4096, mockRes.length);
  resumeText = new TextDecoder('utf-8').decode(mem.subarray(1024, 1024 + resumeLen));
  console.log(`Resume text: ${resumeText}`);
  parsedResp = JSON.parse(resumeText);
  if (parsedResp.type === 'direct' && parsedResp.displayText.includes('Reunión agendada')) {
    console.log(`PASSED: Create meeting confirmation.`);
    passed++;
  } else {
    console.error(`FAILED: Create meeting confirmation.`);
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
