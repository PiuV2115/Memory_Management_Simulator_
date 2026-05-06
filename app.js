/* ═══════════════════════════════════════════════════════════════
   app.js — Memory Management Simulator
   Sections:
     1.  Constants & Palette
     2.  Algorithm Metadata
     3.  App State
     4.  ── ALLOCATION ENGINE ──
         4a. First Fit
         4b. Best Fit
         4c. Worst Fit
         4d. Next Fit
         4e. runAllocAlgo() dispatcher
     5.  ── PAGE REPLACEMENT ENGINE ──
         5a. FIFO
         5b. LRU
         5c. Optimal
         5d. runPageAlgo() dispatcher
     6.  ── UI: ALLOCATION TAB ──
         6a. renderAlgoStrip()
         6b. setAlgo()
         6c. renderExplain()
         6d. renderBlocks()
         6e. renderProcs()
         6f. addBlock() / addProcess()
         6g. delBlock() / delProc()
         6h. updBlock() / updProc()
         6i. runAlloc()
         6j. renderAllocResult()
     7.  ── UI: PAGE REPLACEMENT TAB ──
         7a. renderPageAlgoStrip()
         7b. setPageAlgo()
         7c. renderPageExplain()
         7d. runPageReplacement()
         7e. renderPageResult()
     8.  Tab switching
     9.  Header stats updater
    10.  Toast notifications
    11.  Init
═══════════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────────────────
   1. CONSTANTS & PALETTE
───────────────────────────────────────────────────────────── */
const PROC_COLORS = [
  '#00e5a0','#38bdf8','#ffb340','#ff4d6a',
  '#a78bfa','#fb923c','#34d399','#f472b6'
];

function pidColor(idx) {
  return PROC_COLORS[idx % PROC_COLORS.length];
}


/* ─────────────────────────────────────────────────────────────
   2. ALGORITHM METADATA
───────────────────────────────────────────────────────────── */
const ALLOC_META = {
  firstfit: {
    label: 'First Fit',
    explain: `<strong>First Fit</strong> scans memory from the beginning and allocates the
      <em>first</em> free block large enough to satisfy the request.
      Fast but may cause external fragmentation near the start of memory.`
  },
  bestfit: {
    label: 'Best Fit',
    explain: `<strong>Best Fit</strong> searches all free blocks and picks the
      <em>smallest</em> one that is still large enough. Minimises wasted space per
      allocation but leaves many tiny unusable fragments over time.`
  },
  worstfit: {
    label: 'Worst Fit',
    explain: `<strong>Worst Fit</strong> always allocates from the <em>largest</em>
      free block, leaving the biggest possible remainder. Reduces tiny unusable
      holes but can exhaust large blocks quickly.`
  },
  nextfit: {
    label: 'Next Fit',
    explain: `<strong>Next Fit</strong> is a variant of First Fit that starts searching
      from where the <em>last allocation</em> ended rather than the beginning.
      Distributes allocations more evenly across memory.`
  }
};

const PAGE_META = {
  fifo: {
    label: 'FIFO',
    explain: `<strong>FIFO</strong> (First-In First-Out) replaces the page that has been
      in memory the <em>longest</em>. Simple to implement but can suffer from
      <em>Bélády's anomaly</em> — more frames can cause more page faults.`
  },
  lru: {
    label: 'LRU',
    explain: `<strong>LRU</strong> (Least Recently Used) replaces the page that has
      <em>not been used for the longest time</em>. Based on temporal locality;
      performs well in practice but requires tracking usage history.`
  },
  optimal: {
    label: 'Optimal',
    explain: `<strong>Optimal</strong> (OPT / Clairvoyant) replaces the page that
      <em>will not be used for the longest time in the future</em>. Gives the
      theoretical minimum page faults — used as a benchmark, not practical.`
  }
};


/* ─────────────────────────────────────────────────────────────
   3. APP STATE
───────────────────────────────────────────────────────────── */
let currentAlgo     = 'firstfit';
let currentPageAlgo = 'fifo';
let nextFitPtr      = 0; // Next Fit pointer

// Default memory blocks
let blocks = [
  { id: 1, size: 100 },
  { id: 2, size: 500 },
  { id: 3, size: 200 },
  { id: 4, size: 300 },
  { id: 5, size: 600 },
];

// Default processes
let procs = [
  { id: 1, pid: 'P1', size: 212 },
  { id: 2, pid: 'P2', size: 417 },
  { id: 3, pid: 'P3', size: 112 },
  { id: 4, pid: 'P4', size: 426 },
];

