/***** app.js *****/
let currentLang = 'zh-CN';
const $ = (sel)=>document.querySelector(sel);

// refs
const itemFileInput = $('#itemFile');
const scoreFileInput = $('#scoreFile');
const predictFileInput = $('#predictItemFile');

const itemMapDiv = $('#itemMapping');
const itemIdSelect = $('#itemIdSelect');
const featureColsSelect = $('#featureColsSelect');

const scoreMapDiv = $('#scoreMapping');
const studentIdSelect = $('#studentIdSelect');
const scoreFormatSelect = $('#scoreFormatSelect');
const scoreItemIdSelect = $('#scoreItemIdSelect');
const scoreValueSelect = $('#scoreValueSelect');
const wideItemColsSelect = $('#wideItemColsSelect');

const neuronsInput = $('#neuronsInput');
const epochsInput = $('#epochsInput');
const batchSizeInput = $('#batchSizeInput');
const learningRateInput = $('#learningRateInput');
const activationSelect = $('#activationSelect');

const validationList = $('#validationList');
const addValidationBtn = $('#addValidationBtn');

const startBtn = $('#startBtn');
const progressSection = $('#progressSection');
const progressText = $('#progressText');
const progressBar = $('#progressBar');
const resultsContainer = $('#resultsContainer');

const predictBtn = $('#predictBtn');
const predictResultsDiv = $('#predictResults');

const irtSummary = $('#irtSummary');
const irtTableWrap = $('#irtTableWrap');

// language
const langSelect = $('#langSelect');
document.documentElement.lang = currentLang;
langSelect.value = currentLang;
langSelect.addEventListener('change', ()=>{
  currentLang = langSelect.value;
  document.documentElement.lang = currentLang;
  applyI18n();
});

// data holders
let itemRows = [];   // [{ItemID, Construct,...}]
let itemHeaders = [];
let scoreRows = [];  // long or wide format, as parsed rows
let scoreHeaders = [];

let trainedModels = []; // [{config, model, metrics, featureMap}]
let bestModelIndex = -1;

// ---------- i18n ----------
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k = el.getAttribute('data-i18n');
    const txt = (translations[currentLang]||{})[k];
    if (txt) el.textContent = txt;
  });
  // options
  document.querySelectorAll('option[data-i18n]').forEach(opt=>{
    const k = opt.getAttribute('data-i18n');
    const txt = (translations[currentLang]||{})[k];
    if (txt) opt.textContent = txt;
  });
  // placeholders可能需要的话可补充
}
document.addEventListener('DOMContentLoaded', applyI18n);

// ---------- helpers ----------
function fillSelectOptions(selectEl, options) {
  selectEl.innerHTML = '';
  options.forEach(name=>{
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    selectEl.appendChild(opt);
  });
}
function fillMultiSelect(selectEl, options) {
  selectEl.innerHTML = '';
  options.forEach(name=>{
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    selectEl.appendChild(opt);
  });
}
function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }

// parse CSV
function parseCSV(file, onComplete) {
  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (res)=>{
      if (res.errors && res.errors.length) {
        alert((translations[currentLang]?.uploadError)||'File upload error');
        console.error(res.errors);
        return;
      }
      onComplete(res.meta.fields||[], res.data||[]);
    }
  });
}

// read item file
itemFileInput.addEventListener('change', (e)=>{
  const f = e.target.files[0];
  if (!f) return;
  $('#itemFileName').textContent = f.name;
  parseCSV(f,(headers,rows)=>{
    itemHeaders = headers;
    itemRows = rows;
    // populate mapping UI
    fillSelectOptions(itemIdSelect, headers);
    fillMultiSelect(featureColsSelect, headers);
    show(itemMapDiv);
  });
});

// read score file
scoreFileInput.addEventListener('change', (e)=>{
  const f = e.target.files[0];
  if (!f) return;
  $('#scoreFileName').textContent = f.name;
  parseCSV(f,(headers,rows)=>{
    scoreHeaders = headers;
    scoreRows = rows;
    fillSelectOptions(studentIdSelect, headers);
    fillSelectOptions(scoreItemIdSelect, headers);
    fillSelectOptions(scoreValueSelect, headers);
    fillMultiSelect(wideItemColsSelect, headers);
    show(scoreMapDiv);
  });
});

