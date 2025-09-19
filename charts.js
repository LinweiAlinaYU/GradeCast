/***** charts.js *****/
export function drawLossCurvePlotly(div, trainLoss, valLoss, t){
  const data = [
    { x: trainLoss.map((_,i)=>i+1), y: trainLoss, type:'scatter', name:(t.trainingLoss||'Training Loss') }
  ];
  if (valLoss && valLoss.length) data.push({ x: valLoss.map((_,i)=>i+1), y: valLoss, type:'scatter', name:(t.validationLoss||'Validation Loss') });
  Plotly.newPlot(div, data, {
    margin:{t:30,r:10,l:40,b:35},
    xaxis:{title:(t.epochAxis||'Epoch')},
    yaxis:{title:(t.lossAxis||'Loss')}
  }, {displaylogo:false, responsive:true});
}

export function drawScatterPlotPlotly(div, actual, pred, t){
  const min = Math.min(...actual, ...pred);
  const max = Math.max(...actual, ...pred);
  const data = [
    { x: actual, y: pred, mode:'markers', type:'scatter', name:(t.actualVsPred||'Predicted vs Actual') },
    { x: [min,max], y:[min,max], mode:'lines', name:(t.idealLine||'Ideal (Y=X)') }
  ];
  Plotly.newPlot(div, data, {
    margin:{t:30,r:10,l:40,b:35},
    xaxis:{title:(t.actualAxis||'Actual')},
    yaxis:{title:(t.predictedAxis||'Predicted')}
  }, {displaylogo:false, responsive:true});
}

export function drawWrightMap(divId, thetaVals, itemVals){
  const div = (typeof divId==='string')? document.getElementById(divId): divId;
  const data = [
    { x: thetaVals, type:'histogram', name:'Persons', opacity:0.7 },
    { x: itemVals,  type:'histogram', name:'Items',   opacity:0.7 }
  ];
  Plotly.newPlot(div, data, {
    barmode:'overlay',
    margin:{t:30,r:10,l:40,b:35},
    xaxis:{title:'Logit scale (relative)'},
    yaxis:{title:'Count'},
    legend:{orientation:'h'}
  }, {displaylogo:false, responsive:true});
}

export async function exportPlotPNG(divId, fileName='chart.png'){
  const div = (typeof divId==='string')? document.getElementById(divId): divId;
  const url = await Plotly.toImage(div, {format:'png', height:480, width:720});
  downloadBlob(url, fileName);
}

export function downloadBlob(dataUrl, fileName){
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