let blockIdSeq = 6;
let procIdSeq  = 5;


/* ─────────────────────────────────────────────────────────────
   4. ALLOCATION ENGINE
───────────────────────────────────────────────────────────── */

/** Returns a deep copy of blocks as working state */
function cloneBlocks() {
  return blocks.map(b => ({ ...b, allocated: null, remaining: b.size }));
}

/** 4a. First Fit */
function firstFit(workBlocks, processes) {
  const result = [];
  for (const proc of processes) {
    let allocated = false;
    for (const blk of workBlocks) {
      if (blk.remaining >= proc.size) {
        blk.remaining -= proc.size;
        result.push({ pid: proc.pid, size: proc.size, blockId: blk.id, blockOrigSize: blk.size, success: true });
        allocated = true;
        break;
      }
    }
    if (!allocated) result.push({ pid: proc.pid, size: proc.size, success: false });
  }
  return result;
}

/** 4b. Best Fit */
function bestFit(workBlocks, processes) {
  const result = [];
  for (const proc of processes) {
    let bestIdx = -1, bestWaste = Infinity;
    for (let i = 0; i < workBlocks.length; i++) {
      const blk = workBlocks[i];
      const waste = blk.remaining - proc.size;
      if (waste >= 0 && waste < bestWaste) {
        bestWaste = waste;
        bestIdx = i;
      }
    }
    if (bestIdx !== -1) {
      workBlocks[bestIdx].remaining -= proc.size;
      result.push({ pid: proc.pid, size: proc.size, blockId: workBlocks[bestIdx].id, blockOrigSize: workBlocks[bestIdx].size, success: true });
    } else {
      result.push({ pid: proc.pid, size: proc.size, success: false });
    }
  }
  return result;
}

/** 4c. Worst Fit */
function worstFit(workBlocks, processes) {
  const result = [];
  for (const proc of processes) {
    let worstIdx = -1, worstSize = -1;
    for (let i = 0; i < workBlocks.length; i++) {
      const blk = workBlocks[i];
      if (blk.remaining >= proc.size && blk.remaining > worstSize) {
        worstSize = blk.remaining;
        worstIdx = i;
      }
    }
    if (worstIdx !== -1) {
      workBlocks[worstIdx].remaining -= proc.size;
      result.push({ pid: proc.pid, size: proc.size, blockId: workBlocks[worstIdx].id, blockOrigSize: workBlocks[worstIdx].size, success: true });
    } else {
      result.push({ pid: proc.pid, size: proc.size, success: false });
    }
  }
  return result;
}

/** 4d. Next Fit */
function nextFit(workBlocks, processes) {
  const result = [];
  let ptr = nextFitPtr % workBlocks.length;
  for (const proc of processes) {
    let allocated = false;
    for (let i = 0; i < workBlocks.length; i++) {
      const idx = (ptr + i) % workBlocks.length;
      const blk = workBlocks[idx];
      if (blk.remaining >= proc.size) {
        blk.remaining -= proc.size;
        ptr = (idx + 1) % workBlocks.length;
        result.push({ pid: proc.pid, size: proc.size, blockId: blk.id, blockOrigSize: blk.size, success: true });
        allocated = true;
        break;
      }
    }
    if (!allocated) result.push({ pid: proc.pid, size: proc.size, success: false });
  }
  nextFitPtr = ptr;
  return result;
}

/** 4e. Dispatcher */
function runAllocAlgo(algo, workBlocks, processes) {
  switch (algo) {
    case 'firstfit': return firstFit(workBlocks, processes);
    case 'bestfit':  return bestFit(workBlocks, processes);
    case 'worstfit': return worstFit(workBlocks, processes);
    case 'nextfit':  return nextFit(workBlocks, processes);
    default:         return firstFit(workBlocks, processes);
  }
}


/* ─────────────────────────────────────────────────────────────
   5. PAGE REPLACEMENT ENGINE
───────────────────────────────────────────────────────────── */

/** 5a. FIFO */
function fifoAlgo(refs, frames) {
  const memory = [];
  const queue  = [];   // insertion order
  const steps  = [];
  let hits = 0, faults = 0;

  for (const page of refs) {
    if (memory.includes(page)) {
      hits++;
      steps.push({ page, memory: [...memory], fault: false, replaced: null });
    } else {
      faults++;
      let replaced = null;
      if (memory.length >= frames) {
        replaced = queue.shift();
        memory.splice(memory.indexOf(replaced), 1);
      }
      memory.push(page);
      queue.push(page);
      steps.push({ page, memory: [...memory], fault: true, replaced });
    }
  }
  return { steps, hits, faults };
}

