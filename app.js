// app.js
import { drawLossCurvePlotly, drawScatterPlotPlotly, drawWrightMap, exportPlotPNG, downloadBlob } from './charts.js';

const $ = (s) => document.querySelector(s);

// ---------- i18n ----------
let currentLang = localStorage.getItem('gradecast_lang') || 'en';
const langSelect = $('#langSelect');
if (langSelect) {
  langSelect.value = currentLang;
  document.documentElement.lang = currentLang;
  function applyI18n() {
    const t = (typeof translations !== 'undefined' && translations[currentLang]) 
              ? translations[currentLang] 
              : (typeof translations !== 'undefined' && translations.en) 
                ? translations.en 
                : {};
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (t[k]) el.textContent = t[k];
    });
    document.querySelectorAll('option[data-i18n]').forEach(opt => {
      const k = opt.getAttribute('data-i18n');
      if (t[k]) opt.textContent = t[k];
    });
  }
  document.addEventListener('DOMContentLoaded', applyI18n);
  langSelect.addEventListener('change', () => {
    currentLang = langSelect.value;
    localStorage.setItem('gradecast_lang', currentLang);
    document.documentElement.lang = currentLang;
    if (typeof translations !== 'undefined') applyI18n();
  });
}

// ---------- elements ----------
const itemFileInput = $('#itemFile');
const scoreFileInput = $('#scoreFile');
const predictFileInput = $('#predictItemFile');

const itemMapDiv = $('#itemMapping');
const itemIdSelect = $('#itemIdSelect');

const scoreMapDiv = $('#scoreMapping');
const studentIdSelect = $('#studentIdSelect');
const scoreFormatSelect = $('#scoreFormatSelect');
const scoreItemIdSelect = $('#scoreItemIdSelect');
const scoreValueSelect = $('#scoreValueSelect');
const wideItemColsSelect = $('#wideItemColsSelect');

const featureListDiv = $('#featureList');

const batchSizeInput = $('#batchSizeInput');
const learningRateInput = $('#learningRateInput');
const epochsInput = $('#epochsInput');
const layersBox = $('#layersBox');
const addLayerBtn = $('#addLayerBtn');

const validationList = $('#validationList');
const addValidationBtn = $('#addValidationBtn');

const startBtn = $('#startBtn');
const progressSection = $('#progressSection');
const progressText = $('#progressText');
const progressBar = $('#progressBar');

const resultsContainer = $('#resultsContainer');
const exportTestBtn = $('#exportTestBtn');

const predictBtn = $('#predictBtn');
const exportPredictBtn = $('#exportPredictBtn');
const predictResultsDiv = $('#predictResults');

const irtModelSelect = $('#irtModelSelect');
const exportIRTBtn = $('#exportIRTBtn');
const irtSummary = document.getElementById('irtSummary');
const irtTableWrap = document.getElementById('irtTableWrap');

const itemStatus = document.getElementById('itemStatus');
const scoreStatus = document.getElementById('scoreStatus');

// ---------- state ----------
let itemRows = [], itemHeaders = [];
let scoreRows = [], scoreHeaders = [];
let selectedFeatures = []; // [{name, type:'categorical'|'numeric', use:true}]
let dicts = null;          // one-hot encoding dictionaries for categorical features
let inputDim = 0;

let trainedModels = [];    // [{config, model, metrics, dicts, testRows: [{student,item,actual,pred}], best: boolean}]
let bestModelIndex = -1;

// ---------- helpers ----------
function fillSelectOptions(selectEl, options, placeholder) {
  selectEl.innerHTML = '';
  if (placeholder) {
    const ph = document.createElement('option');
    ph.value = ''; 
    ph.textContent = placeholder;
    selectEl.appendChild(ph);
  }
  options.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    selectEl.appendChild(opt);
  });
}
function fillMultiSelect(selectEl, options) {
  selectEl.innerHTML = '';
  options.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    selectEl.appendChild(opt);
  });
}
function parseCSV(file, onComplete, onError) {
  Papa.parse(file, {
    header: true, dynamicTyping: true, skipEmptyLines: true,
    complete: (res) => {
      if (res.errors && res.errors.length) {
        console.error(res.errors);
        if (onError) onError(res.errors[0].message || 'Unknown');
      } else {
        onComplete(res.meta.fields || [], res.data || []);
      }
    }
  });
}
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

