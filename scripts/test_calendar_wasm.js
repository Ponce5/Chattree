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

  function runCase(name, inputStr, expectedChecks) {
    capturedHostCalls = [];
    const inputBytes = new TextEncoder().encode(inputStr);
    mem.set(inputBytes, 5000);
    const res = instance.exports.calendar_entry(5000, inputBytes.length);
    console.log(`\n=== CASE: ${name} ===`);
    console.log(`Result code: ${res} (0 = async pending)`);
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

    if (parsed.api !== 'calendar' || parsed.operation !== 'create') {
      console.error(`FAILED: Incorrect api or operation:`, parsed);
      failed++;
      return;
    }

    let checkOk = true;
    for (const [k, v] of Object.entries(expectedChecks)) {
      if (parsed.payload[k] !== v) {
        console.error(`FAILED: expected payload.${k} == "${v}", got "${parsed.payload[k]}"`);
        checkOk = false;
      }
    }

    if (checkOk) {
      console.log(`PASSED: All payload checks passed.`);
      passed++;
    } else {
      failed++;
    }
  }

  runCase('1. Empty input', '', {
    title: 'Reunión',
    startDate: '2026-10-16T10:00:00Z',
    endDate: '2026-10-16T11:00:00Z'
  });

  runCase('2. Natural title', 'Reunión de planificación', {
    title: 'Reunión de planificación',
    startDate: '2026-10-16T10:00:00Z',
    endDate: '2026-10-16T11:00:00Z'
  });

  runCase('3. Full pipe syntax', 'Reunión con el equipo | 2026-10-16T15:00:00Z | 2026-10-16T16:00:00Z | Discutir arquitectura', {
    title: 'Reunión con el equipo',
    startDate: '2026-10-16T15:00:00Z',
    endDate: '2026-10-16T16:00:00Z',
    description: 'Discutir arquitectura'
  });

  runCase('4. add prefix', 'add Cita con dentista | 2026-10-20T09:30:00Z', {
    title: 'Cita con dentista',
    startDate: '2026-10-20T09:30:00Z',
    endDate: '2026-10-16T11:00:00Z'
  });

  runCase('5. creame una reunion prefix', 'creame una reunion con Juan y Pedro', {
    title: 'con Juan y Pedro',
    startDate: '2026-10-16T10:00:00Z',
    endDate: '2026-10-16T11:00:00Z'
  });

  runCase('6. direct JSON payload without api wrapper', JSON.stringify({
    title: 'Sync semanal',
    startDate: '2026-10-18T10:00:00Z',
    endDate: '2026-10-18T11:00:00Z'
  }), {
    title: 'Sync semanal',
    startDate: '2026-10-18T10:00:00Z'
  });

  runCase('7. full Host API JSON payload', JSON.stringify({
    api: 'calendar',
    operation: 'create',
    payload: {
      title: 'Auditoría',
      startDate: '2026-10-22T08:00:00Z'
    }
  }), {
    title: 'Auditoría'
  });

  // Test resume callback
  console.log('\n=== TEST: resume callback (success) ===');
  const mockRes = new TextEncoder().encode(JSON.stringify({ success: true, data: { eventId: 'cal_99', created: true } }));
  mem.set(mockRes, 4096);
  const resumeLen = instance.exports.resume(4096, mockRes.length);
  const resumeText = new TextDecoder('utf-8').decode(mem.subarray(1024, 1024 + resumeLen));
  console.log(`Resume text: ${resumeText}`);
  const parsedResp = JSON.parse(resumeText);
  if (parsedResp.type === 'direct' && parsedResp.displayText.includes('Reunión agendada')) {
    console.log(`PASSED: resume success callback format.`);
    passed++;
  } else {
    console.error(`FAILED: resume success callback.`);
    failed++;
  }

  console.log('\n=== TEST: resume callback (error) ===');
  const mockErr = new TextEncoder().encode(JSON.stringify({ success: false, error: 'Permission denied' }));
  mem.set(mockErr, 4096);
  const errLen = instance.exports.resume(4096, mockErr.length);
  const errText = new TextDecoder('utf-8').decode(mem.subarray(1024, 1024 + errLen));
  console.log(`Resume error text: ${errText}`);
  const parsedErr = JSON.parse(errText);
  if (parsedErr.type === 'error') {
    console.log(`PASSED: resume error callback format.`);
    passed++;
  } else {
    console.error(`FAILED: resume error callback.`);
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