/** 5b. LRU */
function lruAlgo(refs, frames) {
  const memory = [];
  const steps  = [];
  let hits = 0, faults = 0;

  for (let t = 0; t < refs.length; t++) {
    const page = refs[t];
    if (memory.includes(page)) {
      hits++;
      // Move to end (most recently used)
      memory.splice(memory.indexOf(page), 1);
      memory.push(page);
      steps.push({ page, memory: [...memory], fault: false, replaced: null });
    } else {
      faults++;
      let replaced = null;
      if (memory.length >= frames) {
        replaced = memory.shift(); // least recently used = front
      }
      memory.push(page);
      steps.push({ page, memory: [...memory], fault: true, replaced });
    }
  }
  return { steps, hits, faults };
}

/** 5c. Optimal */
function optimalAlgo(refs, frames) {
  const memory = [];
  const steps  = [];
  let hits = 0, faults = 0;

  for (let t = 0; t < refs.length; t++) {
    const page = refs[t];
    if (memory.includes(page)) {
      hits++;
      steps.push({ page, memory: [...memory], fault: false, replaced: null });
    } else {
      faults++;
      let replaced = null;
      if (memory.length >= frames) {
        // Find page whose next use is farthest in the future
        let farthest = -1, victim = memory[0];
        for (const p of memory) {
          let nextUse = refs.slice(t + 1).indexOf(p);
          if (nextUse === -1) nextUse = Infinity;
          if (nextUse > farthest) { farthest = nextUse; victim = p; }
        }
        replaced = victim;
        memory.splice(memory.indexOf(victim), 1);
      }
      memory.push(page);
      steps.push({ page, memory: [...memory], fault: true, replaced });
    }
  }
  return { steps, hits, faults };
}

/** 5d. Dispatcher */
function runPageAlgo(algo, refs, frames) {
  switch (algo) {
    case 'fifo':    return fifoAlgo(refs, frames);
    case 'lru':     return lruAlgo(refs, frames);
    case 'optimal': return optimalAlgo(refs, frames);
    default:        return fifoAlgo(refs, frames);
  }
}


/* ─────────────────────────────────────────────────────────────
   6. UI: ALLOCATION TAB
───────────────────────────────────────────────────────────── */

/** 6a. Render algorithm strip */
function renderAlgoStrip() {
  const strip = document.getElementById('algoStrip');
  strip.innerHTML = '';
  for (const [key, meta] of Object.entries(ALLOC_META)) {
    const pill = document.createElement('button');
    pill.className = 'algo-pill' + (key === currentAlgo ? ' active' : '');
    pill.textContent = meta.label;
    pill.onclick = () => setAlgo(key);
    strip.appendChild(pill);
  }
}

/** 6b. Switch allocation algorithm */
function setAlgo(key) {
  currentAlgo = key;
  nextFitPtr  = 0;
  renderAlgoStrip();
  renderExplain();
  document.getElementById('algoLabel').textContent = ALLOC_META[key].label;
}

/** 6c. Render explain box */
function renderExplain() {
  document.getElementById('explainBox').innerHTML = ALLOC_META[currentAlgo].explain;
}

/** 6d. Render blocks table */
function renderBlocks() {
  const body = document.getElementById('blocksBody');
  body.innerHTML = '';
  blocks.forEach((b, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span style="color:var(--text2);font-weight:700">B${i+1}</span></td>
      <td><input class="tbl-inp" type="number" min="1" value="${b.size}"
           onchange="updBlock(${b.id}, this.value)"></td>
      <td><button class="del-btn" onclick="delBlock(${b.id})">×</button></td>
    `;
    body.appendChild(tr);
  });
}

/** 6e. Render processes table */
function renderProcs() {
  const body = document.getElementById('procsBody');
  body.innerHTML = '';
  procs.forEach((p, i) => {
    const col = pidColor(i);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="pid-dot" style="background:${col}"></span>
        <input class="tbl-inp" type="text" style="width:60px;display:inline-block"
               value="${p.pid}" onchange="updProc(${p.id},'pid',this.value)">
      </td>
      <td><input class="tbl-inp" type="number" min="1" value="${p.size}"
           onchange="updProc(${p.id},'size',this.value)"></td>
      <td><button class="del-btn" onclick="delProc(${p.id})">×</button></td>
    `;
    body.appendChild(tr);
  });
}

