/***** app.js *****/
// 获取必要的页面元素
const featureList = document.getElementById('featureList');
const addFeatureBtn = document.getElementById('addFeatureBtn');
const validationList = document.getElementById('validationList');
const addValidationBtn = document.getElementById('addValidationBtn');
const startBtn = document.getElementById('startBtn');
const progressSection = document.getElementById('progressSection');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progressBar');
const langSelect = document.getElementById('langSelect');
const resultsContainer = document.getElementById('resultsContainer');

// 模型结构配置输入元素
const neuronsInput = document.getElementById('neuronsInput');
const epochsInput = document.getElementById('epochsInput');
const batchSizeInput = document.getElementById('batchSizeInput');
const learningRateInput = document.getElementById('learningRateInput');
const activationSelect = document.getElementById('activationSelect');

// 当前界面语言，默认与index.html lang属性一致
let currentLang = document.documentElement.lang || 'zh-CN';

// 初始化翻译界面文本
translatePage();

// 绑定语言切换事件:contentReference[oaicite:18]{index=18}
langSelect.value = currentLang;
langSelect.addEventListener('change', () => {
  const newLang = langSelect.value;
  currentLang = newLang;
  translatePage();
});

// 工具函数：根据当前语言翻译页面所有 data-i18n 元素
function translatePage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[currentLang] && translations[currentLang][key]) {
      // 设置文本
      el.textContent = translations[currentLang][key];
    }
  });
  // 特殊处理：需要翻译的 <option> 元素内容
  document.querySelectorAll('option[data-i18n]').forEach(opt => {
    const key = opt.getAttribute('data-i18n');
    if (translations[currentLang] && translations[currentLang][key]) {
      opt.textContent = translations[currentLang][key];
    }
  });
}

// 模板元素：初始特征行 和 初始验证配置框，用于克隆
const featureItemTemplate = featureList.firstElementChild.cloneNode(true);
const validationItemTemplate = validationList.firstElementChild.cloneNode(true);

// 添加特征行
addFeatureBtn.addEventListener('click', () => {
  const newFeatureItem = featureItemTemplate.cloneNode(true);
  // 显示删除按钮并绑定删除事件
  const removeBtn = newFeatureItem.querySelector('button');
  removeBtn.style.display = 'inline'; // 新增的特征行可删除
  removeBtn.addEventListener('click', () => {
    featureList.removeChild(newFeatureItem);
    updateFeatureRemoveButtons();
  });
  // 清空输入框并翻译占位符
  const input = newFeatureItem.querySelector('input');
  input.value = '';
  // 将新元素附加到列表并更新多语言
  featureList.appendChild(newFeatureItem);
  translatePage();
  updateFeatureRemoveButtons();
});

// 更新特征行删除按钮可见性
function updateFeatureRemoveButtons() {
  const featureItems = featureList.querySelectorAll('div');
  featureItems.forEach((item, idx) => {
    const btn = item.querySelector('button');
    if (btn) {
      btn.style.display = (featureItems.length > 1) ? 'inline' : 'none';
    }
  });
}

// 添加验证配置框
addValidationBtn.addEventListener('click', () => {
  const newValItem = validationItemTemplate.cloneNode(true);
  // 处理删除按钮
  const removeBtn = newValItem.querySelector('button');
  removeBtn.style.display = 'inline';
  removeBtn.addEventListener('click', () => {
    validationList.removeChild(newValItem);
    updateValidationRemoveButtons();
  });
  // 处理验证方法选择变化事件
  const methodSelect = newValItem.querySelector('.methodSelect');
  const ratioInput = newValItem.querySelector('.ratioInput');
  methodSelect.addEventListener('change', () => {
    if (methodSelect.value === 'loocv') {
      ratioInput.disabled = true;
      ratioInput.classList.add('opacity-50'); // 视觉置灰
    } else {
      ratioInput.disabled = false;
      ratioInput.classList.remove('opacity-50');
    }
  });
  // 默认根据当前选项设置禁用状态
  if (methodSelect.value === 'loocv') {
    newValItem.querySelector('.ratioInput').disabled = true;
    newValItem.querySelector('.ratioInput').classList.add('opacity-50');
  }
  // 添加新配置框并翻译其中文本
  validationList.appendChild(newValItem);
  translatePage();
  updateValidationRemoveButtons();
});