// add/remove validation blocks
const valTemplate = validationList.firstElementChild.cloneNode(true);
addValidationBtn.addEventListener('click', ()=>{
  const b = valTemplate.cloneNode(true);
  const close = document.createElement('button');
  close.textContent = '×';
  close.className = 'absClose absolute top-2 right-2 text-gray-400 hover:text-red-500';
  b.appendChild(close);
  close.addEventListener('click', ()=> b.remove());
  // listen loocv disable ratio
  const methodSel = b.querySelector('.methodSelect');
  const ratioInput = b.querySelector('.ratioInput');
  methodSel.addEventListener('change', ()=>{
    const isLOO = methodSel.value==='loocv';
    ratioInput.disabled = isLOO;
    ratioInput.classList.toggle('opacity-50', isLOO);
  });
  validationList.appendChild(b);
});

// get mapped, normalized training samples
// returns {X, y, meta}  where meta holds dictionaries for one-hot encoding
function buildSamples() {
  if (itemRows.length===0 || scoreRows.length===0) {
    alert((translations[currentLang]?.needUpload)||'Please upload both CSVs first.');
    return null;
  }
  const itemIdCol = itemIdSelect.value;
  const featureCols = Array.from(featureColsSelect.selectedOptions).map(o=>o.value);
  if (!itemIdCol || featureCols.length===0) {
    alert((translations[currentLang]?.chooseItemMapping)||'Please map ItemID and feature columns.');
    return null;
  }
  // build item dict by ID
  const itemById = new Map();
  itemRows.forEach(r=>{
    const id = r[itemIdCol];
    if (id==null) return;
    const featObj = {};
    featureCols.forEach(fc=> featObj[fc]= r[fc]);
    itemById.set(id, featObj);
  });

  // detect score format
  const fmt = scoreFormatSelect.value; // 'long' or 'wide'
  const studentCol = studentIdSelect.value;
  if (!studentCol) {
    alert((translations[currentLang]?.chooseStudentCol)||'Please choose StudentID column.');
    return null;
  }

  let samples = []; // each: {student, item, features:{}, score}
  if (fmt==='long') {
    const itemCol = scoreItemIdSelect.value;
    const scoreCol = scoreValueSelect.value;
    if (!itemCol || !scoreCol) {
      alert((translations[currentLang]?.chooseLongCols)||'Please choose ItemID & Score columns for long format.');
      return null;
    }
    scoreRows.forEach(r=>{
      const sid = r[studentCol];
      const iid = r[itemCol];
      const sc  = r[scoreCol];
      if (sid==null || iid==null || sc==null) return;
      const feat = itemById.get(iid);
      if (!feat) return; // skip item not found in item csv
      samples.push({student: sid, item: iid, feat, score: Number(sc)});
    });
  } else {
    // wide: each row = student, columns = item scores
    const selectedItemCols = Array.from(wideItemColsSelect.selectedOptions).map(o=>o.value);
    if (selectedItemCols.length===0) {
      alert((translations[currentLang]?.chooseWideCols)||'Please choose item columns for wide format.');
      return null;
    }
    scoreRows.forEach(r=>{
      const sid = r[studentCol];
      selectedItemCols.forEach(col=>{
        const sc = r[col];
        if (sc==null || sc==='') return;
        const iid = col; // assume column header equals item id
        const feat = itemById.get(iid);
        if (!feat) return;
        samples.push({student: sid, item: iid, feat, score: Number(sc)});
      });
    });
  }
  if (samples.length===0) {
    alert((translations[currentLang]?.noValidSamples)||'No valid samples after mapping.');
    return null;
  }

  // build one-hot dictionaries (categorical only, as你要求)
  const dicts = {};  // {colName: [uniqueValues]}
  featureCols.forEach(fc=>{
    dicts[fc] = [];
  });
  // (可选) 将 StudentID 也作为分类特征，便于个体化预测
  const includeStudentAsCategorical = true;
  if (includeStudentAsCategorical) dicts['__student__'] = [];

  samples.forEach(s=>{
    featureCols.forEach(fc=>{
      const v = s.feat[fc];
      if (!dicts[fc].includes(v)) dicts[fc].push(v);
    });
    if (includeStudentAsCategorical) {
      if (!dicts['__student__'].includes(s.student)) dicts['__student__'].push(s.student);
    }
  });

  // build X,y
  const inputDim = Object.values(dicts).reduce((sum,arr)=>sum+arr.length,0);
  function encodeSample(s){
    const vec = new Array(inputDim).fill(0);
    let offset = 0;
    for (const fc of Object.keys(dicts)) {
      const arr = dicts[fc];
      const val = (fc==='__student__')? s.student : s.feat[fc];
      const idx = arr.indexOf(val);
      if (idx>=0) vec[offset+idx]=1;
      offset+=arr.length;
    }
    return vec;
  }
  const X=[], y=[];
  samples.forEach(s=>{
    X.push(encodeSample(s));
    y.push([s.score]);
  });

  return { X, y, samples, dicts, inputDim, featureCols, itemIdCol, studentCol };
}