/** 6f. Add block / process */
function addBlock() {
  blocks.push({ id: blockIdSeq++, size: 100 });
  renderBlocks();
  toast('Block added', 'info');
}

function addProcess() {
  const n = procIdSeq++;
  procs.push({ id: n, pid: `P${n}`, size: 100 });
  renderProcs();
  toast('Process added', 'info');
}

/** 6g. Delete block / process */
function delBlock(id) {
  blocks = blocks.filter(b => b.id !== id);
  renderBlocks();
}

function delProc(id) {
  procs = procs.filter(p => p.id !== id);
  renderProcs();
}

/** 6h. Update block / process */
function updBlock(id, val) {
  const b = blocks.find(b => b.id === id);
  if (b) b.size = Math.max(1, parseInt(val) || 1);
}

function updProc(id, field, val) {
  const p = procs.find(p => p.id === id);
  if (!p) return;
  if (field === 'pid')  p.pid  = val.trim() || p.pid;
  if (field === 'size') p.size = Math.max(1, parseInt(val) || 1);
}

/** 6i. Run allocation */
function runAlloc() {
  if (!blocks.length)  { toast('Add at least one memory block', 'error'); return; }
  if (!procs.length)   { toast('Add at least one process', 'error'); return; }

  const workBlocks = cloneBlocks();
  const results    = runAllocAlgo(currentAlgo, workBlocks, procs);

  renderAllocResult(workBlocks, results);
  updateHeaderStats(workBlocks);
}