let itemLoaded = false, scoreLoaded = false;
function handleCSV(file, type) {
  const tgt = (type === 'item') ? itemStatus : scoreStatus;
  tgt.textContent = '⏳';
  tgt.className = 'ml-2 text-yellow-300 align-middle';
  parseCSV(file, (headers, rows) => {
    tgt.textContent = '✅';
    tgt.className = 'ml-2 text-green-400 align-middle';
    if (type === 'item') {
      itemHeaders = headers;
      itemRows = rows;
      itemLoaded = true;
      $('#itemFileName').textContent = file.name;
      fillSelectOptions(itemIdSelect, headers);
      show(itemMapDiv);
      buildFeatureCards(headers);
    } else {
      scoreHeaders = headers;
      scoreRows = rows;
      scoreLoaded = true;
      $('#scoreFileName').textContent = file.name;
      fillSelectOptions(studentIdSelect, headers);
      fillSelectOptions(scoreItemIdSelect, headers);
      fillSelectOptions(scoreValueSelect, headers);
      fillMultiSelect(wideItemColsSelect, headers);
      show(scoreMapDiv);
    }
    console.info(`[${type}] CSV parsed:`, rows.length, 'rows');
    unlockSections();
  }, (errMsg) => {
    tgt.textContent = '❌';
    tgt.className = 'ml-2 text-red-500 align-middle';
    alert('CSV parse error: ' + errMsg);
  });
}
itemFileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) handleCSV(f, 'item');
});
scoreFileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) handleCSV(f, 'score');
});

function unlockSections() {
  if (itemLoaded && scoreLoaded) {
    ['features', 'config', 'train', 'results', 'predict', 'irt'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('opacity-50', 'pointer-events-none');
    });
  }
}

// ---------- Feature selection UI ----------
function buildFeatureCards(headers) {
  const t = (typeof translations !== 'undefined' && translations[currentLang]) 
            ? translations[currentLang] 
            : (typeof translations !== 'undefined' && translations.en) 
              ? translations.en 
              : {};
  featureListDiv.innerHTML = '';
  selectedFeatures = [];
  headers.forEach(h => {
    if (h === itemIdSelect.value) return; // skip the ItemID column
    const card = document.createElement('div');
    card.className = 'p-3 border border-gray-700 rounded';
    card.innerHTML = `
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" class="featUse" checked>
        <span>${h}</span>
      </label>
      <div class="mt-2 text-sm">
        <label class="mr-3">
          <input type="radio" name="enc_${h}" value="categorical" checked>
          <span>categorical</span>
        </label>
        <label>
          <input type="radio" name="enc_${h}" value="numeric">
          <span>numeric</span>
        </label>
      </div>`;
    featureListDiv.appendChild(card);
    selectedFeatures.push({ name: h, type: 'categorical', use: true });
    const useEl = card.querySelector('.featUse');
    useEl.addEventListener('change', () => {
      const feat = selectedFeatures.find(x => x.name === h);
      if (feat) feat.use = useEl.checked;
    });
    card.querySelectorAll(`input[name="enc_${h}"]`).forEach(r => {
      r.addEventListener('change', () => {
        const feat = selectedFeatures.find(x => x.name === h);
        if (feat) feat.type = r.value;
      });
    });
  });
}
// Rebuild feature list if user changes which column is Item ID
itemIdSelect.addEventListener('change', () => {
  if (itemHeaders.length) buildFeatureCards(itemHeaders);
});

// ---------- Layers (hidden layers configuration) ----------
function addLayerRow(units = 16, act = 'relu') {
  const row = document.createElement('div');
  row.className = 'flex items-center gap-2';
  row.innerHTML = `
    <label class="text-sm flex-1">
      <span>Units</span>
      <input type="number" class="units w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 mt-1" value="${units}" min="1"/>
    </label>
    <label class="text-sm flex-1">
      <span>Activation</span>
      <select class="act w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 mt-1">
        <option value="relu">ReLU</option>
        <option value="tanh">Tanh</option>
        <option value="sigmoid">Sigmoid</option>
      </select>
    </label>
    <button type="button" class="del bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-sm">-</button>
  `;
  row.querySelector('.act').value = act;
  row.querySelector('.del').addEventListener('click', () => row.remove());
  layersBox.appendChild(row);
}
addLayerBtn.addEventListener('click', () => addLayerRow());
addLayerRow(32, 'tanh'); // default layers
addLayerRow(16, 'relu');

// ---------- Validation blocks (multiple validation configs) ----------
const valTemplate = validationList.firstElementChild.cloneNode(true);
addValidationBtn.addEventListener('click', () => {
  const b = valTemplate.cloneNode(true);
  const close = document.createElement('button');
  close.textContent = '×';
  close.className = 'absClose absolute top-2 right-2 text-gray-400 hover:text-red-500';
  b.appendChild(close);
  close.addEventListener('click', () => b.remove());
  const methodSel = b.querySelector('.methodSelect');
  const ratioInput = b.querySelector('.ratioInput');
  methodSel.addEventListener('change', () => {
    const isLOO = methodSel.value === 'loocv';
    ratioInput.disabled = isLOO;
    ratioInput.classList.toggle('opacity-50', isLOO);
  });
  validationList.appendChild(b);
});
(function initFirstVal() {
  const box = validationList.firstElementChild;
  const methodSel = box.querySelector('.methodSelect');
  const ratioInput = box.querySelector('.ratioInput');
  methodSel.addEventListener('change', () => {
    const isLOO = methodSel.value === 'loocv';
    ratioInput.disabled = isLOO;
    ratioInput.classList.toggle('opacity-50', isLOO);
  });
})();