// train button
startBtn.addEventListener('click', async ()=>{
  const built = buildSamples();
  if (!built) return;
  const {X,y,inputDim,samples,dicts} = built;

  // collect validation configs
  const configs = [];
  validationList.querySelectorAll('.relative').forEach(box=>{
    const method = box.querySelector('.methodSelect').value;
    const ratio  = Number(box.querySelector('.ratioInput').value||80)/100;
    configs.push({method, ratio});
  });
  if (configs.length===0) {
    alert((translations[currentLang]?.noValidationAlert)||'Please add at least one validation.');
    return;
  }

  resultsContainer.innerHTML = '';
  trainedModels = [];
  bestModelIndex = -1;
  let bestRmse = Infinity;

  startBtn.disabled = true;
  progressBar.style.width='0%';
  progressText.textContent = translations[currentLang]?.progressTraining?.replace('{current}',1).replace('{total}',configs.length).replace('{method}','') || 'Training...';
  progressSection.classList.remove('hidden');

  for (let i=0;i<configs.length;i++) {
    const {method, ratio} = configs[i];

    // split
    let idx = [...Array(X.length).keys()];
    tf.util.shuffle(idx);
    let trainIdx, testIdx;
    if (method==='holdout') {
      const nTrain = Math.max(1, Math.floor(idx.length*ratio));
      trainIdx = idx.slice(0,nTrain);
      testIdx  = idx.slice(nTrain);
      if (testIdx.length===0) { testIdx = idx.slice(-1); trainIdx = idx.slice(0, idx.length-1); }
    } else { // loocv: we'll loop
      trainIdx = idx;
      testIdx = null;
    }

    const Xtrain = (method==='holdout')? tf.tensor2d(trainIdx.map(k=>X[k])) : null;
    const Ytrain = (method==='holdout')? tf.tensor2d(trainIdx.map(k=>y[k])) : null;
    const Xtest  = (method==='holdout')? tf.tensor2d(testIdx.map(k=>X[k])) : null;
    const Ytest  = (method==='holdout')? tf.tensor2d(testIdx.map(k=>y[k])) : null;

    // build model
    const model = tf.sequential();
    model.add(tf.layers.dense({
      inputShape:[inputDim],
      units: Number(neuronsInput.value)||16,
      activation: activationSelect.value||'relu'
    }));
    model.add(tf.layers.dense({units:1, activation:'linear'}));
    const opt = tf.train.adam(Number(learningRateInput.value)||0.001);
    model.compile({optimizer:opt, loss:'meanSquaredError'});

    let histLoss=[], histVal=[];
    progressText.textContent = (translations[currentLang]?.progressTraining||'Training (Run {current}/{total})...')
      .replace('{current}', i+1).replace('{total}', configs.length)
      .replace('{method}', method.toUpperCase());

    if (method==='holdout') {
      await model.fit(Xtrain, Ytrain, {
        epochs: Number(epochsInput.value)||100,
        batchSize: Number(batchSizeInput.value)||32,
        validationData: [Xtest, Ytest],
        callbacks:{
          onEpochEnd:(ep,logs)=>{
            const percent = Math.round((ep+1)/(Number(epochsInput.value)||100)*100);
            progressBar.style.width = percent+'%';
            histLoss.push(logs.loss);
            if (logs.val_loss!=null) histVal.push(logs.val_loss);
            progressText.textContent = (translations[currentLang]?.progressEpoch || 'Run {current}/{total} - Epoch {epoch}/{epochs}')
                .replace('{current}',i+1).replace('{total}',configs.length)
                .replace('{epoch}',ep+1).replace('{epochs}', Number(epochsInput.value)||100);
          }
        }
      });
    } else {
      // LOOCV
      const epochs = Number(epochsInput.value)||100;
      const n = X.length;
      const preds=[], acts=[];
      for (let k=0;k<n;k++){
        const trainX = tf.tensor2d(X.filter((_,j)=>j!==k));
        const trainY = tf.tensor2d(y.filter((_,j)=>j!==k));
        const testX  = tf.tensor2d([X[k]]);
        const testY  = y[k][0];

        const local = tf.sequential();
        local.add(tf.layers.dense({inputShape:[inputDim],units:Number(neuronsInput.value)||16,activation:activationSelect.value||'relu'}));
        local.add(tf.layers.dense({units:1,activation:'linear'}));
        local.compile({optimizer: tf.train.adam(Number(learningRateInput.value)||0.001), loss:'meanSquaredError'});
        await local.fit(trainX,trainY,{epochs, batchSize:Math.min(32, X.length-1), shuffle:true});
        const p = local.predict(testX).dataSync()[0];
        preds.push(p); acts.push(testY);
        trainX.dispose(); trainY.dispose(); testX.dispose(); local.dispose();
        progressBar.style.width = Math.round((k+1)/n*100)+'%';
        progressText.textContent = (translations[currentLang]?.progressLOOCV || 'Run {current}/{total} - Processed {done}/{totalSamples} samples')
          .replace('{current}',i+1).replace('{total}',configs.length)
          .replace('{done}',k+1).replace('{totalSamples}',n);
      }
      // 组装伪history用于图
      histLoss = [];
      histVal  = [];
      // 计算指标
      const m = computeMetrics(acts, preds);
      renderResultCard({method, ratio, metrics:m, histLoss, histVal, actual:acts, pred:preds});
      // 保存模型占位（LOOCV不保留最终单模型）
      trainedModels.push({config:{method,ratio}, model:null, metrics:m, dicts});
      if (m.RMSE < bestRmse) { bestRmse=m.RMSE; bestModelIndex=trainedModels.length-1; }
      continue;
    }

    // predictions on test
    const predT = model.predict(Xtest);
    const predA = Array.from(predT.dataSync());
    const actA  = Array.from(Ytest.dataSync());
    const m = computeMetrics(actA, predA);
    renderResultCard({method, ratio, metrics:m, histLoss, histVal, actual:actA, pred:predA});
    trainedModels.push({config:{method,ratio}, model, metrics:m, dicts});
    if (m.RMSE < bestRmse) { bestRmse=m.RMSE; bestModelIndex=trainedModels.length-1; }

    // dispose tensors
    Xtrain.dispose(); Ytrain.dispose(); Xtest.dispose(); Ytest.dispose(); predT.dispose();
  }

  progressText.textContent = (translations[currentLang]?.progressComplete)||'Training complete';
  setTimeout(()=> progressSection.classList.add('hidden'), 1200);
  startBtn.disabled = false;
});