/** 6j. Render allocation results */
function renderAllocResult(workBlocks, results) {
  const totalMem    = blocks.reduce((s, b) => s + b.size, 0);
  const allocatedMem= results.filter(r => r.success).reduce((s, r) => s + r.size, 0);
  const freeMem     = totalMem - allocatedMem;
  const fragMem     = workBlocks.reduce((s, b) => s + b.remaining, 0);
  const successCount= results.filter(r => r.success).length;
  const failCount   = results.filter(r => !r.success).length;

  // Build block → process mapping for memory map
  const blockAllocMap = {}; // blockId → [{ pid, size, colorIdx }]
  results.forEach((r, ri) => {
    if (r.success) {
      if (!blockAllocMap[r.blockId]) blockAllocMap[r.blockId] = [];
      blockAllocMap[r.blockId].push({ pid: r.pid, size: r.size, colorIdx: ri });
    }
  });

  // Memory map bar segments
  let mapSegments = '';
  let totalSize = totalMem;
  blocks.forEach((blk, bi) => {
    const allocsInBlock = blockAllocMap[blk.id] || [];
    const work = workBlocks.find(w => w.id === blk.id);
    const remaining = work ? work.remaining : blk.size;

    allocsInBlock.forEach((a, ai) => {
      const pct = (a.size / totalSize * 100).toFixed(2);
      const colorIdx = procs.findIndex(p => p.pid === a.pid);
      mapSegments += `<div class="mem-segment" data-pid="${colorIdx % 8}" 
        style="flex:${pct}" title="${a.pid}: ${a.size} KB in Block ${bi+1}">
        <span class="seg-label">${a.pid}</span></div>`;
    });

    if (remaining > 0) {
      const pct = (remaining / totalSize * 100).toFixed(2);
      mapSegments += `<div class="mem-segment free-block" style="flex:${pct}" title="Free: ${remaining} KB">
        <span class="seg-label">${remaining > 40 ? remaining + ' KB' : ''}</span></div>`;
    }
  });

  // Block detail rows
  let blockRows = '';
  blocks.forEach((blk, bi) => {
    const work = workBlocks.find(w => w.id === blk.id);
    const used = blk.size - (work ? work.remaining : blk.size);
    const pct  = Math.round(used / blk.size * 100);
    const col  = pct > 0 ? 'var(--green)' : 'var(--border2)';

    const allocsInBlock = blockAllocMap[blk.id] || [];
    const pidsStr = allocsInBlock.map(a => {
      const ci = procs.findIndex(p => p.pid === a.pid);
      return `<span style="color:${pidColor(ci)};font-weight:700">${a.pid}</span>`;
    }).join(', ') || '<span style="color:var(--text3)">Free</span>';

    blockRows += `
      <div class="block-row ${used > 0 ? 'allocated' : ''}">
        <span class="block-name">Block ${bi+1} <span style="color:var(--text3)">${blk.size}KB</span></span>
        <div>
          <div class="block-bar-wrap">
            <div class="block-bar-fill" style="width:${pct}%;background:${col}"></div>
          </div>
          <div style="font-size:9px;color:var(--text3);margin-top:2px">${pct}% used · ${work?.remaining ?? 0}KB free</div>
        </div>
        <span class="block-size-label">${pidsStr}</span>
        <span class="block-status ${used > 0 ? 'used' : 'free'}">${used > 0 ? '▲ IN USE' : '○ FREE'}</span>
      </div>
    `;
  });

  // Results table rows
  let tableRows = '';
  results.forEach((r, ri) => {
    const col = pidColor(ri);
    const blockLabel = r.success ? `Block ${blocks.findIndex(b => b.id === r.blockId)+1} (${r.blockOrigSize} KB)` : '—';
    tableRows += `
      <tr>
        <td><span class="pid-dot" style="background:${col}"></span>${r.pid}</td>
        <td>${r.size} KB</td>
        <td style="color:var(--text2)">${blockLabel}</td>
        <td><span class="status-tag ${r.success ? 'allocated' : 'failed'}">${r.success ? '✓ Allocated' : '✗ Failed'}</span></td>
      </tr>
    `;
  });

  // Insight boxes
  const fragPct    = Math.round(fragMem / totalMem * 100);
  const effPct     = Math.round(allocatedMem / totalMem * 100);
  const algoInsight = {
    firstfit: { title: 'First Fit', body: 'Tends to fragment the lower part of memory. Fast due to early exit.' },
    bestfit:  { title: 'Best Fit',  body: 'Leaves smallest holes. Good space efficiency but slow scan.' },
    worstfit: { title: 'Worst Fit', body: 'Leaves large remainders. Good for large future allocations.' },
    nextfit:  { title: 'Next Fit',  body: 'Spreads allocations evenly. Avoids concentration at start.' },
  }[currentAlgo];

  const pane = document.getElementById('allocResult');
  pane.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">

      <!-- Stats -->
      <div class="result-stats">
        <div class="stat-box highlight">
          <div class="stat-num">${successCount}</div>
          <div class="stat-lbl">Allocated</div>
        </div>
        <div class="stat-box ${failCount > 0 ? 'warn' : ''}">
          <div class="stat-num">${failCount}</div>
          <div class="stat-lbl">Failed</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${allocatedMem}</div>
          <div class="stat-lbl">KB Used</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${freeMem}</div>
          <div class="stat-lbl">KB Free</div>
        </div>
      </div>

      <!-- Memory Map -->
      <div class="card">
        <div class="card-head"><span class="card-title">Memory Map</span><span class="card-badge">${totalMem} KB Total</span></div>
        <div class="card-body">
          <div class="mem-map-wrap">
            <div class="mem-bar">${mapSegments}</div>
            <div class="mem-ruler">
              <span>0</span>
              <span>${Math.round(totalMem/4)} KB</span>
              <span>${Math.round(totalMem/2)} KB</span>
              <span>${Math.round(totalMem*3/4)} KB</span>
              <span>${totalMem} KB</span>
            </div>
          </div>
          <div class="section-title">Block Detail</div>
          <div class="blocks-list">${blockRows}</div>
        </div>
      </div>

      <!-- Allocation Table -->
      <div class="card">
        <div class="card-head"><span class="card-title">Allocation Table</span><span class="card-badge">${ALLOC_META[currentAlgo].label}</span></div>
        <div class="card-body" style="padding:0">
          <table class="alloc-tbl">
            <thead><tr><th>Process</th><th>Size</th><th>Assigned Block</th><th>Status</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>

      <!-- Fragmentation -->
      <div class="card">
        <div class="card-head"><span class="card-title">Fragmentation Analysis</span></div>
        <div class="card-body">
          <div class="frag-section">
            <div class="frag-label">
              <span>External Fragmentation</span>
              <span style="color:var(--text)">${fragMem} KB (${fragPct}%)</span>
            </div>
            <div class="frag-bar"><div class="frag-fill" style="width:${fragPct}%"></div></div>
          </div>
          <div class="frag-section" style="margin-top:12px">
            <div class="frag-label">
              <span>Memory Efficiency</span>
              <span style="color:var(--green)">${effPct}%</span>
            </div>
            <div class="frag-bar" style="background:var(--surface3)">
              <div class="frag-fill" style="width:${effPct}%;background:var(--green)"></div>
            </div>
          </div>
          <div class="insight-grid">
            <div class="insight-box">
              <strong>Algorithm Behaviour</strong>
              ${algoInsight.body}
            </div>
            <div class="insight-box ${fragPct > 40 ? 'warn' : ''}">
              <strong>${fragPct > 40 ? '⚠ High Fragmentation' : '✓ Fragmentation OK'}</strong>
              ${fragPct > 40
                ? `${fragPct}% of memory is fragmented. Consider compaction or a different algorithm.`
                : `Fragmentation is manageable at ${fragPct}%. Good allocation efficiency.`}
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  toast(`${ALLOC_META[currentAlgo].label}: ${successCount} allocated, ${failCount} failed`, successCount === procs.length ? 'success' : 'info');
}

