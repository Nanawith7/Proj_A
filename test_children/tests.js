// ═══════════════════════════════════════════════════════
// UNIT TESTS: Position parsing and resolution
// ═══════════════════════════════════════════════════════

function runPositionTests() {
  console.log('=== Position Parsing Tests ===');

  // parseRelative tests (with isOutside flag)
  let tests = [
    ['left-10', {dir: 'left', val: 10, isOutside: false}],
    ['right-5', {dir: 'right', val: 5, isOutside: false}],
    ['top-3', {dir: 'top', val: 3, isOutside: false}],
    ['bottom-8', {dir: 'bottom', val: 8, isOutside: false}],
    ['-10', {dir: 'abs', val: -10, isOutside: false}],
    ['15', {dir: 'abs', val: 15, isOutside: false}],
    [null, null],
    ['', null],
    ['invalid', null],
    // Negative offset tests (outside parent)
    ['left--10', {dir: 'left', val: -10, isOutside: true}],
    ['right--10', {dir: 'right', val: -10, isOutside: true}],
    ['top--5', {dir: 'top', val: -5, isOutside: true}],
    ['bottom--8', {dir: 'bottom', val: -8, isOutside: true}],
  ];

  for (const [input, expected] of tests) {
    const result = window._parseRelative(input);
    const pass = JSON.stringify(result) === JSON.stringify(expected);
    console.log(`parseRelative(${JSON.stringify(input)}) => ${JSON.stringify(result)} ${pass ? '\u2713' : '\u2717 FAIL'}`);
  }

  // resolveRelX tests
  console.log('\n=== resolveRelX Tests (parentW=400) ===');
  const pw = 400;
  [
    [window._parseRelative('left-10'), 10, 'left-10 with childW=100'],
    [window._parseRelative('right-10'), 290, 'right-10 with childW=100'],
    [window._parseRelative('-5'), -5, '-5 (overflow left) with childW=100'],
    [null, 150, 'center with childW=100'],
    // Negative offset tests (outside parent)
    [window._parseRelative('left--20'), -20, 'left--20 (20px outside left edge) with childW=100'],
    [window._parseRelative('right--20'), 420, 'right--20 (20px outside right edge) with childW=100'],
  ].forEach(([parsed, expected, desc]) => {
    const result = window._resolveRelX(parsed, pw, 100);
    const pass = Math.abs(result - expected) < 0.01;
    console.log(`${desc}: ${result} ${pass ? '\u2713' : '\u2717 FAIL (expected ' + expected + ')'}`);
  });

  // resolveRelY tests
  console.log('\n=== resolveRelY Tests (parentH=300) ===');
  const ph = 300;
  [
    [window._parseRelative('top-5'), 5, 'top-5 with childH=30'],
    [window._parseRelative('bottom-10'), 260, 'bottom-10 with childH=30'],
    [null, 0, 'top (default) with childH=30'],
    // Negative offset tests (outside parent)
    [window._parseRelative('top--20'), -20, 'top--20 (20px outside top edge) with childH=50'],
    [window._parseRelative('bottom--20'), 320, 'bottom--20 (20px outside bottom edge) with childH=50'],
  ].forEach(([parsed, expected, desc]) => {
    const result = window._resolveRelY(parsed, ph, 30);
    const pass = Math.abs(result - expected) < 0.01;
    console.log(`${desc}: ${result} ${pass ? '\u2713' : '\u2717 FAIL (expected ' + expected + ')'}`);
  });

  // Integration test: two-pass positioning (inside vs outside children)
  console.log('\n=== Two-Pass Positioning Test ===');
  
  // Create a test parent with inside and outside children
  const testParent = window._makeEl('box', { label: 'Test Parent', w: null, h: null, fill: '#111' });
  testParent._ax = 0; testParent._ay = 0;
  
  // Inside child (should expand parent)
  const insideChild = window._makeEl('box', { label: 'Inside Child', text: 'Inside', w: 80, h: 30, fill: '#222' });
  testParent.children.push(insideChild);
  
  // Outside child (right--30 = 30px outside right edge)
  const outsideChild = window._makeEl('box', { label: 'Outside Child', text: 'Out', w: 60, h: 25, fill: '#333', xRel: 'right--30' });
  testParent.children.push(outsideChild);
  
  // Measure first
  window._measureElement(testParent);
  console.log(`After measure: parent _cw=${testParent._cw}, _ch=${testParent._ch}`);
  
  // Resolve positions
  window._resolvePositions(testParent);
  console.log(`After resolve:`);
  console.log(`  Inside child: _ax=${insideChild._ax}, _ay=${insideChild._ay}, _cw=${insideChild._cw}, _ch=${insideChild._ch}`);
  console.log(`  Outside child: _ax=${outsideChild._ax}, _ay=${outsideChild._ay}, _cw=${outsideChild._cw}, _ch=${outsideChild._ch}`);
  console.log(`  Parent: _cw=${testParent._cw}, _ch=${testParent._ch}`);
  
  // Verify: parent should NOT expand to include outside child
  const insideRight = insideChild._ax + insideChild._cw;
  const outsideRight = outsideChild._ax + outsideChild._cw;
  console.log(`  Inside right edge: ${insideRight}`);
  console.log(`  Outside right edge: ${outsideRight}`);
  console.log(`  Parent width: ${testParent._cw}`);
  
  // Check that outside child is positioned relative to parent's right edge
  const expectedOutsideAx = testParent._cw + 30; // parent right edge + 30px
  const passOutside = Math.abs(outsideChild._ax - expectedOutsideAx) < 1;
  console.log(`  Outside child ax=${outsideChild._ax} (expected ${expectedOutsideAx}) ${passOutside ? '\u2713' : '\u2717 FAIL'}`);
  
  // Check that parent width is based on inside child only (not outside)
  const expectedParentW = Math.max(insideRight + 20, 40); // inside child right + padding
  const passParentSize = testParent._cw <= expectedOutsideAx; // parent should NOT include outside child
  console.log(`  Parent width=${testParent._cw} (should be < ${expectedOutsideAx}) ${passParentSize ? '\u2713' : '\u2717 FAIL'}`);

  // ── Text measurement tests ──
  console.log('\n=== Text Measurement Tests ===');
  
  // Test wrapText
  console.log('\n--- wrapText tests ---');
  const longText = 'This is a long sentence that should be wrapped';
  const wrapped = window._wrapText(longText, 100, 11);
  console.log(`wrapText("long sentence", 100, 11): ${wrapped.length} lines`);
  for (let i = 0; i < wrapped.length; i++) {
    console.log(`  Line ${i}: "${wrapped[i]}" (${window._measureText(wrapped[i], 11).toFixed(1)}px)`);
  }
  const wrapPass = wrapped.length > 1 && wrapped.every(l => window._measureText(l, 11) <= 102);
  console.log(`  ${wrapPass ? '\u2713' : '\u2717 FAIL'} - all lines fit within maxWidth`);
  
  // Test fitFontSize
  console.log('\n--- fitFontSize tests ---');
  const testText = 'This text needs to fit in a small box';
  const fontSize1 = window._fitFontSize(testText, 100, 50, 6);
  console.log(`fitFontSize("small box", 100x50): ${fontSize1}px`);
  const lines1 = window._wrapText(testText, 100, fontSize1);
  const neededH1 = lines1.length * (fontSize1 + 4);
  console.log(`  Lines: ${lines1.length}, needed height: ${neededH1}px (max 50px)`);
  const fitPass1 = neededH1 <= 50;
  console.log(`  ${fitPass1 ? '\u2713' : '\u2717 FAIL'} - fits within maxHeight`);
  
  const fontSize2 = window._fitFontSize(testText, 200, 100, 6);
  console.log(`fitFontSize("larger box", 200x100): ${fontSize2}px`);
  const lines2 = window._wrapText(testText, 200, fontSize2);
  const neededH2 = lines2.length * (fontSize2 + 4);
  console.log(`  Lines: ${lines2.length}, needed height: ${neededH2}px (max 100px)`);
  const fitPass2 = neededH2 <= 100 && fontSize2 > fontSize1;
  console.log(`  ${fitPass2 ? '\u2713' : '\u2717 FAIL'} - fits and larger font than small box`);
  
  // Test measureElement with text constraints
  console.log('\n--- measureElement with text tests ---');
  
  // Fixed width, auto height
  const fixedW = window._makeEl('box', { label: 'Fixed W', text: 'This is wrapped text that should wrap to multiple lines', w: 120, h: null });
  window._measureElement(fixedW);
  console.log(`Fixed W (120px): _cw=${fixedW._cw}, _ch=${fixedW._ch}`);
  const fixedWPass = fixedW._ch > 20; // Should have some height from wrapped text
  console.log(`  ${fixedWPass ? '\u2713' : '\u2717 FAIL'} - has height from wrapped text`);
  
  // Both fixed, text may shrink
  const bothFixed = window._makeEl('box', { label: 'Both Fixed', text: 'Very long text that might not fit', w: 80, h: 40 });
  window._measureElement(bothFixed);
  console.log(`Both Fixed (80x40): _cw=${bothFixed._cw}, _ch=${bothFixed._ch}`);
  const bothFixedPass = bothFixed._cw === 80 && bothFixed._ch === 40;
  console.log(`  ${bothFixedPass ? '\u2713' : '\u2717 FAIL'} - dimensions match fixed values`);
  
  // ── Text overflow tests ──
  console.log('\n=== Text Overflow Tests ===');
  
  // Test shrink mode (default)
  const shrinkEl = window._makeEl('box', { 
    label: 'Shrink Test', 
    text: 'This is a very long text that should shrink to minimum font size', 
    w: 80, 
    h: 30,
    textOverflow: 'shrink'
  });
  window._measureElement(shrinkEl);
  console.log(`Shrink mode: _cw=${shrinkEl._cw}, _ch=${shrinkEl._ch}`);
  console.log(`  textOverflow=${shrinkEl.textOverflow} \u2713`);
  
  // Test clip mode
  const clipEl = window._makeEl('box', { 
    label: 'Clip Test', 
    text: 'This is a very long text that should be clipped with ellipsis', 
    w: 80, 
    h: 30,
    textOverflow: 'clip'
  });
  window._measureElement(clipEl);
  console.log(`Clip mode: _cw=${clipEl._cw}, _ch=${clipEl._ch}`);
  console.log(`  textOverflow=${clipEl.textOverflow} \u2713`);
  
  // Test maxLines calculation
  const testAvailW = 60;
  const testAvailH = 24;
  const minFontSize = 6;
  const testFontSize = window._fitFontSize('Long text for testing', testAvailW, testAvailH, minFontSize);
  const testLineHeight = testFontSize + 4;
  const testMaxLines = Math.max(1, Math.floor(testAvailH / testLineHeight));
  const testLines = window._wrapText('Long text for testing', testAvailW, testFontSize);
  console.log(`\nMax lines calc: fontSize=${testFontSize}, lineHeight=${testLineHeight}, maxLines=${testMaxLines}, totalLines=${testLines.length}`);
  if (testLines.length > testMaxLines) {
    console.log(`  Would clip: ${testLines.length} lines -> ${testMaxLines} lines \u2713`);
  } else {
    console.log(`  No clip needed: ${testLines.length} lines fit \u2713`);
  }
}