// ---------- Build samples + encoder preparation ----------
function buildSamples() {
  if (itemRows.length === 0 || scoreRows.length === 0) {
    alert((typeof translations !== 'undefined' && translations[currentLang]?.needUpload) || 'Please upload both CSVs first.');
    return null;
  }
  const itemIdCol = itemIdSelect.value;
  if (!itemIdCol) {
    alert((typeof translations !== 'undefined' && translations[currentLang]?.chooseItemMapping) || 'Please map ItemID.');
    return null;
  }
  // Selected features for ANN input
  const features = selectedFeatures.filter(f => f.use);
  if (features.length === 0) {
    alert('Select at least one feature.');
    return null;
  }
  // Create map of itemID -> feature values
  const itemById = new Map();
  itemRows.forEach(r => {
    const id = r[itemIdCol];
    if (id == null) return;
    const featObj = {};
    features.forEach(f => { featObj[f.name] = r[f.name]; });
    itemById.set(id, featObj);
  });
  // Determine score data format
  const fmt = scoreFormatSelect.value;
  const studentCol = studentIdSelect.value;
  if (!studentCol) {
    alert((typeof translations !== 'undefined' && translations[currentLang]?.chooseStudentCol) || 'Choose StudentID.');
    return null;
  }
  const sampleRows = []; // each entry: {student, item, feat, score}
  if (fmt === 'long') {
    const itCol = scoreItemIdSelect.value;
    const scCol = scoreValueSelect.value;
    if (!itCol || !scCol) {
      alert((typeof translations !== 'undefined' && translations[currentLang]?.chooseLongCols) || 'Choose ItemID & Score.');
      return null;
    }
    scoreRows.forEach(r => {
      const sid = r[studentCol], iid = r[itCol], sc = r[scCol];
      if (sid == null || iid == null || sc == null) return;
      const feat = itemById.get(iid);
      if (!feat) return;
      sampleRows.push({ student: sid, item: iid, feat: feat, score: Number(sc) });
    });
  } else { // wide format
    const itemCols = Array.from(wideItemColsSelect.selectedOptions).map(o => o.value);
    if (itemCols.length === 0) {
      alert((typeof translations !== 'undefined' && translations[currentLang]?.chooseWideCols) || 'Choose item columns.');
      return null;
    }
    scoreRows.forEach(r => {
      const sid = r[studentCol];
      itemCols.forEach(col => {
        if (r[col] == null || r[col] === '') return;
        const iid = col, sc = r[col];
        const feat = itemById.get(iid);
        if (!feat) return;
        sampleRows.push({ student: sid, item: iid, feat: feat, score: Number(sc) });
      });
    });
  }
  if (sampleRows.length === 0) {
    alert((typeof translations !== 'undefined' && translations[currentLang]?.noValidSamples) || 'No valid samples.');
    return null;
  }
  // Build one-hot dictionaries for categorical features and list of students
  dicts = {};
  features.forEach(f => {
    if (f.type === 'categorical') {
      dicts[f.name] = [];
    }
  });
  dicts['__student__'] = [];
  sampleRows.forEach(s => {
    features.forEach(f => {
      if (f.type === 'categorical') {
        const v = s.feat[f.name];
        if (!dicts[f.name].includes(v)) dicts[f.name].push(v);
      }
    });
    if (!dicts['__student__'].includes(s.student)) {
      dicts['__student__'].push(s.student);
    }
  });
  // Determine input vector length (inputDim)
  inputDim = Object.entries(dicts).reduce((acc, [k, arr]) => acc + arr.length, 0) 
             + features.filter(f => f.type === 'numeric').length;
  function encodeX(s) {
    const vec = new Array(inputDim).fill(0);
    let offset = 0;
    // categorical features one-hot encoding
    for (const [k, arr] of Object.entries(dicts)) {
      const val = (k === '__student__') ? s.student : s.feat[k];
      const i = arr.indexOf(val);
      if (i >= 0) vec[offset + i] = 1;
      offset += arr.length;
    }
    // numeric features (no normalization here)
    features.filter(f => f.type === 'numeric').forEach(f => {
      const val = Number(s.feat[f.name]) || 0;
      vec[offset++] = val;
    });
    return vec;
  }
  const X = [], y = [];
  sampleRows.forEach(s => {
    X.push(encodeX(s));
    y.push([s.score]);
  });
  return { X, y, sampleRows, features };
}

