/***** charts.js *****/
export function drawLossCurvePlotly(div, trainLoss, valLoss){
  const data = [
    { x: trainLoss.map((_,i)=>i+1), y: trainLoss, type:'scatter', name:'Training Loss' }
  ];
  if (valLoss && valLoss.length) data.push({ x: valLoss.map((_,i)=>i+1), y: valLoss, type:'scatter', name:'Validation Loss' });
  Plotly.newPlot(div, data, {
    margin:{t:30,r:10,l:40,b:35},
    xaxis:{title:'Epoch'},
    yaxis:{title:'Loss'}
  }, {displaylogo:false, responsive:true});
}

export function drawScatterPlotPlotly(div, actual, pred){
  const min = Math.min(...actual, ...pred);
  const max = Math.max(...actual, ...pred);
  const data = [
    { x: actual, y: pred, mode:'markers', type:'scatter', name:'Predicted vs Actual' },
    { x: [min,max], y:[min,max], mode:'lines', name:'Ideal (Y=X)' }
  ];
  Plotly.newPlot(div, data, {
    margin:{t:30,r:10,l:40,b:35},
    xaxis:{title:'Actual'},
    yaxis:{title:'Predicted'}
  }, {displaylogo:false, responsive:true});
}

/**
 * Wright Map（左：person ability 直方图；右：item step 阈值散点）
 * - x2 轴为类别轴（category），tick 为 ItemID
 * - 每个 step（cat0/1、cat1/2、…）单独一条 trace，颜色/符号区分
 */
export function drawWrightMap(divId, thetaVals, stepPoints, itemOrder, maxStep){
  const div = (typeof divId==='string')? document.getElementById(divId): divId;

  const maxStepFromData = stepPoints.reduce((m,p)=>Math.max(m, Number(p.step)||0), 0);
  maxStep = Math.min(maxStep, maxStepFromData);

  // 左侧：person ability 直方图（水平）
  const hist = {
    y: thetaVals,
    type: 'histogram',
    name: 'Persons',
    marker: {opacity:0.75},
    orientation: 'h',
    xaxis: 'x1',
    yaxis: 'y1',
    hovertemplate: 'θ: %{y:.2f}<br>Count: %{x}<extra></extra>'
  };

  // 右侧：按照 step 分组的散点（x 为 ItemID 分类轴）
  const traces = [];
  // step 从 1..maxStep，对应类别边界 cat(k-1)/cat(k)
  const symbols = ['circle','square','diamond','cross','triangle-up','star','x','triangle-down']; // 自动循环
  for (let s=1; s<=maxStep; s++){
    const pts = stepPoints.filter(p => p.step === s);
    if (!pts.length) continue;
    traces.push({
      x: pts.map(p=>p.item),
      y: pts.map(p=>p.y),
      mode: 'markers',
      type: 'scatter',
      name: `cat${s-1}/${s}`,
      xaxis: 'x2',
      yaxis: 'y1',
      text: pts.map(p=>`${p.item} | cat${s-1}/cat${s}`),
      marker: { size: 8, symbol: symbols[(s-1)%symbols.length] },
      hovertemplate: 'Item: %{x}<br>Step: cat'+(s-1)+'/'+s+'<br>Logit: %{y:.2f}<extra></extra>'
    });
  }

  Plotly.newPlot(div, [hist, ...traces], {
    margin:{t:30,r:10,l:50,b:70},
    grid: {rows:1, columns:2, subplots:[['xy','x2y1']]},
    xaxis:  {title:'Count', domain:[0,0.38]},
    xaxis2: {
      title:'Items (Predicted)',
      domain:[0.52,1],
      type:'category',
      categoryorder:'array',
      categoryarray:itemOrder,
      tickangle:-45
    },
    yaxis:  {title:'Logits'},
    legend:{orientation:'h'},
    hovermode:'closest'
  }, {displaylogo:false, responsive:true});
}

export function downloadBlob(dataUrl, fileName){
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
