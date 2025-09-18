
const trainFileInput = document.getElementById('train-file-input');
const trainButton = document.getElementById('train-button');
const metricsOutput = document.getElementById('metrics-output');
const chartsOutput = document.getElementById('charts-output');
const trainingResultsSection = document.getElementById('training-results');

let trainData = [], testData = [];

function parseCSVFile(file, onComplete) {
  Papa.parse(file, {
    header: true,      
    dynamicTyping: true,  /
    complete: function(results) {
      if (results.errors.length) {
        console.error("CSV解析错误: ", results.errors);
        alert("CSV文件解析出错，请检查文件格式。");
      } else {
        onComplete(results.data);
      }
    }
  });
}

trainButton.addEventListener('click', () => {
  const file = trainFileInput.files[0];
  if (!file) {
    alert("请先选择训练数据CSV文件！");
    return;
  }

  parseCSVFile(file, (dataRows) => {
    if (dataRows.length === 0) {
      alert("CSV文件内容为空或无法解析数据。");
      return;
    }

    const constructCol = document.getElementById('construct-col').value;
    const formatCol = document.getElementById('format-col').value;
    const scoreCol = document.getElementById('score-col').value;

    let X = [], y = [];
    for (const row of dataRows) {
      if (row[scoreCol] === undefined || row[scoreCol] === null) continue;
      let features = [];
      if (row[constructCol] !== undefined) {
        features.push(row[constructCol]);
      }
      if (row[formatCol] !== undefined) {
        features.push(row[formatCol]);
      }
      
      X.push(features);
      y.push(row[scoreCol]);
    }
    prepareDataset(X, y);
  });
});

function prepareDataset(X, y) {
  const constructSet = new Set();
  const formatSet = new Set();
  X.forEach(features => {
    if (features.length >= 1) constructSet.add(features[0]);
    if (features.length >= 2) formatSet.add(features[1]);
  });
  const constructValues = Array.from(constructSet);
  const formatValues = Array.from(formatSet);
  // 建立类别取值到索引的映射（用于独热编码或数值编码）
  const constructIndexMap = {};
  constructValues.forEach((val, idx) => { constructIndexMap[val] = idx; });
  const formatIndexMap = {};
  formatValues.forEach((val, idx) => { formatIndexMap[val] = idx; });

  let X_processed = [];
  for (const feat of X) {
    let vec = new Array(constructValues.length + formatValues.length).fill(0);
    if (feat[0] !== undefined && constructIndexMap[feat[0]] !== undefined) {
      vec[constructIndexMap[feat[0]]] = 1;
    }
    if (feat[1] !== undefined && formatIndexMap[feat[1]] !== undefined) {
      let offset = constructValues.length;
      vec[offset + formatIndexMap[feat[1]]] = 1;
    }
    X_processed.push(vec);
  }

  const valMethod = document.querySelector('input[name="validation-method"]:checked').value;
  if (valMethod === 'holdout') {
    const trainRatio = parseInt(document.getElementById('train-ratio').value) / 100.0;
    const totalCount = X_processed.length;
    const trainCount = Math.floor(totalCount * trainRatio);
    const indices = Array.from(X_processed.keys());
    tf.util.shuffle(indices); 
    trainData = [], testData = [];
    for (let i = 0; i < totalCount; i++) {
      const idx = indices[i];
      const dataPoint = { X: X_processed[idx], y: y[idx], student: null, format: null };
      if (i < trainCount) {
        trainData.push(dataPoint);
      } else {
        testData.push(dataPoint);
      }
    }
    console.log(`使用Holdout拆分: 训练集 ${trainData.length} 条, 测试集 ${testData.length} 条`);
    startTrainingModel();  
  } else if (valMethod === 'loocv') {
    trainData = X_processed;
    testData = null;
    console.log("使用留一交叉验证进行模型评估");
    startTrainingModel();
  }
}