// ---------- Training process ----------
startBtn.addEventListener('click', async () => {
  const built = buildSamples();
  if (!built) return;
  const { X, y, sampleRows } = built;
  // Gather validation configs
  const configs = [];
  validationList.querySelectorAll('.relative').forEach(box => {
    const method = box.querySelector('.methodSelect').value;
    const ratio = Number(box.querySelector('.ratioInput').value || 80) / 100;
    configs.push({ method, ratio });
  });
  if (configs.length === 0) {
    alert((typeof translations !== 'undefined' && translations[currentLang]?.noValidationAlert) || 'Add validation');
    return;
  }
  // Gather hidden layer definitions
  const layers = [];
  layersBox.querySelectorAll('.flex.items-center').forEach(row => {
    const units = Number(row.querySelector('.units').value) || 16;
    const act = row.querySelector('.act').value || 'relu';
    layers.push({ units, act });
  });
  const epochs = Number(epochsInput.value) || 120;
  const bs = Number(batchSizeInput.value) || 32;
  const lr = Number(learningRateInput.value) || 0.001;
  // Start training runs
  resultsContainer.innerHTML = '';
  trainedModels = [];
  bestModelIndex = -1;
  let best = Infinity;
  progressBar.style.width = '0%';
  show(progressSection);
  startBtn.disabled = true;
  for (let i = 0; i < configs.length; i++) {
    const { method, ratio } = configs[i];
    progressText.textContent = ((typeof translations !== 'undefined' && translations[currentLang]?.progressTraining) || 'Training (Run {current}/{total}) - {method}')
      .replace('{current}', i + 1).replace('{total}', configs.length).replace('{method}', method.toUpperCase());
    // Split indices for train/test
    let idx = [...Array(X.length).keys()];
    tf.util.shuffle(idx);
    let trainIdx, testIdx;
    if (method === 'holdout') {
      const nTr = Math.max(1, Math.floor(idx.length * ratio));
      trainIdx = idx.slice(0, nTr);
      testIdx = idx.slice(nTr);
      if (testIdx.length === 0) {
        // ensure at least one test sample
        testIdx = idx.slice(-1);
        trainIdx = idx.slice(0, idx.length - 1);
      }
    } else {
      trainIdx = idx; // LOOCV uses all for training for each iteration
    }
    // Build model architecture
    const model = tf.sequential();
    if (layers.length === 0) layers.push({ units: 16, act: 'relu' }); // default if none
    model.add(tf.layers.dense({ inputShape: [inputDim], units: layers[0].units, activation: layers[0].act }));
    for (let L = 1; L < layers.length; L++) {
      model.add(tf.layers.dense({ units: layers[L].units, activation: layers[L].act }));
    }
    model.add(tf.layers.dense({ units: 1, activation: 'linear' }));
    model.compile({ optimizer: tf.train.adam(lr), loss: 'meanSquaredError' });
    let metrics, cardTestRows = [];
    if (method === 'holdout') {
      // Holdout validation
      const Xtr = tf.tensor2d(trainIdx.map(k => X[k]));
      const Ytr = tf.tensor2d(trainIdx.map(k => y[k]));
      const Xte = tf.tensor2d(testIdx.map(k => X[k]));
      const Yte = tf.tensor2d(testIdx.map(k => y[k]));
      const histLoss = [], histVal = [];
      await model.fit(Xtr, Ytr, {
        epochs: epochs,
        batchSize: bs,
        shuffle: true,
        validationData: [Xte, Yte],
        callbacks: { 
          onEpochEnd: (ep, logs) => {
            histLoss.push(logs.loss);
            if (logs.val_loss != null) histVal.push(logs.val_loss);
            progressBar.style.width = Math.round((ep + 1) / epochs * 100) + '%';
            progressText.textContent = ((typeof translations !== 'undefined' && translations[currentLang]?.progressEpoch) || 'Run {current}/{total} - Epoch {epoch}/{epochs}')
              .replace('{current}', i + 1).replace('{total}', configs.length)
              .replace('{epoch}', ep + 1).replace('{epochs}', epochs);
          }
        }
      });
      const predT = model.predict(Xte);
      const pred = Array.from(predT.dataSync());
      const actual = Array.from(Yte.dataSync());
      metrics = computeMetrics(actual, pred);
      // Collect test results for export
      cardTestRows = testIdx.map((k, idx2) => ({
        student: sampleRows[k].student,
        item: sampleRows[k].item,
        actual: actual[idx2],
        pred: pred[idx2]
      }));
      renderResultCard({ method, ratio, metrics, histLoss, histVal, actual, pred });
      Xtr.dispose(); Ytr.dispose(); Xte.dispose(); Yte.dispose(); predT.dispose();
    } else {
      // LOOCV validation
      const preds = [], acts = [];
      for (let k = 0; k < X.length; k++) {
        const trainX = tf.tensor2d(X.filter((_, j) => j !== k));
        const trainY = tf.tensor2d(y.filter((_, j) => j !== k));
        const testX = tf.tensor2d([ X[k] ]);
        const localModel = tf.sequential();
        localModel.add(tf.layers.dense({ inputShape: [inputDim], units: layers[0].units, activation: layers[0].act }));
        for (let L = 1; L < layers.length; L++) {
          localModel.add(tf.layers.dense({ units: layers[L].units, activation: layers[L].act }));
        }
        localModel.add(tf.layers.dense({ units: 1, activation: 'linear' }));
        localModel.compile({ optimizer: tf.train.adam(lr), loss: 'meanSquaredError' });
        await localModel.fit(trainX, trainY, {
          epochs: epochs,
          batchSize: Math.min(bs, X.length - 1),
          shuffle: true
        });
        const p = localModel.predict(testX).dataSync()[0];
        preds.push(p);
        acts.push(y[k][0]);
        trainX.dispose(); trainY.dispose(); testX.dispose(); localModel.dispose();
        progressBar.style.width = Math.round((k + 1) / X.length * 100) + '%';
        progressText.textContent = ((typeof translations !== 'undefined' && translations[currentLang]?.progressLOOCV) || 'Run {current}/{total} - Processed {done}/{totalSamples} samples')
          .replace('{current}', i + 1).replace('{total}', configs.length)
          .replace('{done}', k + 1).replace('{totalSamples}', X.length);
      }
      metrics = computeMetrics(acts, preds);
      renderResultCard({ method, ratio, metrics, histLoss: [], histVal: [], actual: acts, pred: preds });
      // For LOOCV, we do not keep a trained model (each fold had its own model)
    }
    // Store model results
    trainedModels.push({
      config: { method, ratio },
      model: (method === 'holdout' ? model : null),
      metrics: metrics,
      dicts: dicts,
      testRows: cardTestRows
    });
    if (metrics.RMSE < best) {
      best = metrics.RMSE;
      bestModelIndex = trainedModels.length - 1;
    }
  }
  progressText.textContent = (typeof translations !== 'undefined' && translations[currentLang]?.progressComplete) || 'Training complete';
  setTimeout(() => hide(progressSection), 800);
  startBtn.disabled = false;
});

