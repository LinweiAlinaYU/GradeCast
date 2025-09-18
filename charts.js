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
