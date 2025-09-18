/***** charts.js *****/
// 绘制训练/验证损失曲线图
function drawLossCurve(canvas, trainLosses, valLosses, lang) {
  const ctx = canvas.getContext('2d');
  const labels = trainLosses.map((_, i) => i + 1);  // X轴为Epoch序号
  const datasets = [
    {
      label: translations[lang]['trainingLoss'] || 'Training Loss',
      data: trainLosses,
      borderColor: '#38bdf8',  // 蓝色
      backgroundColor: '#38bdf8',
      fill: false,
      tension: 0.1
    }
  ];
  if (valLosses && valLosses.length > 0) {
    datasets.push({
      label: translations[lang]['validationLoss'] || 'Validation Loss',
      data: valLosses,
      borderColor: '#a78bfa',  // 紫色
      backgroundColor: '#a78bfa',
      fill: false,
      tension: 0.1
    });
  }
  new Chart(ctx, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: translations[lang]['epochAxis'] || 'Epoch'
          },
          ticks: { color: '#ccc' }
        },
        y: {
          title: {
            display: true,
            text: translations[lang]['lossAxis'] || 'Loss'
          },
          ticks: { color: '#ccc' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#ccc' }
        }
      }
    }
  });
}

// 绘制实际 vs 预测散点图
function drawScatterPlot(canvas, actual, predicted, lang) {
  const ctx = canvas.getContext('2d');
  const dataPoints = actual.map((val, idx) => ({ x: val, y: predicted[idx] }));
  // 计算对角线范围
  const allValues = actual.concat(predicted);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const linePoints = [
    { x: minVal, y: minVal },
    { x: maxVal, y: maxVal }
  ];
  new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: translations[lang]['actualVsPred'] || 'Predicted vs Actual',
          data: dataPoints,
          backgroundColor: '#facc15'  // 黄色点
        },
        {
          label: translations[lang]['idealLine'] || 'Ideal (Y=X)',
          data: linePoints,
          type: 'line',
          borderColor: '#6b7280',  // 灰色线
          borderDash: [5,5],
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: translations[lang]['actualAxis'] || 'Actual'
          },
          min: minVal,
          max: maxVal,
          ticks: { color: '#ccc' }
        },
        y: {
          title: {
            display: true,
            text: translations[lang]['predictedAxis'] || 'Predicted'
          },
          min: minVal,
          max: maxVal,
          ticks: { color: '#ccc' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#ccc' }
        }
      }
    }
  });
}