// 更新验证配置删除按钮可见性
function updateValidationRemoveButtons() {
  const valItems = validationList.querySelectorAll('div.relative');
  valItems.forEach(item => {
    const btn = item.querySelector('button');
    if (btn) {
      btn.style.display = (valItems.length > 1) ? 'inline' : 'none';
    }
  });
}

// 初始化时，为默认的验证选择绑定事件（初始模板框）
const initialMethodSelect = validationList.querySelector('.methodSelect');
const initialRatioInput = validationList.querySelector('.ratioInput');
initialMethodSelect.addEventListener('change', () => {
  if (initialMethodSelect.value === 'loocv') {
    initialRatioInput.disabled = true;
    initialRatioInput.classList.add('opacity-50');
  } else {
    initialRatioInput.disabled = false;
    initialRatioInput.classList.remove('opacity-50');
  }
});

// 开始训练按钮事件
startBtn.addEventListener('click', async () => {
  // 获取特征名称列表
  const featureNames = [];
  featureList.querySelectorAll('input').forEach(input => {
    const name = input.value.trim();
    if (name) featureNames.push(name);
  });
  if (featureNames.length === 0) {
    alert(translations[currentLang]['noFeatureAlert'] || 'Please add at least one feature.');
    return;
  }
  // 获取验证方案配置列表
  const configs = [];
  validationList.querySelectorAll('div.relative').forEach(item => {
    const method = item.querySelector('.methodSelect').value;
    let trainRatio = 0.8;
    if (method === 'holdout') {
      const ratioVal = parseInt(item.querySelector('.ratioInput').value, 10);
      trainRatio = isNaN(ratioVal) ? 0.8 : Math.max(1, Math.min(99, ratioVal)) / 100;
    }
    configs.push({ method, trainRatio });
  });
  if (configs.length === 0) {
    // 理论上不会触发，因为至少有一个默认配置
    alert(translations[currentLang]['noValidationAlert'] || 'Please add at least one validation method.');
    return;
  }

  // 读取上传的CSV文件
  if (!uploadedData) {
    alert(translations[currentLang]['noFileAlert'] || 'Please upload a data file first.');
    return;
  }
  const data = uploadedData; // uploadedData在文件上传处理后保存
  const headers = uploadedHeaders; // 列名数组
  // 确定目标列（假设为最后一列）
  const targetName = headers[headers.length - 1];
  if (featureNames.includes(targetName)) {
    // 如用户误将目标列当做特征
    console.warn('Target column is included in features. Removing it from features.');
    featureNames.splice(featureNames.indexOf(targetName), 1);
  }

  // 准备特征->类别映射，用于独热编码
  const categoryMaps = {};
  featureNames.forEach(fname => {
    categoryMaps[fname] = [];
  });
  data.forEach(row => {
    featureNames.forEach(fname => {
      const val = row[fname];
      if (!categoryMaps[fname].includes(val)) {
        categoryMaps[fname].push(val);
      }
    });
  });
  // 计算总输入维度
  let inputDim = 0;
  for (let fname of featureNames) {
    inputDim += categoryMaps[fname].length;
  }

  // 清空之前的结果展示
  resultsContainer.innerHTML = '';

  // 禁用训练按钮避免重复点击
  startBtn.disabled = true;
  startBtn.classList.add('opacity-50');
  // 遍历每个验证配置，依次训练并展示结果
  for (let i = 0; i < configs.length; i++) {
    const { method, trainRatio } = configs[i];
    // 更新进度文本
    progressSection.style.display = 'block';
    progressText.textContent = translations[currentLang]['progressTraining'] 
      ? translations[currentLang]['progressTraining']
          .replace('{current}', i+1).replace('{total}', configs.length)
          .replace('{method}', translations[currentLang][method === 'holdout' ? 'valMethodHoldout' : 'valMethodLoocv'] || method)
      : `Training (Run ${i+1}/${configs.length})...`;
    progressBar.style.width = '0%';

    // 准备训练和测试数据集
    let trainData = [], testData = [];
    if (method === 'holdout') {
      // Shuffle data
      const shuffled = data.slice();
      shuffled.sort(() => Math.random() - 0.5);
      const trainCount = Math.floor(shuffled.length * trainRatio);
      trainData = shuffled.slice(0, trainCount);
      testData = shuffled.slice(trainCount);
    } else if (method === 'loocv') {
      trainData = data; // LOOCV整体特殊处理
    }

    // 转换训练集为张量
    const { X: trainXArr, Y: trainYArr } = prepareXY(trainData, featureNames, targetName, categoryMaps, inputDim);
    let trainX, trainY;
    if (trainXArr.length > 0) {
      trainX = tf.tensor2d(trainXArr, [trainXArr.length, inputDim]);
      trainY = tf.tensor2d(trainYArr, [trainYArr.length, 1]);
    } else {
      console.error('Training data is empty for config', i);
      continue;
    }

    let testXArr = [], testYArr = [], actualTest = [], predTest = [];
    let historyLoss = [], historyValLoss = [];

    if (method === 'holdout') {
      // 准备测试集张量
      const preparedTest = prepareXY(testData, featureNames, targetName, categoryMaps, inputDim);
      testXArr = preparedTest.X;
      testYArr = preparedTest.Y;
      if (testXArr.length > 0) {
        var testX = tf.tensor2d(testXArr, [testXArr.length, inputDim]);
        var testY = tf.tensor2d(testYArr, [testYArr.length, 1]);
      }
    }

    // 构建模型
    const model = tf.sequential();
    model.add(tf.layers.dense({
      units: parseInt(neuronsInput.value) || 16,
      activation: activationSelect.value || 'relu',
      inputShape: [inputDim]
    }));
    // 输出层，回归问题输出1个值
    model.add(tf.layers.dense({ units: 1, activation: 'linear' }));
    // 编译模型
    const lr = parseFloat(learningRateInput.value) || 0.001;
    const optimizer = tf.train.adam(lr);
    model.compile({
      optimizer: optimizer,
      loss: 'meanSquaredError',
      metrics: ['mse']  // 我们可以跟踪MSE，但R2等需手动计算
    });

    if (method === 'holdout') {
      // 训练模型（带验证集）
      const epochs = parseInt(epochsInput.value) || 100;
      await model.fit(trainX, trainY, {
        epochs: epochs,
        validationData: (typeof testX !== 'undefined') ? [testX, testY] : null,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            // 更新进度条
            const percent = Math.floor(((epoch + 1) / epochs) * 100);
            progressBar.style.width = percent + '%';
            // 保存训练和验证损失用于绘图
            historyLoss.push(logs.loss);
            if (logs.val_loss !== undefined) historyValLoss.push(logs.val_loss);
            // 更新文本显示当前epoch
            progressText.textContent = translations[currentLang]['progressEpoch']
              ? translations[currentLang]['progressEpoch']
                  .replace('{current}', i+1).replace('{total}', configs.length)
                  .replace('{epoch}', epoch+1).replace('{epochs}', epochs)
              : `Run ${i+1}/${configs.length} - Epoch ${epoch+1}/${epochs}`;
          }
        }
      });
      // 训练完成，确保进度条填满
      progressBar.style.width = '100%';
      // 获取预测结果
      if (typeof testX !== 'undefined') {
        const predYTensor = model.predict(testX);
        predTest = Array.from(predYTensor.dataSync());
        actualTest = testYArr.map(v => v[0]);
        predYTensor.dispose();
      }
    } else if (method === 'loocv') {
      // LOOCV: 对每个样本留一，训练模型并预测该样本
      const totalSamples = data.length;
      const epochs = parseInt(epochsInput.value) || 100;
      actualTest = []; predTest = [];
      for (let j = 0; j < data.length; j++) {
        // 构建第j次的训练集（所有样本 except j）
        const trainSubset = data.filter((_, idx) => idx !== j);
        const testSample = data[j];
        const { X: subXArr, Y: subYArr } = prepareXY(trainSubset, featureNames, targetName, categoryMaps, inputDim);
        const subX = tf.tensor2d(subXArr, [subXArr.length, inputDim]);
        const subY = tf.tensor2d(subYArr, [subYArr.length, 1]);
        // 重新初始化模型参数（简单起见，每次重新创建新模型）
        const localModel = tf.sequential();
        localModel.add(tf.layers.dense({
          units: parseInt(neuronsInput.value) || 16,
          activation: activationSelect.value || 'relu',
          inputShape: [inputDim]
        }));
        localModel.add(tf.layers.dense({ units: 1, activation: 'linear' }));
        localModel.compile({
          optimizer: tf.train.adam(parseFloat(learningRateInput.value) || 0.001),
          loss: 'meanSquaredError'
        });
        // 训练模型
        await localModel.fit(subX, subY, { epochs: epochs, shuffle: true });
        // 预测留出的样本
        const testXVec = prepareOneX(testSample, featureNames, categoryMaps, inputDim);
        const pred = localModel.predict(tf.tensor2d(testXVec, [1, inputDim]));
        const predVal = pred.dataSync()[0];
        // 收集预测结果
        predTest.push(predVal);
        actualTest.push(parseFloat(testSample[targetName]));
        // 释放资源
        pred.dispose();
        subX.dispose(); subY.dispose();
        localModel.dispose();
        tf.disposeVariables(); // 清理模型变量
        // 更新进度条（LOOCV整体进度）
        const percent = Math.floor(((j + 1) / totalSamples) * 100);
        progressBar.style.width = percent + '%';
        progressText.textContent = translations[currentLang]['progressLOOCV']
          ? translations[currentLang]['progressLOOCV']
              .replace('{current}', i+1).replace('{total}', configs.length)
              .replace('{done}', j+1).replace('{totalSamples}', totalSamples)
          : `Run ${i+1}/${configs.length} - Processed ${j+1}/${totalSamples} samples`;
      }
      // LOOCV完成，相当于得到整个数据集的预测结果
    }

    // 计算性能指标
    const metrics = calcMetrics(actualTest, predTest);
    // 绘制结果卡片
    const resultCard = document.createElement('div');
    resultCard.className = 'p-4 bg-gray-800 border border-gray-600 rounded-md';
    // 配置标题（验证方法和比例说明）
    const title = document.createElement('h3');
    title.className = 'font-semibold mb-2';
    if (method === 'holdout') {
      const trainPct = Math.round(trainRatio * 100);
      const testPct = 100 - trainPct;
      // 使用翻译模板拼接标题
      if (translations[currentLang]['resultHoldout']) {
        title.textContent = translations[currentLang]['resultHoldout']
          .replace('{trainPct}', trainPct).replace('{testPct}', testPct);
      } else {
        title.textContent = `Holdout (${trainPct}% train / ${testPct}% test)`;
      }
    } else {
      title.textContent = translations[currentLang]['resultLoocv'] || 'LOOCV (Leave-One-Out)';
    }
    resultCard.appendChild(title);
    // 指标列表
    const list = document.createElement('ul');
    for (let key of ['MAE', 'MSE', 'RMSE', 'R2']) {
      const li = document.createElement('li');
      // 指标名称多语言
      const label = translations[currentLang][key] || key;
      li.textContent = `${label}: ${metrics[key]}`;
      list.appendChild(li);
    }
    resultCard.appendChild(list);
    // 图表容器
    if (method === 'holdout' && historyLoss.length > 0) {
      // 损失曲线图
      const lossCanvas = document.createElement('canvas');
      lossCanvas.style.width = '100%';
      lossCanvas.style.height = '300px';
      resultCard.appendChild(lossCanvas);
      drawLossCurve(lossCanvas, historyLoss, historyValLoss, currentLang);
    }
    if (actualTest.length > 0) {
      // 散点图
      const scatterCanvas = document.createElement('canvas');
      scatterCanvas.style.width = '100%';
      scatterCanvas.style.height = '300px';
      resultCard.appendChild(scatterCanvas);
      drawScatterPlot(scatterCanvas, actualTest, predTest, currentLang);
    }
    // 将结果卡片加入页面
    resultsContainer.appendChild(resultCard);
    // 释放tensor资源
    trainX.dispose(); trainY.dispose();
    if (typeof testX !== 'undefined') { testX.dispose(); testY.dispose(); }
    model.dispose();
    tf.disposeVariables();
  } // end for each config

  // 训练全部完成
  startBtn.disabled = false;
  startBtn.classList.remove('opacity-50');
  progressText.textContent = translations[currentLang]['progressComplete'] || 'Training complete';
  // 可选择在几秒后隐藏进度条
  setTimeout(() => { progressSection.style.display = 'none'; }, 2000);
});