/** Reset allocation to defaults */
function resetAlloc() {
  blocks = [
    { id: 1, size: 100 },{ id: 2, size: 500 },{ id: 3, size: 200 },
    { id: 4, size: 300 },{ id: 5, size: 600 },
  ];
  procs = [
    { id: 1, pid: 'P1', size: 212 },{ id: 2, pid: 'P2', size: 417 },
    { id: 3, pid: 'P3', size: 112 },{ id: 4, pid: 'P4', size: 426 },
  ];
  blockIdSeq = 6; procIdSeq = 5; nextFitPtr = 0;
  renderBlocks(); renderProcs();
  document.getElementById('allocResult').innerHTML = `
    <div class="card"><div class="card-body">
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="4" y="4" width="32" height="32" rx="4" stroke="var(--green)" stroke-width="1.5" opacity=".3"/>
            <rect x="10" y="10" width="8" height="8" rx="1.5" fill="var(--green)" opacity=".2"/>
            <rect x="22" y="10" width="8" height="8" rx="1.5" fill="var(--green)" opacity=".1"/>
            <rect x="10" y="22" width="8" height="8" rx="1.5" fill="var(--green)" opacity=".1"/>
            <rect x="22" y="22" width="8" height="8" rx="1.5" fill="var(--green)" opacity=".05"/>
          </svg>
        </div>
        <h3>No Allocation Run</h3>
        <p>Configure memory blocks and processes,<br>then click Allocate to see results.</p>
      </div>
    </div></div>`;
  updateHeaderStats(null);
  toast('Reset to defaults', 'info');
}


/* ─────────────────────────────────────────────────────────────
   7. UI: PAGE REPLACEMENT TAB
───────────────────────────────────────────────────────────── */

/** 7a. Render page algo strip */
function renderPageAlgoStrip() {
  const strip = document.getElementById('pageAlgoStrip');
  strip.innerHTML = '';
  for (const [key, meta] of Object.entries(PAGE_META)) {
    const pill = document.createElement('button');
    pill.className = 'algo-pill' + (key === currentPageAlgo ? ' active' : '');
    pill.textContent = meta.label;
    pill.onclick = () => setPageAlgo(key);
    strip.appendChild(pill);
  }
}

/** 7b. Switch page algorithm */
function setPageAlgo(key) {
  currentPageAlgo = key;
  renderPageAlgoStrip();
  renderPageExplain();
  document.getElementById('pageAlgoLabel').textContent = PAGE_META[key].label;
}

/** 7c. Render page explain */
function renderPageExplain() {
  document.getElementById('pageExplainBox').innerHTML = PAGE_META[currentPageAlgo].explain;
}

/** 7d. Load preset reference string */
function loadPreset() {
  const presets = {
    fifo:    { ref: '7 0 1 2 0 3 0 4 2 3 0 3 2', frames: 3 },
    lru:     { ref: '1 2 3 4 1 2 5 1 2 3 4 5',   frames: 4 },
    optimal: { ref: '7 0 1 2 0 3 0 4 2 3 0 3 2', frames: 3 },
  };
  const p = presets[currentPageAlgo];
  document.getElementById('refString').value  = p.ref;
  document.getElementById('frameCount').value = p.frames;
  toast('Preset loaded', 'info');
}

/** 7e. Run page replacement */
function runPageReplacement() {
  const refRaw = document.getElementById('refString').value.trim();
  const frames = parseInt(document.getElementById('frameCount').value) || 3;
  const refs   = refRaw.split(/\s+/).map(Number).filter(n => !isNaN(n));

  if (!refs.length) { toast('Enter a valid reference string', 'error'); return; }
  if (frames < 1)   { toast('Frame count must be ≥ 1', 'error'); return; }
  if (refs.length > 30) { toast('Max 30 references for display', 'error'); return; }

  const { steps, hits, faults } = runPageAlgo(currentPageAlgo, refs, frames);
  renderPageResult(refs, steps, hits, faults, frames);
}