// ---------- Metrics calculation & result rendering ----------
function computeMetrics(actual, pred) {
  const n = actual.length;
  let mae = 0, mse = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    const e = pred[i] - actual[i];
    mae += Math.abs(e);
    mse += e * e;
    sumY += actual[i];
  }
  mae /= n;
  mse /= n;
  const rmse = Math.sqrt(mse);
  const meanY = sumY / n;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    const d = actual[i] - meanY;
    sst += d * d;
  }
  const r2 = sst > 0 ? 1 - (mse * n) / sst : 1;
  return { MAE: +mae.toFixed(3), MSE: +mse.toFixed(3), RMSE: +rmse.toFixed(3), R2: +r2.toFixed(3) };
}
function renderResultCard({ method, ratio, metrics, histLoss, histVal, actual, pred }) {
  const t = (typeof translations !== 'undefined' && translations[currentLang]) 
            ? translations[currentLang] 
            : (typeof translations !== 'undefined' && translations.en) 
              ? translations.en 
              : {};
  const card = document.createElement('div');
  card.className = 'p-4 bg-gray-800 border border-gray-700 rounded';
  const title = document.createElement('h3');
  title.className = 'font-semibold mb-2';
  if (method === 'holdout') {
    title.textContent = (t.resultHoldout || 'Holdout (Training {trainPct}% / Testing {testPct}%)')
      .replace('{trainPct}', Math.round(ratio * 100))
      .replace('{testPct}', 100 - Math.round(ratio * 100));
  } else {
    title.textContent = t.resultLoocv || 'LOOCV';
  }
  card.appendChild(title);
  const ul = document.createElement('ul');
  ['MAE','MSE','RMSE','R2'].forEach(k => {
    const li = document.createElement('li');
    li.textContent = (t[k] || k) + ': ' + metrics[k];
    ul.appendChild(li);
  });
  card.appendChild(ul);
  if (histLoss && histLoss.length) {
    const lossDiv = document.createElement('div');
    lossDiv.style.height = '220px';
    card.appendChild(lossDiv);
    drawLossCurvePlotly(lossDiv, histLoss, histVal, t);
  }
  if (actual && actual.length) {
    const scDiv = document.createElement('div');
    scDiv.style.height = '260px';
    card.appendChild(scDiv);
    drawScatterPlotPlotly(scDiv, actual, pred, t);
  }
  resultsContainer.appendChild(card);
}