// 文件上传处理（假定 HTML 里通过 <input type="file"> 触发，本代码监听到文件并解析）
let uploadedData = null;
let uploadedHeaders = null;
document.getElementById('fileInput')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  // 重置状态
  uploadedData = null;
  progressSection.style.display = 'block';
  progressText.textContent = translations[currentLang]['progressUploading'] || 'Uploading file...';
  progressBar.style.width = '0%';
  // 使用PapaParse解析CSV
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    step: (results, parser) => {
      if (!uploadedData) {
        uploadedData = [];
      }
      uploadedData.push(results.data);
      // 更新进度（使用已处理记录数近似）
      if (results.meta && results.meta.fields && !uploadedHeaders) {
        uploadedHeaders = results.meta.fields;
      }
      if (results.meta) {
        const percent = results.meta.cursor ? Math.floor((results.meta.cursor / file.size) * 100) : 0;
        progressBar.style.width = percent + '%';
      }
    },
    complete: () => {
      progressBar.style.width = '100%';
      progressText.textContent = translations[currentLang]['uploadComplete'] || 'File loaded';
      setTimeout(() => { progressSection.style.display = 'none'; }, 1000);
      // 显示文件名
      document.getElementById('fileNameDisplay').textContent = file.name;
      document.getElementById('fileNameDisplay').removeAttribute('data-i18n');
    },
    error: (err) => {
      console.error('Parse error:', err);
      progressText.textContent = translations[currentLang]['uploadError'] || 'File upload error';
    }
  });
});

