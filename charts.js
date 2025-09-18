/***** charts.js *****/
function drawLossCurvePlotly(div, trainLoss, valLoss, lang){
  const data = [
    { x: trainLoss.map((_,i)=>i+1), y: trainLoss, type:'scatter', name:(translations[lang]?.trainingLoss)||'Training Loss' }
  ];
  if (valLoss && valLoss.length) {
    data.push({ x: valLoss.map((_,i)=>i+1), y: valLoss, type:'scatter', name:(translations[lang]?.validationLoss)||'Validation Loss' });
  }
  Plotly.newPlot(div, data, {
    margin:{t:30,r:10,l:40,b:35},
    xaxis:{title:(translations[lang]?.epochAxis)||'Epoch'},
    yaxis:{title:(translations[lang]?.lossAxis)||'Loss'}
  }, {displaylogo:false, responsive:true});
}

function drawScatterPlotPlotly(div, actual, pred, lang){
  const min = Math.min(...actual, ...pred);
  const max = Math.max(...actual, ...pred);
  const data = [
    { x: actual, y: pred, mode:'markers', type:'scatter', name:(translations[lang]?.actualVsPred)||'Predicted vs Actual' },
    { x: [min,max], y:[min,max], mode:'lines', name:(translations[lang]?.idealLine)||'Ideal (Y=X)' }
  ];
  Plotly.newPlot(div, data, {
    margin:{t:30,r:10,l:40,b:35},
    xaxis:{title:(translations[lang]?.actualAxis)||'Actual'},
    yaxis:{title:(translations[lang]?.predictedAxis)||'Predicted'}
  }, {displaylogo:false, responsive:true});
}

function drawWrightMap(divId, thetaVals, itemVals, lang){
  const div = (typeof divId==='string')? document.getElementById(divId): divId;
  const data = [
    { x: thetaVals, type:'histogram', name:'Persons', orientation:'v', opacity:0.7 },
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
