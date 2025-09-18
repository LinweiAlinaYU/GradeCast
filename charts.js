/** 绘制残差分布直方图 */
function plotResiduals(residuals) { ... }

/** 绘制每学生RMSE柱状图 */
function plotRmseByStudent(rmseByStudent) { ... }

/** 绘制按题型RMSE柱状图 */
function plotRmseByFormat(rmseByFormat) { ... }

/** 绘制按题型平均偏差(Bias)柱状图 */
function plotBiasByFormat(biasByFormat) { ... }

/** 绘制 Kidmap 热力图 (学生 vs 题目矩阵) */
function plotKidmap(predMatrix, studentList, itemList) { ... }

/** 绘制 Wright Map 图 (题目难度条形图 或 人-题分布) */
function plotWrightMap(itemDifficulties, studentAbilities) { ... }

/** 综合调用上述函数以绘制训练/测试结果图表 */
function plotResults(preds, actuals, studentIds = [], formats = []) {
  // 1. 计算残差数组
  const residuals = preds.map((p, i) => p - actuals[i]);
  plotResiduals(residuals);

  // 2. 计算每学生RMSE
  if (studentIds.length > 0) {
    const rmseByStudent = {};
    studentIds.forEach((stu, i) => {
      const err = residuals[i];
      if (rmseByStudent[stu] === undefined) {
        rmseByStudent[stu] = { sumSq: 0, count: 0 };
      }
      rmseByStudent[stu].sumSq += err * err;
      rmseByStudent[stu].count += 1;
    });
    // 计算RMSE值并准备绘图数据
    const studentLabels = Object.keys(rmseByStudent);
    const studentRmseValues = studentLabels.map(stu => {
      const stats = rmseByStudent[stu];
      return Math.sqrt(stats.sumSq / stats.count);
    });
    plotRmseByStudent({ labels: studentLabels, values: studentRmseValues });
  }

  // 3. 计算按题型RMSE 和 4. Bias
  if (formats.length > 0) {
    const errorByFormat = {};
    formats.forEach((fmt, i) => {
      const err = residuals[i];
      if (errorByFormat[fmt] === undefined) {
        errorByFormat[fmt] = { sumSq: 0, sumErr: 0, count: 0 };
      }
      errorByFormat[fmt].sumSq += err * err;
      errorByFormat[fmt].sumErr += err;
      errorByFormat[fmt].count += 1;
    });
    const formatLabels = Object.keys(errorByFormat);
    const rmseValues = formatLabels.map(fmt => {
      const stats = errorByFormat[fmt];
      return Math.sqrt(stats.sumSq / stats.count);
    });
    const biasValues = formatLabels.map(fmt => {
      const stats = errorByFormat[fmt];
      return stats.sumErr / stats.count;
    });
    plotRmseByFormat({ labels: formatLabels, values: rmseValues });
    plotBiasByFormat({ labels: formatLabels, values: biasValues });
  }
}

function plotResiduals(residuals) {
  const trace = {
    x: residuals,
    type: 'histogram',
    marker: { color: '#7eb6ff' },  // 柱子颜色
    nbinsx: 20  // 可选：指定直方图桶数
  };
  const layout = {
    title: 'Residual Distribution (残差分布)',
    xaxis: { title: 'Residual (预测误差)' },
    yaxis: { title: 'Frequency (频数)' }
  };
  Plotly.newPlot('residual-chart', [trace], layout);
}


function plotRmseByStudent(data) {
  // data: { labels: [...学生ID], values: [...对应RMSE] }
  const trace = {
    x: data.labels,
    y: data.values,
    type: 'bar',
    marker: { color: '#ffbb78' }
  };
  const layout = {
    title: 'RMSE per Student (每学生RMSE)',
    xaxis: { title: 'Student ID', automargin: true },
    yaxis: { title: 'RMSE' }
  };
  Plotly.newPlot('rmse-student-chart', [trace], layout);
}


function plotRmseByFormat(data) {
  const trace = {
    x: data.labels,
    y: data.values,
    type: 'bar',
    marker: { color: '#98df8a' }
  };
  const layout = {
    title: 'RMSE by Item Format (按题型RMSE)',
    xaxis: { title: 'Item Format 类型', automargin: true },
    yaxis: { title: 'RMSE' }
  };
  Plotly.newPlot('rmse-format-chart', [trace], layout);
}

function plotBiasByFormat(data) {
  const trace = {
    x: data.labels,
    y: data.values,
    type: 'bar',
    marker: { color: '#ff9896' }
  };
  const layout = {
    title: 'Bias by Item Format (题型偏差)',
    xaxis: { title: 'Item Format 类型', automargin: true },
    yaxis: { title: 'Mean Error (平均误差)' },
    shapes: [  // 添加y=0参考线
      {
        type: 'line',
        x0: -0.5, x1: data.labels.length - 0.5,
        y0: 0, y1: 0,
        line: { color: 'gray', width: 1, dash: 'dot' }
      }
    ]
  };
  Plotly.newPlot('bias-format-chart', [trace], layout);
}

function plotKidmap(predMatrix, studentList, itemList) {
  // predMatrix: 二维数组 [学生数 × 题目数]，值为预测得分/概率
  const data = [{
    z: predMatrix,
    x: itemList,    // 列标签：题目ID或名称
    y: studentList, // 行标签：学生ID或姓名
    type: 'heatmap',
    colorscale: 'YlGnBu',  // 颜色方案：黄-绿-蓝
    reversescale: false,
    colorbar: { title: 'Predicted Score' }
  }];
  const layout = {
    title: 'Kidmap: Student Performance Heatmap',
    xaxis: { title: 'Item (题目)' },
    yaxis: { title: 'Student (学生)' }
  };
  Plotly.newPlot('kidmap-chart', data, layout);
}


function plotWrightMap(itemDifficulties, studentAbilities = []) {
  // itemDifficulties: { itemLabel: avgPredScore, ... }
  const items = Object.keys(itemDifficulties);
  // 将题目按平均得分从低到高排序（低分=高难度）
  items.sort((a, b) => itemDifficulties[a] - itemDifficulties[b]);
  const avgScores = items.map(item => itemDifficulties[item]);
  const trace = {
    x: items,
    y: avgScores,
    type: 'bar',
    marker: { color: '#c5b0d5' }
  };
  const layout = {
    title: 'Wright Map - Item Difficulty (题目难度)',
    xaxis: { title: 'Item (题目)', automargin: true },
    yaxis: { title: 'Average Predicted Score (平均预测分)' }
  };
  Plotly.newPlot('wright-chart', [trace], layout);
}

