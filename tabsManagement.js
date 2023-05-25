import {myDiagram} from './editor.js';

// Where the tab data is stored
const tabs = [];

// Creates an array of series keys
function seriesKeys(){
  var data = myDiagram.model.toJson();
  var json = JSON.parse(data);
  let nodes = json.nodeDataArray; // Want only the array of nodes

  const series = ["time"]; // time as an option
  var s = 1;  // The index of the series
  for(let i = 0; i < nodes.length; i++){
    if(nodes[i].category == "stock" || nodes[i].category == "variable" || nodes[i].category == "valve"){ // Only stocks, variables, and flows
      series[s] = nodes[i].key; // Puts the key in the array
      s++;
    }
  }
  return series;
}

// Adds the options for the x and y axes
function addOptions(){
  const series = seriesKeys();
  let x = document.getElementById("xAxis"); // refers to x-axis select node
  let y = document.getElementById("yAxis"); // refers to y-axis div node
  
  // Configuration for x-axis
  for(let i = 0; i < series.length; i++){
    const opt = document.createElement("option"); // Creates an option
    var node = document.createTextNode(series[i]); // Assigns text node (used exterally)
    opt.appendChild(node);
    opt.value = series[i]; // Assigns value (used interally)

    x.appendChild(opt);
  }

  // Configuration for y-axis
  for(let i = 1; i < series.length; i++){ // do not want to include time
    const row = document.createElement("tr"); // row for input
    const d1 = document.createElement("td"); // where checkboxes will go
    const d2 = document.createElement("td"); // where labels will go
    
    const opt = document.createElement("input"); // Creates an input
    opt.type = "checkbox"; // The input is a checkbox
    opt.value = series[i];
    opt.name = "yAxis";
    d1.appendChild(opt);

    const label = document.createElement("label"); // Creates a label
    label.for = i;
    var node = document.createTextNode(series[i]); // Assigns text node to label
    label.appendChild(node);
    d2.appendChild(label);

    // putting into the table
    row.appendChild(d1);
    row.appendChild(d2);
    y.appendChild(row);
  }
}

// Opens and initializes the form popup
function openForm(){
  addOptions(); // dtnamically adds in the options
  let form = document.getElementById("popForm");
  form.style.display = "block"; // display form
}

// Will validate and add tab data
function submit(){
  let inputs = document.getElementsByTagName('input');
  for (let i = 0; i < inputs.length; i++) {
    if (inputs.item(i).type == 'checkbox') {
      if (inputs.item(i).checked == true){
        initializeTab(); // add data if valid
        return false; // want to return false to disable default submission
      }
    }
  }
  alert("At least one box must be checked."); // no alert if at least one is checked
}

// Resets the options so that it updates the options
function resetOptions(){
  let x = document.getElementById("xAxis"); // refers to x-axis select node
  while (x.firstChild) { // removes all child elements
    x.removeChild(x.lastChild);
  }

  let y = document.getElementById("yAxis"); // refers to y-axis div node
  while (y.firstChild) { // removes all child elements
    y.removeChild(y.lastChild);
  }
}

// Enter objects into tabs data array
function initializeTab() {
  let form = document.forms["tabConfig"];

  // gets all y axis values
  var ySeries = [];
  var s = 0;
  let inputs = document.getElementsByTagName('input');
  for (let i = 0; i < inputs.length; i++) {
    if (inputs.item(i).type == 'checkbox') {
      if (inputs.item(i).checked == true){
        ySeries[s] = inputs.item(i).value;
        s++;
      }
    }
  }

  var tab = new Graphic(form["model_type"].value, form["xAxis"].value, ySeries); // initializes the Graphic object
  tabs[tabs.length] = tab; // add to end of array
  document.getElementById("popForm").style.display = "none"; // hide form
  form.reset(); // reset input
  resetOptions(); // reset options

  console.log(tabs); // TO DO: delete later
}

// Object class to create charts and tables
class Graphic{
  constructor(type, xAxis, yAxis){
    this.type = type;
    this.xAxis = xAxis;
    this.yAxis = yAxis;
  }
}

// Event listeners
document.getElementById("addTab").addEventListener("click", function() { openForm(); });
document.getElementById("submitModel").addEventListener("click", function() { submit(); });