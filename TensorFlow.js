
function buildModel(inputDim, hiddenUnits, activationFn) {
  const model = tf.sequential();
  model.add(tf.layers.dense({
    inputShape: [inputDim],
    units: hiddenUnits,
    activation: activationFn  
  }));
  model.add(tf.layers.dense({
    units: 1,
    activation: 'linear' 
  }));
  model.compile({
    optimizer: tf.train.adam(),              
    loss: tf.losses.meanSquaredError,        
    metrics: [tf.metrics.meanAbsoluteError]   
  });
  return model;
}

async function startTrainingModel() {
  const hiddenNeurons = parseInt(document.getElementById('hidden-neurons').value);
  const epochCount = parseInt(document.getElementById('epoch-count').value);
  const activationFn = document.getElementById('activation-fn').value;
  const valMethod = document.querySelector('input[name="validation-method"]:checked').value;

  let X_train, y_train, X_test, y_test;
  if (valMethod === 'holdout') {
    X_train = tf.tensor2d(trainData.map(d => d.X));
    y_train = tf.tensor2d(trainData.map(d => d.y), [trainData.length, 1]);
    X_test = tf.tensor2d(testData.map(d => d.X));
    y_test = tf.tensor2d(testData.map(d => d.y), [testData.length, 1]);
  }

  const inputDim = trainData[0].X.length || trainData[0].length; // 特征维度
  console.log(`构建模型: 输入维度=${inputDim}, 隐藏层神经元=${hiddenNeurons}, 激活=${activationFn}`);
  let model = buildModel(inputDim, hiddenNeurons, activationFn);
  model.summary();

  if (valMethod === 'holdout') {
    try {
      await model.fit(X_train, y_train, {
        epochs: epochCount,
        batchSize: 32,
        shuffle: true,
        validationData: [X_test, y_test],
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch+1}/${epochCount}: loss=${logs.loss.toFixed(4)}, MAE=${logs.meanAbsoluteError.toFixed(4)}`);
          }
        }
      });
    } catch (err) {
      console.error("模型训练过程中出错:", err);
      alert("模型训练失败，请检查控制台日志。");
      return;
    }
    console.log("模型训练完成！");
    const predsTensor = model.predict(X_test);
    const preds = Array.from(predsTensor.dataSync()); 
    const actuals = Array.from(y_test.dataSync());
    evaluateAndDisplayResults(preds, actuals, model);
  } else if (valMethod === 'loocv') {
    const allX = trainData;  
    const allY = testData || [] ; 
    const N = allX.length;
    let sumAbsError = 0, sumAbsPctError = 0, sumSqError = 0, sumError = 0;
    const allActuals = [], allPreds = [];
    for (let i = 0; i < N; i++) {
      const X_train_loocv = tf.tensor2d(allX.filter((_, idx) => idx !== i));
      const y_train_loocv = tf.tensor2d(y.filter((_, idx) => idx !== i), [N-1, 1]);
      const X_val_loocv = tf.tensor2d([ allX[i] ]);  
      const y_val_loocv = y[i];
      model = buildModel(inputDim, hiddenNeurons, activationFn);
      try {
        await model.fit(X_train_loocv, y_train_loocv, {
          epochs: epochCount,
          batchSize: Math.min(32, N-1),
          shuffle: true
        });
      } catch (err) {
        console.error(`LOOCV第${i}折训练出错:`, err);
        return;
      }
      const predTensor = model.predict(X_val_loocv);
      const predVal = predTensor.dataSync()[0];
      allPreds.push(predVal);
      allActuals.push(y_val_loocv);
      const err = predVal - y_val_loocv;
      sumAbsError += Math.abs(err);
      if (y_val_loocv !== 0) {
        sumAbsPctError += Math.abs(err / y_val_loocv);
      }
      sumSqError += err * err;
      sumError += err;
      tf.dispose([X_train_loocv, y_train_loocv, X_val_loocv, predTensor]);
      model.dispose();
    }
    const MAE = sumAbsError / N;
    const MAPE = (sumAbsPctError / N) * 100;
    const MSE = sumSqError / N;
    const RMSE = Math.sqrt(MSE);
    const meanActual = allActuals.reduce((a,b) => a+b, 0) / N;
    const SST = allActuals.reduce((sum, y) => sum + Math.pow(y - meanActual, 2), 0);
    const R2 = 1 - (sumSqError / SST);
    const explainedVar = 1 - ( (sumSqError/N) / (SST/N) ); 
    const meanError = sumError / N;
    displayMetrics({
      MAE, MAPE, MSE, RMSE, R2, explainedVar, meanError
    });
    plotResults(allPreds, allActuals, /* group info if needed */);
  }
}
