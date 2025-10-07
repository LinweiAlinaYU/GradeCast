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
 * Wright Map：
 * lift: personal ability（x=Count, y=Logits）
 * Right：Item step（y=阈值 logit，x=按题目索引离散化）
 */
export function drawWrightMap(divId, thetaVals, stepPoints){
  const div = (typeof divId==='string')? document.getElementById(divId): divId;

  // 直方图（水平）
  const hist = {
    y: thetaVals,
    type: 'histogram',
    name: 'Persons',
    marker: {opacity:0.75},
    orientation: 'h',
    xaxis: 'x1',
    yaxis: 'y1'
  };

  // 散点（右侧）
  const scatter = {
    x: stepPoints.map(p=>p.xIndex+1),
    y: stepPoints.map(p=>p.y),
    mode: 'markers',
    name: 'Items (β + steps)',
    xaxis: 'x2',
    yaxis: 'y1',
    text: stepPoints.map(p=>`${p.item} | cat${p.step-1}/cat${p.step}`),
    hovertemplate: 'Item: %{text}<br>Logit: %{y:.3f}<extra></extra>'
  };

  Plotly.newPlot(div, [hist, scatter], {
    margin:{t:30,r:10,l:50,b:50},
    grid: {rows:1, columns:2, subplots:[['xy','x2y1']]},
    xaxis:  {title:'Count', domain:[0,0.35]},
    xaxis2: {title:'Items / Steps (sorted by β)', domain:[0.55,1]},
    yaxis:  {title:'Logits'},
    legend:{orientation:'h'}
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
