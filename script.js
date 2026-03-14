const arrayInput = document.getElementById("array-input");
const algorithmSelect = document.getElementById("algorithm-select");
const sortButton = document.getElementById("sort-array-button");
const randomButton = document.getElementById("random-array-generator-button");
const resetButton = document.getElementById("reset-array-button");
const pauseButton = document.getElementById("pause-animation-button");
const slider = document.getElementById("slider");
const speedValueEl = document.getElementById("speed-value");
const vizContainer = document.getElementById("viz-container");

let isSorting = false;
let isPaused = false;
let pauseResolve = null;
let sortAborted = false;

const DEFAULT_PLACEHOLDER = "Enter array elements separated by spaces";
const INVALID_PLACEHOLDER = "Enter numbers only, e.g. 3 1 4 1 5";
const MIN_DELAY_MS = 16;
const MAX_DELAY_MS = 600;

function getArrayFromInput() {
  const raw = arrayInput.value.trim();
  if (!raw) return [];
  const parsed = raw.split(/\s+/).map((s) => Number(s));
  if (parsed.some((n) => Number.isNaN(n))) return null;
  return parsed;
}

function syncInputFromArray(arr) {
  arrayInput.value = arr.join(" ");
}

function clearInput() {
  arrayInput.value = "";
  arrayInput.placeholder = DEFAULT_PLACEHOLDER;
}

function renderBars(arr, sortingState = {}) {
  if (!arr.length || !Array.isArray(arr)) {
    vizContainer.innerHTML = "";
    return;
  }
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  const range = max - min || 1;

  const totalSlots = 26;
  const containerWidth =
    vizContainer.clientWidth || vizContainer.offsetWidth || 520;
  const slotWidth = containerWidth / totalSlots;
  const gap = Math.max(2, Math.round(slotWidth * 0.2));
  const barWidth = Math.max(12, Math.round(slotWidth - gap));
  vizContainer.style.setProperty("--bar-gap", `${gap}px`);
  vizContainer.style.setProperty("--bar-width", `${barWidth}px`);

  vizContainer.innerHTML = arr
    .map((val, index) => {
      const heightPct = 10 + (90 * (val - min)) / range;
      let className = "bar";
      if (sortingState.comparing && sortingState.comparing.includes(index)) {
        className += " comparing";
      }
      if (sortingState.swapping && sortingState.swapping.includes(index)) {
        className += " swapping";
      }
      if (sortingState.pivot === index) {
        className += " pivot";
      }
      if (sortingState.sorted && sortingState.sorted.includes(index))
        className += " sorted";
      return `<div class="${className}" style="height: ${heightPct}%" data-index="${index}"><span class="bar-value">${val}</span></div>`;
    })
    .join("");
}

function refreshVizFromInput() {
  if (isSorting) return;
  const arr = getArrayFromInput();
  if (arr === null) {
    arrayInput.placeholder = INVALID_PLACEHOLDER;
    vizContainer.innerHTML = "";
    return;
  }
  if (arr.length === 0) {
    vizContainer.innerHTML = "";
    return;
  }
  renderBars(arr);
}

function getSpeedDelayMs() {
  const speedRaw = Number(slider.value);
  const speed = Number.isFinite(speedRaw)
    ? Math.min(100, Math.max(0, speedRaw))
    : 50;
  const normalized = speed / 100;
  const eased = normalized * normalized;
  return Math.round(MAX_DELAY_MS - eased * (MAX_DELAY_MS - MIN_DELAY_MS));
}

function updateSpeedLabel() {
  speedValueEl.textContent = String(slider.value);
}

function setPauseButtonState() {
  const label = pauseButton.querySelector(".btn-label");
  if (label) label.textContent = isPaused ? "Resume" : "Pause";
}

function waitForResume() {
  if (!isPaused) return Promise.resolve();
  return new Promise((r) => {
    pauseResolve = r;
  });
}

function setControlsEnabled(enabled) {
  arrayInput.disabled = !enabled;
  algorithmSelect.disabled = !enabled;
  sortButton.disabled = !enabled;
  randomButton.disabled = !enabled;
  resetButton.disabled = false;
  slider.disabled = false;
  pauseButton.disabled = enabled;
  if (enabled) {
    isPaused = false;
    if (pauseResolve) pauseResolve();
    pauseResolve = null;
    setPauseButtonState();
  }
}