/** 7f. Render page result */
function renderPageResult(refs, steps, hits, faults, frames) {
  const total   = refs.length;
  const hitRate = ((hits / total) * 100).toFixed(1);
  const faultRate = ((faults / total) * 100).toFixed(1);

  // Build table header (ref numbers)
  let thCells = '<th>Frame</th>';
  refs.forEach((r, i) => {
    const cls = steps[i].fault ? 'miss' : 'hit';
    thCells += `<th class="${cls} ref-head">${r}</th>`;
  });

  // Fault row
  let faultRow = '<th style="color:var(--text3);font-size:9px;letter-spacing:.5px">H/M</th>';
  steps.forEach(s => {
    faultRow += `<td class="${s.fault ? 'miss' : 'hit'}" style="font-size:10px;font-weight:700">
      ${s.fault ? 'M' : 'H'}</td>`;
  });

  // Frame rows
  let frameRows = '';
  for (let f = 0; f < frames; f++) {
    let cells = `<th>F${f+1}</th>`;
    steps.forEach((s, si) => {
      const val = s.memory[f] !== undefined ? s.memory[f] : '';
      const isNew = s.fault && si > 0
        ? !steps[si-1].memory.includes(val) && val !== ''
        : s.fault && val !== '';
      const isReplaced = s.replaced !== null && s.replaced === steps[si > 0 ? si-1 : 0].memory[f];
      cells += `<td class="frame-cell ${isNew ? 'new-entry' : ''}">${val}</td>`;
    });
    frameRows += `<tr>${cells}</tr>`;
  }

  // Timeline steps (compact visual)
  let timelineHTML = '';
  steps.forEach((s, i) => {
    const cls = s.fault ? 'miss' : 'hit';
    timelineHTML += `<div class="timeline-step">
      <div class="timeline-ref ${cls}">${s.page}</div>`;
    for (let f = 0; f < frames; f++) {
      const v = s.memory[f] !== undefined ? s.memory[f] : '·';
      const isNew = s.fault && !steps[i > 0 ? i-1 : 0].memory.includes(s.page);
      timelineHTML += `<div class="timeline-frame ${f === s.memory.indexOf(s.page) && s.fault && isNew ? 'new' : ''}">${v}</div>`;
    }
    timelineHTML += `</div>`;
  });

  const pane = document.getElementById('pageResult');
  pane.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">

      <!-- Stats -->
      <div class="page-stats">
        <div class="stat-box highlight">
          <div class="stat-num">${hits}</div>
          <div class="stat-lbl">Page Hits</div>
        </div>
        <div class="stat-box warn">
          <div class="stat-num">${faults}</div>
          <div class="stat-lbl">Page Faults</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${hitRate}%</div>
          <div class="stat-lbl">Hit Rate</div>
        </div>
      </div>

      <!-- Timeline visual -->
      <div class="card">
        <div class="card-head">
          <span class="card-title">Step-by-Step Timeline</span>
          <span class="card-badge">${frames} Frames · ${total} References</span>
        </div>
        <div class="card-body">
          <div class="step-legend">
            <span class="legend-dot hit">Page Hit</span>
            <span class="legend-dot miss">Page Fault</span>
          </div>
          <div class="page-timeline">${timelineHTML}</div>
        </div>
      </div>

      <!-- Detailed Table -->
      <div class="card">
        <div class="card-head">
          <span class="card-title">Frame State Table</span>
          <span class="card-badge">${PAGE_META[currentPageAlgo].label}</span>
        </div>
        <div class="card-body" style="padding:0">
          <div class="page-tbl-wrap" style="padding:12px">
            <table class="page-tbl">
              <thead><tr>${thCells}</tr></thead>
              <tbody>
                <tr style="font-size:10px">${faultRow}</tr>
                ${frameRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Insight -->
      <div class="card">
        <div class="card-head"><span class="card-title">Analysis</span></div>
        <div class="card-body">
          <div class="insight-grid">
            <div class="insight-box">
              <strong>Hit Rate</strong>
              ${hitRate}% hit rate (${hits} hits / ${total} total). 
              ${parseFloat(hitRate) >= 50 ? 'Good locality of reference detected.' : 'Low hit rate — consider increasing frame count.'}
            </div>
            <div class="insight-box ${faults > hits ? 'warn' : ''}">
              <strong>Fault Rate</strong>
              ${faultRate}% fault rate (${faults} faults). 
              ${faults > hits
                ? `High fault rate. With ${PAGE_META[currentPageAlgo].label}, adding frames may reduce faults${currentPageAlgo === 'fifo' ? ' (avoid Bélády\'s anomaly)' : ''}.`
                : 'Fault rate is acceptable for this reference pattern.'}
            </div>
          </div>
          <div class="frag-section" style="margin-top:12px">
            <div class="frag-label">
              <span>Hit Rate</span>
              <span style="color:var(--green)">${hitRate}%</span>
            </div>
            <div class="frag-bar">
              <div class="frag-fill" style="width:${hitRate}%;background:var(--green)"></div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  toast(`${PAGE_META[currentPageAlgo].label}: ${faults} faults, ${hits} hits (${hitRate}% hit rate)`,
    parseFloat(hitRate) >= 50 ? 'success' : 'info');
}


/* ─────────────────────────────────────────────────────────────
   8. TAB SWITCHING
───────────────────────────────────────────────────────────── */
function switchTab(id) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('pane-' + id).classList.add('active');
  document.getElementById('tab-' + id).classList.add('active');
}


