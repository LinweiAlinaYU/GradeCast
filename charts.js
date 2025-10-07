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
  const finiteA=actual.filter(Number.isFinite);
  const finiteP=pred.filter(Number.isFinite);
  const min = Math.min(...finiteA, ...finiteP);
  const max = Math.max(...finiteA, ...finiteP);
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
 * Wright Map
 * - Shared Y axis (logit)
 * - Left: horizontal histogram (persons) in x-domain [0, 0.35]
 * - Right: item difficulties and step thresholds in x-domain [0.45, 1]
 */
export function drawWrightMapAdvanced(divId, thetaVals, itemInfo){
  const div = (typeof divId==='string')? document.getElementById(divId): divId;

  const traces = [];

  // Left domain histogram (persons)
  traces.push({
    xaxis:'x', yaxis:'y',
    type:'histogram', orientation:'h',
    y: thetaVals, // bins along y (logit)
    name:'Persons',
    opacity:0.7,
    marker:{}
  });

  // Right domain: item beta (as squares) + step thresholds (category markers)
  const xItemIndex = itemInfo.items.map((_,i)=>i);
  traces.push({
    xaxis:'x2', yaxis:'y',
    type:'scatter', mode:'markers',
    x: xItemIndex,
    y: itemInfo.beta,
    name:'Items (β)',
    marker:{ symbol:'square', size:7 }
  });

  // colored steps
  const stepSymbols = ['circle','diamond','triangle-up','cross','x','star'];
  itemInfo.steps.forEach((st, idx)=>{
    traces.push({
      xaxis:'x2', yaxis:'y',
      type:'scatter', mode:'markers',
      x: st.xIndex,
      y: st.y,
      name:`cat${st.k-1}/cat${st.k}`,
      marker:{ size:7, symbol: stepSymbols[idx % stepSymbols.length] }
    });
  });

  // layout with two x domains, shared y
  const layout = {
    margin:{t:10,r:10,l:50,b:60},
    showlegend:true,
    legend:{orientation:'h'},
    yaxis:{
      title:'Logits',
      zeroline:true, zerolinecolor:'rgba(255,255,255,0.35)',
      gridcolor:'rgba(255,255,255,0.08)'
    },
    xaxis:{
      domain:[0, 0.35],
      title:'Count',
      gridcolor:'rgba(255,255,255,0.08)'
    },
    xaxis2:{
      domain:[0.45, 1],
      title:'Items / Steps (sorted by β)',
      tickmode:'array',
      tickvals: xItemIndex,
      ticktext: itemInfo.items,
      tickangle: -60,
      gridcolor:'rgba(255,255,255,0.08)'
    },
    shapes:[
      {type:'line', xref:'paper', x0:0, x1:1, yref:'y', y0:0, y1:0, line:{dash:'dot', width:1, color:'rgba(255,255,255,0.4)'}}
    ]
  };

  Plotly.newPlot(div, traces, layout, {displaylogo:false, responsive:true});
}

export function downloadBlob(dataUrl, fileName){
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