function generateRandomArray() {
  const minBars = 12;
  const maxBars = 20;
  const len = minBars + Math.floor(Math.random() * (maxBars - minBars + 1));
  const arr = Array.from(
    { length: len },
    () => 5 + Math.floor(Math.random() * 96),
  );
  syncInputFromArray(arr);
  renderBars(arr);
}

function resetArray() {
  if (isSorting) {
    sortAborted = true;
    isPaused = false;
    if (pauseResolve) {
      pauseResolve();
      pauseResolve = null;
    }
    setPauseButtonState();
    return;
  }
  clearInput();
  vizContainer.innerHTML = "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitAnimationStep() {
  await sleep(getSpeedDelayMs());
  await waitForResume();
}

function finishSort(aborted, sortedArray) {
  if (aborted) {
    clearInput();
    vizContainer.innerHTML = "";
  } else {
    renderBars(sortedArray, { sorted: sortedArray.map((_, i) => i) });
    syncInputFromArray(sortedArray);
  }
  isSorting = false;
  setControlsEnabled(true);
}

async function runBubbleSort() {
  const arr = getArrayFromInput();
  if (arr === null || arr.length === 0 || !Array.isArray(arr)) return;

  isSorting = true;
  isPaused = false;
  sortAborted = false;
  setControlsEnabled(false);
  pauseButton.disabled = false;
  setPauseButtonState();

  const a = [...arr];
  const n = a.length;

  for (let end = n - 1; end > 0 && !sortAborted; end--) {
    for (let i = 0; i < end && !sortAborted; i++) {
      renderBars(a, { comparing: [i, i + 1] });
      await waitAnimationStep();
      if (sortAborted) break;

      if (a[i] > a[i + 1]) {
        [a[i], a[i + 1]] = [a[i + 1], a[i]];
        renderBars(a, { swapping: [i, i + 1] });
        await waitAnimationStep();
        if (sortAborted) break;
      }
    }
    if (sortAborted) break;
    const sortedSoFar = Array.from({ length: n - end }, (_, j) => end + j);
    renderBars(a, { sorted: sortedSoFar });
    await waitAnimationStep();
  }

  finishSort(sortAborted, a);
}

async function runSelectionSort() {
  const arr = getArrayFromInput();
  if (arr === null || arr.length === 0 || !Array.isArray(arr)) return;

  isSorting = true;
  isPaused = false;
  sortAborted = false;
  setControlsEnabled(false);
  pauseButton.disabled = false;
  setPauseButtonState();

  const a = [...arr];
  const n = a.length;

  for (let i = 0; i < n - 1 && !sortAborted; i++) {
    let minIdx = i;

    for (let j = i + 1; j < n && !sortAborted; j++) {
      renderBars(a, {
        comparing: [minIdx, j],
        sorted: Array.from({ length: i }, (_, k) => k),
      });
      await waitAnimationStep();
      if (sortAborted) break;

      if (a[j] < a[minIdx]) {
        minIdx = j;
      }
    }

    if (sortAborted) break;

    if (minIdx !== i) {
      [a[i], a[minIdx]] = [a[minIdx], a[i]];
      renderBars(a, {
        swapping: [i, minIdx],
        sorted: Array.from({ length: i }, (_, k) => k),
      });
      await waitAnimationStep();
      if (sortAborted) break;
    }

    renderBars(a, { sorted: Array.from({ length: i + 1 }, (_, k) => k) });
    await waitAnimationStep();
  }

  finishSort(sortAborted, a);
}

async function runInsertionSort() {
  const arr = getArrayFromInput();
  if (arr === null || arr.length === 0 || !Array.isArray(arr)) return;

  isSorting = true;
  isPaused = false;
  sortAborted = false;
  setControlsEnabled(false);
  pauseButton.disabled = false;
  setPauseButtonState();

  const a = [...arr];
  const n = a.length;

  for (let i = 1; i < n && !sortAborted; i++) {
    const key = a[i];
    let j = i - 1;

    renderBars(a, {
      comparing: [j, i],
      sorted: Array.from({ length: i }, (_, k) => k),
    });
    await waitAnimationStep();
    if (sortAborted) break;

    while (j >= 0 && a[j] > key && !sortAborted) {
      a[j + 1] = a[j];
      renderBars(a, {
        swapping: [j, j + 1],
        sorted: Array.from({ length: i }, (_, k) => k),
      });
      await waitAnimationStep();
      j--;
    }

    if (sortAborted) break;

    a[j + 1] = key;
    renderBars(a, {
      comparing: [j + 1, i],
      sorted: Array.from({ length: i + 1 }, (_, k) => k),
    });
    await waitAnimationStep();
  }

  finishSort(sortAborted, a);
}