// ---------- Export Test Predictions CSV ----------
exportTestBtn.addEventListener('click', () => {
  const rows = [];
  trainedModels.forEach((m, idx) => {
    if (!m.testRows || !m.testRows.length) return;
    m.testRows.forEach(r => {
      rows.push({ run: idx + 1, student: r.student, item: r.item, actual: r.actual, pred: r.pred });
    });
  });
  if (!rows.length) {
    alert('No test predictions to export (use Holdout).');
    return;
  }
  const csv = Papa.unparse(rows);
  const blob = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  downloadBlob(blob, 'test_predictions.csv');
});

// ---------- Prediction on new items ----------
let lastPredictRows = [];
predictBtn.addEventListener('click', () => {
  const bestModel = trainedModels[bestModelIndex];
  if (!bestModel || !bestModel.model) {
    alert((typeof translations !== 'undefined' && translations[currentLang]?.trainFirst) || 'Train (holdout) first.');
    return;
  }
  const file = predictFileInput.files[0];
  if (!file) {
    alert((typeof translations !== 'undefined' && translations[currentLang]?.choosePredictFile) || 'Upload predict CSV');
    return;
  }
  parseCSV(file, (headers, rows) => {
    const itemIdCol = itemIdSelect.value;
    const features = selectedFeatures.filter(f => f.use);
    const dictsLocal = bestModel.dicts;
    const inputDimLocal = inputDim;
    function encode(featObj, studentId) {
      const vec = new Array(inputDimLocal).fill(0);
      let offset = 0;
      for (const [k, arr] of Object.entries(dictsLocal)) {
        const val = (k === '__student__') ? studentId : featObj[k];
        const i = arr.indexOf(val);
        if (i >= 0) vec[offset + i] = 1;
        offset += arr.length;
      }
      features.filter(f => f.type === 'numeric').forEach(f => {
        vec[offset++] = Number(featObj[f.name]) || 0;
      });
      return vec;
    }
    const students = dictsLocal['__student__'] || [];
    const model = bestModel.model;
    const predicts = [];
    rows.forEach(r => {
      const iid = r[itemIdCol];
      if (iid == null) return;
      const feat = {};
      features.forEach(f => { feat[f.name] = r[f.name]; });
      students.forEach(sid => {
        const x = encode(feat, sid);
        const p = model.predict(tf.tensor2d([x])).dataSync()[0];
        predicts.push({ student: sid, item: iid, pred: p });
      });
    });
    lastPredictRows = predicts;
    // Quick preview of predictions
    predictResultsDiv.innerHTML = '';
    const info = document.createElement('div');
    info.className = 'text-sm text-gray-300';
    info.textContent = ((typeof translations !== 'undefined' && translations[currentLang]?.predictSummary) || 'Predicted pairs') + ': ' + predicts.length;
    predictResultsDiv.appendChild(info);
    const tbl = document.createElement('table');
    tbl.className = 'mt-2 w-full text-sm';
    tbl.innerHTML = '<thead><tr><th class="text-left">Student</th><th class="text-left">Item</th><th class="text-left">Pred</th></tr></thead><tbody></tbody>';
    const tb = tbl.querySelector('tbody');
    predicts.slice(0, 100).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.student}</td><td>${r.item}</td><td>${r.pred.toFixed(3)}</td>`;
      tb.appendChild(tr);
    });
    predictResultsDiv.appendChild(tbl);
    // Run IRT calibration on predicted student-item pairs
    runIRT_JML_fromPairs_poly(predicts);
  }, (errMsg) => {
    alert('CSV parse error: ' + errMsg);
  });
});
exportPredictBtn.addEventListener('click', () => {
  if (!lastPredictRows.length) {
    alert('No predictions yet.');
    return;
  }
  const csv = Papa.unparse(lastPredictRows);
  const blob = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  downloadBlob(blob, 'predictions.csv');
});

// ---------- IRT calibration (JML for PCM/RSM) ----------
function categoryProbs(theta, beta, deltaArr, m, model) {
  const s = [];
  for (let k = 0; k <= m; k++) {
    let logit = k * (theta - beta);
    if (k > 0) {
      const sumDelta = deltaArr.slice(0, k).reduce((a, x) => a + x, 0);
      logit -= sumDelta;
    }
    s[k] = Math.exp(logit);
  }
  const Z = s.reduce((a, x) => a + x, 0);
  return s.map(x => x / Z);
}
function phiCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  const p = 1 - d * (0.319381530*t - 0.356563782*t**2 + 1.781477937*t**3 - 1.821255978*t**4 + 1.330274429*t**5);
  return z >= 0 ? p : 1 - p;
}
function runIRT_JML_fromPairs_poly(pairs) {
  const modelType = irtModelSelect.value; // 'pcm' or 'rsm'
  const students = [...new Set(pairs.map(p => p.student))];
  const items = [...new Set(pairs.map(p => p.item))];
  // Determine maximum score (steps) for each item
  const stepsByItem = {};
  items.forEach(it => {
    stepsByItem[it] = Math.max(...pairs.filter(p => p.item === it).map(p => p.score ?? 0));
    if (!Number.isFinite(stepsByItem[it])) stepsByItem[it] = 0;
  });
  const maxSteps = Math.max(...Object.values(stepsByItem));
  // Initialize person (theta) and item (beta) parameters
  const theta = Object.fromEntries(students.map(s => [s, 0]));
  const beta = Object.fromEntries(items.map(it => [it, 0]));
  let delta_rsm = Array.from({ length: maxSteps }, () => 0);
  const delta_pcm = {};
  items.forEach(it => { 
    delta_pcm[it] = Array.from({ length: stepsByItem[it] }, () => 0); 
  });
  // Joint Maximum Likelihood estimation iterations
  const maxIter = 100, tol = 1e-4;
  for (let iter = 0; iter < maxIter; iter++) {
    let maxChange = 0;
    // -- Update theta (person ability)
    students.forEach(s => {
      let g = 0, I = 0;
      pairs.filter(p => p.student === s).forEach(p => {
        const m = stepsByItem[p.item];
        const pr = categoryProbs(theta[s], beta[p.item], (modelType === 'pcm' ? delta_pcm[p.item] : delta_rsm), m, modelType);
        const Ex = pr.reduce((a, pj, j) => a + j * pj, 0);
        const Var = pr.reduce((a, pj, j) => a + pj * (j - Ex) ** 2, 0);
        g += ((p.score ?? 0) - Ex);
        I += Var;
      });
      if (I > 1e-6) {
        const d = g / I;
        theta[s] += d;
        maxChange = Math.max(maxChange, Math.abs(d));
      }
    });
    // Center theta (mean = 0)
    const meanTheta = students.reduce((a, s) => a + theta[s], 0) / students.length;
    students.forEach(s => { theta[s] -= meanTheta; });
    // -- Update beta (item difficulty)
    items.forEach(it => {
      let g = 0, I = 0;
      pairs.filter(p => p.item === it).forEach(p => {
        const m = stepsByItem[it];
        const pr = categoryProbs(theta[p.student], beta[it], (modelType === 'pcm' ? delta_pcm[it] : delta_rsm), m, modelType);
        const Ex = pr.reduce((a, pj, j) => a + j * pj, 0);
        const Var = pr.reduce((a, pj, j) => a + pj * (j - Ex) ** 2, 0);
        g += -((p.score ?? 0) - Ex);
        I += Var;
      });
      if (I > 1e-6) {
        const d = g / I;
        beta[it] += d;
        maxChange = Math.max(maxChange, Math.abs(d));
      }
    });
    // Center beta (mean = 0)
    const meanBeta = items.reduce((a, it) => a + beta[it], 0) / items.length;
    items.forEach(it => { beta[it] -= meanBeta; });
    // -- Update step difficulties (delta)
    if (modelType === 'pcm') {
      items.forEach(it => {
        for (let k = 0; k < stepsByItem[it]; k++) {
          let g = 0, I = 0;
          pairs.filter(p => p.item === it).forEach(p => {
            const m = stepsByItem[it];
            const pr = categoryProbs(theta[p.student], beta[it], delta_pcm[it], m, 'pcm');
            const Pk = pr[k], Pk1 = pr[k+1] || 0;
            g += (((p.score ?? 0) > k ? 1 : 0) - (Pk1 / ((Pk + Pk1) || 1)));
            I += (Pk * Pk1) / (((Pk + Pk1) || 1) ** 2);
          });
          if (I > 1e-6) {
            const d = g / I;
            delta_pcm[it][k] += d;
            maxChange = Math.max(maxChange, Math.abs(d));
          }
        }
        // Center delta values for this item
        const deltas = delta_pcm[it];
        if (deltas.length > 0) {
          const meanDelta = deltas.reduce((a, x) => a + x, 0) / deltas.length;
          delta_pcm[it] = deltas.map(d => d - meanDelta);
        }
      });
    } else { // RSM
      for (let k = 0; k < maxSteps; k++) {
        let g = 0, I = 0;
        pairs.forEach(p => {
          const m = stepsByItem[p.item];
          if (k >= m) return;
          const pr = categoryProbs(theta[p.student], beta[p.item], delta_rsm, m, 'rsm');
          const Pk = pr[k], Pk1 = pr[k+1] || 0;
          g += (((p.score ?? 0) > k ? 1 : 0) - (Pk1 / ((Pk + Pk1) || 1)));
          I += (Pk * Pk1) / (((Pk + Pk1) || 1) ** 2);
        });
        if (I > 1e-6) {
          const d = g / I;
          delta_rsm[k] += d;
          maxChange = Math.max(maxChange, Math.abs(d));
        }
      }
      // Center RSM delta values
      if (delta_rsm.length > 0) {
        const meanDelta = delta_rsm.reduce((a, x) => a + x, 0) / delta_rsm.length;
        delta_rsm = delta_rsm.map(d => d - meanDelta);
      }
    }
    if (maxChange < tol) break;
  }
  // Calculate infit/outfit statistics for each item
  const statsByItem = {};
  items.forEach(it => {
    statsByItem[it] = { sumZ2: 0, sumZ2w: 0, sumW: 0, count: 0 };
  });
  pairs.forEach(p => {
    const m = stepsByItem[p.item];
    const pr = categoryProbs(theta[p.student], beta[p.item], (modelType === 'pcm' ? delta_pcm[p.item] : delta_rsm), m, modelType);
    const Ex = pr.reduce((a, pj, j) => a + j * pj, 0);
    const Var = pr.reduce((a, pj, j) => a + pj * (j - Ex) ** 2, 0);
    const z = ((p.score ?? 0) - Ex) / Math.sqrt(Var || 1e-8);
    const s = statsByItem[p.item];
    s.sumZ2 += z * z;
    s.sumZ2w += Var * z * z;
    s.sumW += Var;
    s.count++;
  });
  const itemsRows = [];
  items.forEach(it => {
    const s = statsByItem[it];
    const n = s.count || 1;
    const outfit = s.sumZ2 / n;
    const infit = s.sumW > 0 ? s.sumZ2w / s.sumW : outfit;
    const tZ = 0; // standardized residual (approx, not fully calculated here)
    const pVal = (zVal) => 2 * (1 - phiCdf(Math.abs(zVal)));
    itemsRows.push({
      Item: it,
      Outfit: +outfit.toFixed(2), Outfit_t: +tZ.toFixed(2), Outfit_p: +pVal(tZ).toFixed(2),
      Infit: +infit.toFixed(2), Infit_t: +tZ.toFixed(2), Infit_p: +pVal(tZ).toFixed(2)
    });
  });
  // Reliability calculation
  const thetaVals = students.map(s => theta[s]);
  const betaVals = items.map(it => beta[it]);
  const variance = arr => {
    const mean = arr.reduce((a, x) => a + x, 0) / arr.length;
    return arr.reduce((a, x) => a + (x - mean) ** 2, 0) / arr.length;
  };
  const varPersons = variance(thetaVals);
  const avgVar = pairs.reduce((a, p) => {
    const m = stepsByItem[p.item];
    const pr = categoryProbs(theta[p.student], beta[p.item], (modelType === 'pcm' ? delta_pcm[p.item] : delta_rsm), m, modelType);
    const Ex = pr.reduce((acc, pj, j) => acc + j * pj, 0);
    const Var = pr.reduce((acc, pj, j) => acc + pj * (j - Ex) ** 2, 0);
    return a + Var;
  }, 0) / pairs.length;
  const reliability = varPersons / ((varPersons + avgVar) || 1e-6);
  // Display IRT summary and results
  irtSummary.innerHTML = `
    <div><strong>Reliability</strong>: ${reliability.toFixed(3)}</div>
    <div><strong>Variance (Persons)</strong>: ${varPersons.toFixed(3)}</div>`;
  drawWrightMap('wrightChart', thetaVals, betaVals);
  // Construct results table for item fit statistics
  const tbl = document.createElement('table');
  tbl.className = 'w-full text-sm';
  tbl.innerHTML = `
    <thead>
      <tr class="border-b border-gray-700">
        <th>Item</th>
        <th class="text-right">Outfit</th><th class="text-right">Outfit_t</th><th class="text-right">Outfit_p</th>
        <th class="text-right">Infit</th><th class="text-right">Infit_t</th><th class="text-right">Infit_p</th>
      </tr>
    </thead><tbody></tbody>`;
  const tb = tbl.querySelector('tbody');
  itemsRows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.Item}</td>
      <td class="text-right">${r.Outfit}</td>
      <td class="text-right">${r.Outfit_t}</td>
      <td class="text-right">${r.Outfit_p}</td>
      <td class="text-right">${r.Infit}</td>
      <td class="text-right">${r.Infit_t}</td>
      <td class="text-right">${r.Infit_p}</td>`;
    tb.appendChild(tr);
  });
  irtTableWrap.innerHTML = '';
  irtTableWrap.appendChild(tbl);
  // Enable exporting IRT table as CSV
  exportIRTBtn.onclick = () => {
    const csv = Papa.unparse(itemsRows);
    const blob = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    downloadBlob(blob, `irt_${modelType}.csv`);
  };
}