// 准备数据集的辅助函数：将对象数组转换为模型输入X和目标Y数组
function prepareXY(dataArray, featureNames, targetName, categoryMaps, inputDim) {
  const X = [];
  const Y = [];
  dataArray.forEach(row => {
    const xVec = prepareOneX(row, featureNames, categoryMaps, inputDim);
    X.push(xVec);
    Y.push([parseFloat(row[targetName]) || 0]);
  });
  return { X, Y };
}

// 将单个数据行转换为输入向量
function prepareOneX(row, featureNames, categoryMaps, inputDim) {
  const xVec = new Array(inputDim).fill(0);
  let offset = 0;
  featureNames.forEach(fname => {
    const categories = categoryMaps[fname];
    const val = row[fname];
    const idx = categories.indexOf(val);
    if (idx >= 0) {
      xVec[offset + idx] = 1;
    }
    offset += categories.length;
  });
  return xVec;
}

// 计算回归指标
function calcMetrics(actualArr, predArr) {
  const n = actualArr.length;
  let mae = 0, mse = 0;
  let sumY = 0;
  actualArr.forEach((y, idx) => {
    const pred = predArr[idx];
    const err = pred - y;
    mae += Math.abs(err);
    mse += err * err;
    sumY += y;
  });
  mae /= n;
  mse /= n;
  const rmse = Math.sqrt(mse);
  // R²计算
  let sst = 0;
  const meanY = sumY / n;
  actualArr.forEach(y => { 
    const diff = y - meanY;
    sst += diff * diff;
  });
  const sse = mse * n;
  const r2 = sst > 0 ? (1 - sse/sst) : 1;
  // 格式化数值（保留三位小数）
  return {
    'MAE': mae.toFixed(3),
    'MSE': mse.toFixed(3),
    'RMSE': rmse.toFixed(3),
    'R2': r2.toFixed(3)
  };
}
