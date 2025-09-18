
function evaluateAndDisplayResults(preds, actuals, model) {
  const n = preds.length;
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

  displayMetrics({ MAE, MAPE, MSE, RMSE, R2, explainedVar, meanError });

  const studentIds = testData.map(d => d.student);
  const formats = testData.map(d => d.format);
  plotResults(preds, actuals, studentIds, formats);
}

function displayMetrics(metrics) {
  metricsOutput.innerHTML = `
    <p>Mean Absolute Error (MAE): ${metrics.MAE.toFixed(3)}</p>
    <p>Mean Absolute Percentage Error (MAPE): ${metrics.MAPE.toFixed(2)}%</p>
    <p>Mean Squared Error (MSE): ${metrics.MSE.toFixed(3)}</p>
    <p>Root Mean Squared Error (RMSE): ${metrics.RMSE.toFixed(3)}</p>
    <p>R² (判定系数): ${metrics.R2.toFixed(3)}</p>
    <p>Explained Variance (解释方差): ${metrics.explainedVar.toFixed(3)}</p>
    <p>Mean Error (平均误差): ${metrics.meanError.toFixed(3)}</p>
  `;
  trainingResultsSection.style.display = "block";  
}