// metrics
function computeMetrics(actual, pred){
  const n = actual.length;
  let mae=0, mse=0, sumY=0;
  for (let i=0;i<n;i++){
    const e = pred[i]-actual[i];
    mae += Math.abs(e);
    mse += e*e;
    sumY += actual[i];
  }
  mae/=n; mse/=n;
  const rmse = Math.sqrt(mse);
  const meanY = sumY/n;
  let sst=0;
  for (let i=0;i<n;i++){ const d=actual[i]-meanY; sst+=d*d; }
  const r2 = (sst>0)? (1 - mse*n/sst) : 1;
  return { MAE:+mae.toFixed(3), MSE:+mse.toFixed(3), RMSE:+rmse.toFixed(3), R2:+r2.toFixed(3) };
}

function renderResultCard({method, ratio, metrics, histLoss, histVal, actual, pred}) {
  const card = document.createElement('div');
  card.className='p-4 bg-gray-800 border border-gray-700 rounded';

  const title = document.createElement('h3');
  title.className='font-semibold mb-2';
  if (method==='holdout') {
    const trainPct = Math.round(ratio*100);
    const testPct = 100-trainPct;
    title.textContent = (translations[currentLang]?.resultHoldout || 'Holdout (Training {trainPct}% / Testing {testPct}%)')
      .replace('{trainPct}',trainPct).replace('{testPct}',testPct);
  } else {
    title.textContent = translations[currentLang]?.resultLoocv || 'LOOCV (Leave-One-Out Cross-Validation)';
  }
  card.appendChild(title);

  const ul = document.createElement('ul');
  ['MAE','MSE','RMSE','R2'].forEach(k=>{
    const li=document.createElement('li');
    li.textContent = (translations[currentLang]?.[k]||k)+': '+metrics[k];
    ul.appendChild(li);
  });
  card.appendChild(ul);

  // charts
  if (histLoss?.length){
    const lossDiv=document.createElement('div'); lossDiv.style.height='220px'; card.appendChild(lossDiv);
    drawLossCurvePlotly(lossDiv, histLoss, histVal, currentLang);
  }
  if (actual?.length){
    const scDiv=document.createElement('div'); scDiv.style.height='260px'; card.appendChild(scDiv);
    drawScatterPlotPlotly(scDiv, actual, pred, currentLang);
  }
  resultsContainer.appendChild(card);
}