/* ─────────────────────────────────────────────────────────────
   9. HEADER STATS
───────────────────────────────────────────────────────────── */
function updateHeaderStats(workBlocks) {
  const total = blocks.reduce((s, b) => s + b.size, 0);
  let free = total;
  if (workBlocks) free = workBlocks.reduce((s, b) => s + b.remaining, 0);
  document.getElementById('hdrUsed').textContent = total - free;
  document.getElementById('hdrFree').textContent = free;
}


/* ─────────────────────────────────────────────────────────────
   10. TOAST NOTIFICATIONS
───────────────────────────────────────────────────────────── */
function toast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// Firebase save function for app.js
window.saveSimulationToFirebase = async function() {
  // Show saving toast
  showToast('Saving to Firebase...', 'info');
  
  try {
    // Check if Firebase is ready
    if (!window.__fbReady) {
      showToast('Firebase not connected. Check your configuration.', 'error');
      return;
    }
    
    // Collect current simulation state
    const simulationData = {
      type: 'memory_allocation',
      memoryBlocks: getCurrentMemoryBlocks(),
      processes: getCurrentProcesses(),
      algorithm: document.querySelector('#algoLabel')?.innerText || 'First Fit',
      timestamp: new Date().toLocaleString()
    };
    
    // Save to Firebase
    const docId = await window.__fbSave(simulationData);
    
    if (docId) {
      showToast('✓ Saved to Firebase successfully!', 'success');
      console.log('Saved with ID:', docId);
    } else {
      showToast('Save failed', 'error');
    }
  } catch (error) {
    console.error('Save error:', error);
    showToast('Failed to save to Firebase', 'error');
  }
};

// Helper functions to get current data
function getCurrentMemoryBlocks() {
  const blocks = [];
  const rows = document.querySelectorAll('#blocksBody tr');
  rows.forEach(row => {
    const sizeInput = row.querySelector('input[type="number"]');
    if (sizeInput) {
      blocks.push(parseInt(sizeInput.value));
    }
  });
  return blocks;
}

function getCurrentProcesses() {
  const processes = [];
  const rows = document.querySelectorAll('#procsBody tr');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 2) {
      const sizeInput = cells[1]?.querySelector('input[type="number"]');
      if (sizeInput) {
        processes.push({
          id: cells[0]?.innerText || 'P' + (processes.length + 1),
          size: parseInt(sizeInput.value)
        });
      }
    }
  });
  return processes;
}

// Enhanced Toast notification function (replace your existing toast function)
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    console.log(message);
    return;
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${type === 'error' ? 
          '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' :
          type === 'info' ?
          '<circle cx="12" cy="12" r="10"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/>' :
          '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
        }
      </svg>
      <span>${message}</span>
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 300);
  }, 3000);
}
/* ─────────────────────────────────────────────────────────────
   11. INIT
───────────────────────────────────────────────────────────── */
function init() {
  renderAlgoStrip();
  renderExplain();
  renderBlocks();
  renderProcs();
  renderPageAlgoStrip();
  renderPageExplain();
  updateHeaderStats(null);
}

document.addEventListener('DOMContentLoaded', init);