async function runMergeSort() {
  const arr = getArrayFromInput();
  if (arr === null || arr.length === 0 || !Array.isArray(arr)) return;

  isSorting = true;
  isPaused = false;
  sortAborted = false;
  setControlsEnabled(false);
  pauseButton.disabled = false;
  setPauseButtonState();

  const a = [...arr];

  async function waitStep(state) {
    renderBars(a, state);
    await waitAnimationStep();
  }

  async function merge(lo, mid, hi) {
    const left = a.slice(lo, mid + 1);
    const right = a.slice(mid + 1, hi + 1);

    let i = 0;
    let j = 0;
    let k = lo;

    while (i < left.length && j < right.length && !sortAborted) {
      await waitStep({ comparing: [lo + i, mid + 1 + j] });
      if (sortAborted) return;

      if (left[i] <= right[j]) {
        a[k] = left[i];
        i++;
      } else {
        a[k] = right[j];
        j++;
      }

      await waitStep({ swapping: [k] });
      if (sortAborted) return;
      k++;
    }

    while (i < left.length && !sortAborted) {
      a[k] = left[i];
      i++;
      await waitStep({ swapping: [k] });
      if (sortAborted) return;
      k++;
    }

    while (j < right.length && !sortAborted) {
      a[k] = right[j];
      j++;
      await waitStep({ swapping: [k] });
      if (sortAborted) return;
      k++;
    }
  }

  async function mergeSort(lo, hi) {
    if (lo >= hi || sortAborted) return;

    const mid = Math.floor((lo + hi) / 2);
    await mergeSort(lo, mid);
    await mergeSort(mid + 1, hi);
    if (sortAborted) return;

    await merge(lo, mid, hi);
  }

  await mergeSort(0, a.length - 1);
  finishSort(sortAborted, a);
}

async function runQuickSort() {
  const arr = getArrayFromInput();
  if (arr === null || arr.length === 0 || !Array.isArray(arr)) return;

  isSorting = true;
  isPaused = false;
  sortAborted = false;
  setControlsEnabled(false);
  pauseButton.disabled = false;
  setPauseButtonState();

  const a = [...arr];

  async function waitStep(state) {
    renderBars(a, state);
    await waitAnimationStep();
  }

  async function partition(low, high) {
    const pivot = a[high];
    let i = low - 1;

    for (let j = low; j < high && !sortAborted; j++) {
      await waitStep({ comparing: [j], pivot: high });
      if (sortAborted) return low;

      if (a[j] < pivot) {
        i++;
        [a[i], a[j]] = [a[j], a[i]];
        await waitStep({ swapping: [i, j], pivot: high });
        if (sortAborted) return i;
      }
    }

    [a[i + 1], a[high]] = [a[high], a[i + 1]];
    await waitStep({ swapping: [i + 1, high] });
    return i + 1;
  }

  async function quickSort(low, high) {
    if (low < high && !sortAborted) {
      const pi = await partition(low, high);
      if (sortAborted) return;

      await quickSort(low, pi - 1);
      await quickSort(pi + 1, high);
    }
  }

  await quickSort(0, a.length - 1);
  finishSort(sortAborted, a);
}

async function runSelectedSort() {
  if (isSorting) return;

  const sortHandlers = {
    bubble: runBubbleSort,
    selection: runSelectionSort,
    insertion: runInsertionSort,
    merge: runMergeSort,
    quick: runQuickSort,
  };

  const selectedHandler = sortHandlers[algorithmSelect.value];
  if (selectedHandler) {
    await selectedHandler();
  }
}

slider.addEventListener("input", updateSpeedLabel);

randomButton.addEventListener("click", () => {
  if (!isSorting) generateRandomArray();
});

resetButton.addEventListener("click", resetArray);

sortButton.addEventListener("click", runSelectedSort);

pauseButton.addEventListener("click", () => {
  if (!isSorting) return;
  isPaused = !isPaused;
  setPauseButtonState();
  if (!isPaused && pauseResolve) {
    pauseResolve();
    pauseResolve = null;
  }
});

arrayInput.addEventListener("input", refreshVizFromInput);

updateSpeedLabel();
resetArray();