// ---------- Predict ----------
predictBtn.addEventListener('click', ()=>{
  if (bestModelIndex<0 || !trainedModels[bestModelIndex].model) {
    alert((translations[currentLang]?.trainFirst)||'Please train (holdout) to keep a model first.');
    return;
  }
  const file = predictFileInput.files[0];
  if (!file) { alert((translations[currentLang]?.choosePredictFile)||'Please upload predict item CSV.'); return; }
  parseCSV(file,(headers,rows)=>{
    // use same mapping & dicts
    const built = buildSamples();
    if (!built) return;
    const {dicts, inputDim} = trainedModels[bestModelIndex];
    const itemIdCol = itemIdSelect.value;
    const featureCols = Array.from(featureColsSelect.selectedOptions).map(o=>o.value);

    // build one-hot using dicts; unknown category -> ignore (all zero)
    function encode(featObj, studentId) {
      const vec = new Array(inputDim).fill(0);
      let offset=0;
      for (const key of Object.keys(dicts)) {
        const arr = dicts[key];
        const val = (key==='__student__')? studentId : featObj[key];
        const ix = arr.indexOf(val);
        if (ix>=0) vec[offset+ix]=1;
        offset+=arr.length;
      }
      return vec;
    }

    // build feature rows for each new item, and for every known student (to produce kidmap)
    const students = dicts['__student__']||[];
    const model = trainedModels[bestModelIndex].model;

    const predicts = []; // {student,item,pred}
    rows.forEach(r=>{
      const iid=r[itemIdCol]; if (iid==null) return;
      const feat={};
      featureCols.forEach(fc=> feat[fc]=r[fc]);
      students.forEach(sid=>{
        const x = encode(feat, sid);
        const p = model.predict(tf.tensor2d([x])).dataSync()[0];
        predicts.push({student:sid, item:iid, pred:p});
      });
    });

    // render table preview & kidmap-like matrix
    predictResultsDiv.innerHTML = '';
    const info = document.createElement('div');
    info.className='text-sm text-gray-300';
    info.textContent = (translations[currentLang]?.predictSummary || 'Predicted pairs')+`: ${predicts.length}`;
    predictResultsDiv.appendChild(info);

    // small table
    const tbl = document.createElement('table');
    tbl.className='mt-2 w-full text-sm';
    tbl.innerHTML = `<thead><tr>
      <th class="text-left">Student</th><th class="text-left">Item</th><th class="text-left">Pred</th>
    </tr></thead><tbody></tbody>`;
    const tb = tbl.querySelector('tbody');
    predicts.slice(0,100).forEach(r=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${r.student}</td><td>${r.item}</td><td>${r.pred.toFixed(3)}</td>`;
      tb.appendChild(tr);
    });
    predictResultsDiv.appendChild(tbl);

    // Wright Map & IRT calibration (based on predicted vs simple Rasch fit)
    runIRTCalibration(predicts);
  });
});

// ---------- IRT ----------
function runIRTCalibration(pairs){
  // estimate theta (person) & b (item) by simple alternating updates (logistic Rasch)
  // pairs: {student,item,pred} 这里没有真实分数 -> 我们用预测分数归一化为0-1近似响应概率
  // 为了更贴近 IRT，这里将 pred 线性缩放到 [0,1] 区间（根据全体最小最大）
  const students=[...new Set(pairs.map(p=>p.student))];
  const items=[...new Set(pairs.map(p=>p.item))];

  let pMin = Math.min(...pairs.map(p=>p.pred)), pMax = Math.max(...pairs.map(p=>p.pred));
  if (pMax===pMin) { pMax = pMin+1e-6; }
  pairs.forEach(p=> p.y = (p.pred - pMin)/(pMax-pMin)); // [0,1]

  const theta = Object.fromEntries(students.map(s=>[s,0]));
  const b     = Object.fromEntries(items.map(it=>[it,0]));
  const lr=0.01, iters=60;

  for (let t=0;t<iters;t++){
    // update theta
    students.forEach(s=>{
      let grad=0;
      pairs.filter(p=>p.student===s).forEach(p=>{
        const prob = 1/(1+Math.exp(-(theta[s]-b[p.item])));
        grad += (p.y - prob); // d loglik
      });
      theta[s] += lr*grad;
    });
    // update b
    items.forEach(it=>{
      let grad=0;
      pairs.filter(p=>p.item===it).forEach(p=>{
        const prob = 1/(1+Math.exp(-(theta[p.student]-b[it])));
        grad += -(p.y - prob);
      });
      b[it] += lr*grad;
    });
  }

  // compute fit stats
  // standardized residual z = (y - p)/sqrt(p*(1-p))
  const statsByItem = {};
  items.forEach(it=> statsByItem[it] = {sumU:0,sumW:0,sumZ2:0,count:0, zList:[]});
  pairs.forEach(p=>{
    const pr = 1/(1+Math.exp(-(theta[p.student]-b[p.item])));
    const varp = pr*(1-pr) || 1e-6;
    const z = (p.y - pr)/Math.sqrt(varp);
    const w = varp; // info weight
    const itStat = statsByItem[p.item];
    itStat.sumU += z*z;                   // outfit numerator (~均方)
    itStat.sumW += w*z*z;                 // infit weighted
    itStat.sumZ2+= z*z;
    itStat.zList.push(z);
    itStat.count++;
  });

  // convert to table rows
  const rows=[];
  items.forEach(it=>{
    const st = statsByItem[it];
    const n = Math.max(1, st.count);
    const outfit = st.sumU/n;
    const infit  = st.sumW/n;
    // t统计近似：标准化残差均值 / sqrt(var/n) ~ 0，这里用z均值近似
    const zbar = st.zList.reduce((a,b)=>a+b,0)/n;
    const tInfit  = zbar; // 近似
    const tOutfit = zbar;
    // p值近似正态：2*Phi(-|z|)
    function approxP(z){ return 2*(1-phiCdf(Math.abs(z))); }
    const pInfit = approxP(tInfit);
    const pOutfit= approxP(tOutfit);

    rows.push({
      item: it,
      Outfit: +outfit.toFixed(2),
      Outfit_t: +tOutfit.toFixed(2),
      Outfit_p: +pOutfit.toFixed(2),
      Infit: +infit.toFixed(2),
      Infit_t: +tInfit.toFixed(2),
      Infit_p: +pInfit.toFixed(2)
    });
  });

  // reliability & variance (粗略)
  const thetaVals = students.map(s=>theta[s]);
  const itemVals  = items.map(it=>b[it]);
  const variancePersons = variance(thetaVals);
  const varianceItems   = variance(itemVals);
  // 粗略信度：person separation reliability ~ Var(theta)/(Var(theta)+error)
  // 用平均 var(p) 近似误差
  const avgVar = pairs.reduce((a,p)=>{
    const pr = 1/(1+Math.exp(-(theta[p.student]-b[p.item])));
    return a + pr*(1-pr);
  },0)/pairs.length;
  const reliability = variancePersons/(variancePersons + avgVar || 1e-6);

  // render summary
  irtSummary.innerHTML = `
    <div class="text-sm">
      <div><strong>Reliability</strong>: ${reliability.toFixed(3)}</div>
      <div><strong>Variance (Persons)</strong>: ${variancePersons.toFixed(3)} | 
           <strong>Variance (Items)</strong>: ${varianceItems.toFixed(3)}</div>
    </div>
  `;

  // wright map
  drawWrightMap('wrightChart', thetaVals, itemVals, currentLang);

  // table render
  const tbl = document.createElement('table');
  tbl.className='w-full text-sm';
  tbl.innerHTML = `
    <thead>
      <tr class="border-b border-gray-700">
        <th class="text-left py-1 px-2">Item</th>
        <th class="text-right py-1 px-2">Outfit</th>
        <th class="text-right py-1 px-2">Outfit_t</th>
        <th class="text-right py-1 px-2">Outfit_p</th>
        <th class="text-right py-1 px-2">Infit</th>
        <th class="text-right py-1 px-2">Infit_t</th>
        <th class="text-right py-1 px-2">Infit_p</th>
      </tr>
    </thead>
    <tbody></tbody>`;
  const tb = tbl.querySelector('tbody');
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td class="py-1 px-2">${r.item}</td>
      <td class="py-1 px-2 text-right">${r.Outfit.toFixed(2)}</td>
      <td class="py-1 px-2 text-right">${r.Outfit_t.toFixed(2)}</td>
      <td class="py-1 px-2 text-right">${r.Outfit_p.toFixed(2)}</td>
      <td class="py-1 px-2 text-right">${r.Infit.toFixed(2)}</td>
      <td class="py-1 px-2 text-right">${r.Infit_t.toFixed(2)}</td>
      <td class="py-1 px-2 text-right">${r.Infit_p.toFixed(2)}</td>
    `;
    tb.appendChild(tr);
  });
  irtTableWrap.innerHTML = '';
  irtTableWrap.appendChild(tbl);
}

function variance(arr) {
  if (arr.length===0) return 0;
  const m = arr.reduce((a,b)=>a+b,0)/arr.length;
  return arr.reduce((a,b)=>a+(b-m)*(b-m),0)/arr.length;
}
// 正态CDF近似
function phiCdf(z){
  // Abramowitz-Stegun approximation
  const t = 1/(1+0.2316419*z);
  const d = Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
  const p = 1 - d*(0.319381530*t - 0.356563782*t**2 + 1.781477937*t**3 - 1.821255978*t**4 + 1.330274429*t**5);
  return p;
}

// 初始绑定（禁用比例当选择loocv）
(function initValidationBox(){
  const mSel = validationList.querySelector('.methodSelect');
  const rInp = validationList.querySelector('.ratioInput');
  mSel.addEventListener('change', ()=>{
    const isL = mSel.value==='loocv';
    rInp.disabled=isL; rInp.classList.toggle('opacity-50', isL);
  });
})();