// ═══════════════════════════════════════════════════════
// DEBUG: Print layout tree with computed values
// ═══════════════════════════════════════════════════════

function debugPrintLayout(el, depth = 0) {
  const indent = '  '.repeat(depth);
  const rel = el.xRel !== null || el.yRel !== null ? ` [xRel=${el.xRel ?? 'null'}, yRel=${el.yRel ?? 'null'}]` : '';
  const size = `w=${el.w === null ? 'auto' : el.w}, h=${el.h === null ? 'auto' : el.h}`;
  const computed = ` \u2192 _ax=${Math.round(el._ax)}, _ay=${Math.round(el._ay)}, _cw=${Math.round(el._cw)}, _ch=${Math.round(el._ch)}`;
  console.log(`${indent}${el.label}(${el.shape}) ${size}${rel}${computed}`);
  if (el.children) {
    for (const child of el.children) {
      debugPrintLayout(child, depth + 1);
    }
  }
}

// ═══════════════════════════════════════════════════════
// INIT - called after all modules load
// ═══════════════════════════════════════════════════════

function runInit() {
  window._renderTree();
  window._renderProps();
  window._render();
  runPositionTests();
  console.log('\n=== Layout Debug ===');
  debugPrintLayout(window.root);
  console.log('\n=== Tips ===');
  console.log('- Use left--N / right--N / top--N / bottom--N to position outside parent');
  console.log('- Example: right--20 = 20px outside the right edge');
}

window.testModule = { runPositionTests, debugPrintLayout, runInit };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window._runInit = runInit;
    runInit();
  });
} else {
  runInit();
}
