
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

/** 构建TensorFlow.js顺序模型 (ANN) */
function buildModel(inputDim, hiddenUnits, activationFn) {
  const model = tf.sequential();
  // 输入层->隐藏层
  model.add(tf.layers.dense({
    inputShape: [inputDim],
    units: hiddenUnits,
    activation: activationFn  // 例如 'relu' 或 'sigmoid'
  }));
  // 隐藏层->输出层
  model.add(tf.layers.dense({
    units: 1,
    activation: 'linear'  // 线性输出，用于回归。如果预测分类可改为sigmoid等
  }));
  // 配置模型的优化器和损失函数
  model.compile({
    optimizer: tf.train.adam(),               // Adam优化器
    loss: tf.losses.meanSquaredError,         // 均方误差损失:contentReference[oaicite:12]{index=12}
    metrics: [tf.metrics.meanAbsoluteError]   // 指标: MAE（可根据需要添加）
  });
  return model;
}

/** 开始训练模型 (根据选择的验证方案执行不同流程) */
async function startTrainingModel() {
  // 从参数表单获取设置
  const hiddenNeurons = parseInt(document.getElementById('hidden-neurons').value);
  const epochCount = parseInt(document.getElementById('epoch-count').value);
  const activationFn = document.getElementById('activation-fn').value;
  const valMethod = document.querySelector('input[name="validation-method"]:checked').value;

  // 准备训练数据张量 (对于holdout，我们有trainData数组; 对于loocv，将每轮动态生成)
  let X_train, y_train, X_test, y_test;
  if (valMethod === 'holdout') {
    // 提取训练集特征和标签，转换为tf.tensor2d
    X_train = tf.tensor2d(trainData.map(d => d.X));
    y_train = tf.tensor2d(trainData.map(d => d.y), [trainData.length, 1]);
    X_test = tf.tensor2d(testData.map(d => d.X));
    y_test = tf.tensor2d(testData.map(d => d.y), [testData.length, 1]);
  }

  // 构建模型
  const inputDim = trainData[0].X.length || trainData[0].length; // 特征维度
  console.log(`构建模型: 输入维度=${inputDim}, 隐藏层神经元=${hiddenNeurons}, 激活=${activationFn}`);
  let model = buildModel(inputDim, hiddenNeurons, activationFn);
  // 输出模型摘要（可选，可用tfjs-vis或console查看）
  model.summary();

  if (valMethod === 'holdout') {
    // **Holdout 验证**: 直接使用划分好的训练集训练，测试集评估
    try {
      // 训练模型
      await model.fit(X_train, y_train, {
        epochs: epochCount,
        batchSize: 32,
        shuffle: true,
        validationData: [X_test, y_test],
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch+1}/${epochCount}: loss=${logs.loss.toFixed(4)}, MAE=${logs.meanAbsoluteError.toFixed(4)}`);
            // 可选：在界面上显示训练进度，比如进度条或当前loss
          }
        }
      });
    } catch (err) {
      console.error("模型训练过程中出错:", err);
      alert("模型训练失败，请检查控制台日志。");
      return;
    }
    console.log("模型训练完成！");
    // 在测试集上进行预测
    const predsTensor = model.predict(X_test);
    const preds = Array.from(predsTensor.dataSync());  // 将预测结果Tensor转为JS数组
    const actuals = Array.from(y_test.dataSync());
    // 计算各项评估指标并显示结果
    evaluateAndDisplayResults(preds, actuals, model);
  } else if (valMethod === 'loocv') {
    // **留一交叉验证**: 每次留一条做测试，其余做训练，重复N次
    const allX = trainData;  // trainData在LOOCV模式下存的是整个数据集特征二维数组
    const allY = testData || [] ; // 这里为了通用把testData复用，在LOOCV中未用
    const N = allX.length;
    let sumAbsError = 0, sumAbsPctError = 0, sumSqError = 0, sumError = 0;
    const allActuals = [], allPreds = [];
    // LOOCV 循环
    for (let i = 0; i < N; i++) {
      // 切分训练和验证集: 第i条作为验证，其它作为训练
      const X_train_loocv = tf.tensor2d(allX.filter((_, idx) => idx !== i));
      const y_train_loocv = tf.tensor2d(y.filter((_, idx) => idx !== i), [N-1, 1]);
      const X_val_loocv = tf.tensor2d([ allX[i] ]);  // 留出的第i条
      const y_val_loocv = y[i];
      // 构建并训练模型（每次需新建模型，因为每轮训练独立进行）
      model = buildModel(inputDim, hiddenNeurons, activationFn);
      try {
        await model.fit(X_train_loocv, y_train_loocv, {
          epochs: epochCount,
          batchSize: Math.min(32, N-1),
          shuffle: true
          // LOOCV我们不需要专门验证集，每轮最后直接预测第i条即可
        });
      } catch (err) {
        console.error(`LOOCV第${i}折训练出错:`, err);
        return;
      }
      // 用训练好的模型预测第i条
      const predTensor = model.predict(X_val_loocv);
      const predVal = predTensor.dataSync()[0];
      allPreds.push(predVal);
      allActuals.push(y_val_loocv);
      // 累积误差用于之后计算平均指标
      const err = predVal - y_val_loocv;
      sumAbsError += Math.abs(err);
      if (y_val_loocv !== 0) {
        sumAbsPctError += Math.abs(err / y_val_loocv);
      }
      sumSqError += err * err;
      sumError += err;
      // 清理内存中的tensor以防止内存泄露
      tf.dispose([X_train_loocv, y_train_loocv, X_val_loocv, predTensor]);
      model.dispose();
    }
    // 所有折验证完毕，计算平均指标
    const MAE = sumAbsError / N;
    const MAPE = (sumAbsPctError / N) * 100;
    const MSE = sumSqError / N;
    const RMSE = Math.sqrt(MSE);
    const meanActual = allActuals.reduce((a,b) => a+b, 0) / N;
    const SST = allActuals.reduce((sum, y) => sum + Math.pow(y - meanActual, 2), 0);
    const R2 = 1 - (sumSqError / SST);
    const explainedVar = 1 - ( (sumSqError/N) / (SST/N) );  // 解释方差，可与R2相同
    const meanError = sumError / N;
    // 显示LOOCV平均指标（此模式下模型已重新初始化多次，不保留最终模型）
    displayMetrics({
      MAE, MAPE, MSE, RMSE, R2, explainedVar, meanError
    });
    // 存储预测和实际以便后续绘图分析（LOOCV情况下allPreds与allActuals为数组）
    plotResults(allPreds, allActuals, /* group info if needed */);
  }
}

/** 计算指标并更新页面显示 (针对Holdout模式) */
function evaluateAndDisplayResults(preds, actuals, model) {
  const n = preds.length;
  // 计算各项指标
  let sumAbsErr = 0, sumAbsPctErr = 0, sumSqErr = 0, sumErr = 0;
  for (let i = 0; i < n; i++) {
    const err = preds[i] - actuals[i];
    sumAbsErr += Math.abs(err);
    if (actuals[i] !== 0) {
      sumAbsPctErr += Math.abs(err / actuals[i]);
    }
    sumSqErr += err * err;
    sumErr += err;
  }
  const MAE = sumAbsErr / n;
  const MAPE = (sumAbsPctErr / n) * 100;
  const MSE = sumSqErr / n;
  const RMSE = Math.sqrt(MSE);
  const meanActual = actuals.reduce((a,b) => a+b, 0) / n;
  const SST = actuals.reduce((sum, y) => sum + Math.pow(y - meanActual, 2), 0);
  const R2 = 1 - (sumSqErr / SST);
  const explainedVar = 1 - ((sumSqErr/n) / (SST/n));
  const meanError = sumErr / n;

  // 将结果显示到页面
  displayMetrics({ MAE, MAPE, MSE, RMSE, R2, explainedVar, meanError });

  // 生成可视化图表
  // 准备附加信息用于分组误差: 学生ID和题型
  const studentIds = testData.map(d => d.student);
  const formats = testData.map(d => d.format);
  plotResults(preds, actuals, studentIds, formats);
}

/** 将指标数据obj显示在页面metricsOutput容器 */
function displayMetrics(metrics) {
  // 格式化输出
  metricsOutput.innerHTML = `
    <p>Mean Absolute Error (MAE): ${metrics.MAE.toFixed(3)}</p>
    <p>Mean Absolute Percentage Error (MAPE): ${metrics.MAPE.toFixed(2)}%</p>
    <p>Mean Squared Error (MSE): ${metrics.MSE.toFixed(3)}</p>
    <p>Root Mean Squared Error (RMSE): ${metrics.RMSE.toFixed(3)}</p>
    <p>R² (判定系数): ${metrics.R2.toFixed(3)}</p>
    <p>Explained Variance (解释方差): ${metrics.explainedVar.toFixed(3)}</p>
    <p>Mean Error (平均误差): ${metrics.meanError.toFixed(3)}</p>
  `;
  trainingResultsSection.style.display = "block";  // 确保结果区可见
}

const predictFileInput = document.getElementById('predict-file-input');
const predictButton = document.getElementById('predict-button');
const predictionSection = document.getElementById('prediction-section');
const predictionResultsDiv = document.getElementById('prediction-results');
const predictionMetricsDiv = document.getElementById('prediction-metrics');

predictButton.addEventListener('click', () => {
  const file = predictFileInput.files[0];
  if (!file) {
    alert("请选择要预测的新数据CSV文件！");
    return;
  }
  if (!window.trainedModel) {
    alert("请先训练模型再进行预测！");
    return;
  }
  // 解析预测数据CSV
  parseCSVFile(file, (dataRows) => {
    if (dataRows.length === 0) {
      alert("预测数据CSV为空。");
      return;
    }
    // 提取并转换特征（应与训练时相同处理流程）
    const X_new = [];
    const studentList = [];
    const itemList = [];
    for (const row of dataRows) {
      // 这里假定预测CSV包含 Student 和 Item 列，以及Construct, ItemFormat等
      const constructVal = row[document.getElementById('construct-col').value];
      const formatVal = row[document.getElementById('format-col').value];
      // 若模型独热向量需要固定大小，我们应使用训练时的constructIndexMap和formatIndexMap
      let vec = new Array(/* same length as training inputDim */).fill(0);
      if (constructIndexMap[constructVal] !== undefined) {
        vec[constructIndexMap[constructVal]] = 1;
      }
      if (formatIndexMap[formatVal] !== undefined) {
        const offset = Object.keys(constructIndexMap).length;
        vec[offset + formatIndexMap[formatVal]] = 1;
      }
      X_new.push(vec);
      studentList.push(row['StudentID'] || row['Student'] || `Student${rowIndex}`);
      itemList.push(row['ItemID'] || row['Item'] || `Item${rowIndex}`);
      // 注意：以上获取Student和Item字段名需要根据CSV调整，这里做了简单假设
    }
    // 转为tensor并预测
    const X_new_tensor = tf.tensor2d(X_new);
    const predsTensor = window.trainedModel.predict(X_new_tensor);
    const predsArray = Array.from(predsTensor.dataSync());
    tf.dispose([X_new_tensor, predsTensor]);  // 释放张量
    // 整理Kidmap矩阵数据: 假定CSV中每行是一个student-item组合
    // 首先获取唯一的学生列表和题目列表
    const uniqueStudents = [...new Set(studentList)];
    const uniqueItems = [...new Set(itemList)];
    // 初始化矩阵
    const matrix = Array.from({ length: uniqueStudents.length }, () => 
                   new Array(uniqueItems.length).fill(null));
    // 填入预测值
    dataRows.forEach((row, idx) => {
      const stu = studentList[idx];
      const it = itemList[idx];
      const i = uniqueStudents.indexOf(stu);
      const j = uniqueItems.indexOf(it);
      matrix[i][j] = predsArray[idx];
    });
    // 计算题目平均分 & 学生平均分
    const itemDifficulty = {};
    uniqueItems.forEach((item, j) => {
      let sum = 0, count = 0;
      matrix.forEach((row) => {
        if (row[j] != null) { sum += row[j]; count += 1; }
      });
      itemDifficulty[item] = (count > 0 ? sum/count : 0);
    });
    const studentAbility = {};
    uniqueStudents.forEach((stu, i) => {
      let sum = 0, count = 0;
      matrix[i].forEach((val) => {
        if (val != null) { sum += val; count += 1; }
      });
      studentAbility[stu] = (count > 0 ? sum/count : 0);
    });
    // 输出简单汇总指标（如平均预测得分）
    const overallAvg = predsArray.reduce((a,b)=>a+b,0) / predsArray.length;
    predictionMetricsDiv.innerHTML = `<p>平均预测得分: ${overallAvg.toFixed(2)}</p>`;
    predictionResultsDiv.style.display = "block";
    // 绘制Kidmap和Wright Map
    plotKidmap(matrix, uniqueStudents, uniqueItems);
    plotWrightMap(itemDifficulty, studentAbility);
  });
});

