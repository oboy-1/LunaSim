/* Author: Karthik S. Vedula, adapted from https://gojs.net/latest/samples/systemDynamics.html
 * This file uses the GoJS library to create a system dynamics editor.  Additionally, there is an equation editing table, 
 * which allows the user to edit the equations and characteristics of the objects in the model.
 */

// TODO: test save function (with uniflow)
// TODO: have the diagram remember the last position of the overall diagram (panning) 

import { Simulation } from "./engine.js";
import { translate } from "./translator.js";
import { CurvedLinkReshapingTool } from "./CurvedLinkReshapingTool.js";

// SD is a global variable, to avoid polluting global namespace and to make the global
// nature of the individual variables obvious.
var SD = {
    mode: "pointer",   // Set to default mode.  Alternatives are "node" and "link", for
    // adding a new node or a new link respectively.
    itemType: "pointer",    // Set when user clicks on a node or link button.
    nodeCounter: { stock: 0, cloud: 0, variable: 0, valve: 0 }
};

var myDiagram;   // Declared as global
var sim = new Simulation();

function init() {

    // Since 2.2 you can also author concise templates with method chaining instead of GraphObject.make
    // For details, see https://gojs.net/latest/intro/buildingObjects.html
    const $ = go.GraphObject.make;

    myDiagram = $(go.Diagram, "myDiagram",
        {
            "undoManager.isEnabled": true,
            allowLink: false,  // linking is only started via buttons, not modelessly
            "animationManager.isEnabled": false,

            "linkingTool.portGravity": 0,  // no snapping while drawing new links
            "linkingTool.doActivate": function () {  // an override must be function, not using => ES6 shorthand
                // change the curve of the LinkingTool.temporaryLink
                this.temporaryLink.curve = (SD.itemType === "flow") ? go.Link.None : go.Link.Bezier;
                this.temporaryLink.path.stroke = (SD.itemType === "flow") ? "green" : "orange";
                this.temporaryLink.path.strokeWidth = (SD.itemType === "flow") ? 5 : 1;
                go.LinkingTool.prototype.doActivate.call(this);
            },
            "linkReshapingTool": new CurvedLinkReshapingTool(),
            // override the link creation process
            "linkingTool.insertLink": function (fromnode, fromport, tonode, toport) {  // method override must be function, not =>
                // to control what kind of Link is created,
                // change the LinkingTool.archetypeLinkData's category
                myDiagram.model.setCategoryForLinkData(this.archetypeLinkData, SD.itemType);
                // Whenever a new Link is drawng by the LinkingTool, it also adds a node data object
                // that acts as the label node for the link, to allow links to be drawn to/from the link.
                this.archetypeLabelNodeData = (SD.itemType === "flow") ? { category: "valve" } : null;
                // also change the text indicating the condition, which the user can edit
                this.archetypeLinkData.text = SD.itemType;

                // only allow flow links from a stock or cloud and to a stock or cloud
                if (SD.itemType === "flow" && (fromnode.category !== "stock" && fromnode.category !== "cloud" || tonode.category !== "stock" && tonode.category !== "cloud")) {
                    return null;
                }

                // do not allow influences to go into a stock or a cloud
                if (SD.itemType === "influence" && (tonode.category === "stock" || tonode.category === "cloud")) {
                    return null;
                }

                return go.LinkingTool.prototype.insertLink.call(this, fromnode, fromport, tonode, toport);
            },

            "clickCreatingTool.archetypeNodeData": {},  // enable ClickCreatingTool
            "clickCreatingTool.isDoubleClick": false,   // operates on a single click in background
            // but only in "node" creation mode
            "clickCreatingTool.canStart": function () {  // method override must be function, not =>
                return SD.mode === "node" && go.ClickCreatingTool.prototype.canStart.call(this);
            },
            // customize the data for the new node (even includes valve of a flow link)
            "clickCreatingTool.insertPart": function (loc) {  // method override must be function, not =>
                SD.nodeCounter[SD.itemType] += 1;
                var newNodeId = SD.itemType + SD.nodeCounter[SD.itemType];

                while (myDiagram.model.findNodeDataForKey(newNodeId) !== null) { // make sure the key is unique
                    SD.nodeCounter[SD.itemType] += 1;
                    newNodeId = SD.itemType + SD.nodeCounter[SD.itemType];
                }

                this.archetypeNodeData = {
                    key: newNodeId,
                    category: SD.itemType,
                    label: newNodeId
                };
                return go.ClickCreatingTool.prototype.insertPart.call(this, loc);
            }
        });

    // install the NodeLabelDraggingTool as a "mouse move" tool
    myDiagram.toolManager.mouseMoveTools.insertAt(0, new NodeLabelDraggingTool());

    // add panning
    myDiagram.toolManager.panningTool.isEnabled = true;
    // store the last mouse-down event's position
    // disable drag selection
    myDiagram.toolManager.dragSelectingTool.isEnabled = false;

    // when the document is modified, add a "*" to the title
    myDiagram.addDiagramListener("Modified", e => {
        document.title = document.title.replace(/\*.*/, "");
    });

    // add input listener which updates the table whenever the diagram model changes
    myDiagram.addModelChangedListener(e => {
        // ignore unimportant Transaction events
        if (!e.isTransactionFinished) return;
        updateTable();
    });

    // generate unique label for valve on newly-created flow link
    myDiagram.addDiagramListener("LinkDrawn", e => {
        var link = e.subject;
        if (link.category === "flow") {
            myDiagram.startTransaction("updateNode");
            SD.nodeCounter.valve += 1;
            var newNodeId = "flow" + SD.nodeCounter.valve;

            while (myDiagram.model.findLinkDataForKey(newNodeId) !== null) { // make sure the key is unique
                SD.nodeCounter.valve += 1;
                newNodeId = "flow" + SD.nodeCounter.valve;
            }

            var labelNode = link.labelNodes.first();
            myDiagram.model.setDataProperty(labelNode.data, "label", newNodeId);
            myDiagram.commitTransaction("updateNode");

            updateTable(); // add new row to table
            loadTableToDiagram(); // update diagram with new table data
        }
    });

    buildTemplates();

    load();
}

function buildTemplates() {

    // Since 2.2 you can also author concise templates with method chaining instead of GraphObject.make
    // For details, see https://gojs.net/latest/intro/buildingObjects.html
    const $ = go.GraphObject.make;

    // helper functions for the templates
    function nodeStyle() {
        return [
            {
                type: go.Panel.Spot,
                layerName: "Background",
                locationObjectName: "SHAPE",
                selectionObjectName: "SHAPE",
                locationSpot: go.Spot.Center
            },
            new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify)
        ];
    }

    function shapeStyle() {
        return {
            name: "SHAPE",
            stroke: "black",
            fill: "#f0f0f0",
            portId: "", // So a link can be dragged from the Node: see /GraphObject.html#portId
            fromLinkable: true,
            toLinkable: true
        };
    }

    function textStyle() {
        return [
            {
                font: "bold 11pt helvetica, bold arial, sans-serif",
                margin: 2,
                editable: true
            },
            new go.Binding("text", "label").makeTwoWay()
        ];
    }

    // Node templates
    myDiagram.nodeTemplateMap.add("stock",
        $(go.Node, nodeStyle(),
            $(go.Shape, shapeStyle(),
                { desiredSize: new go.Size(50, 30) }),
            $(go.TextBlock, textStyle(),
                {
                    _isNodeLabel: true,  // declare draggable by NodeLabelDraggingTool
                    alignment: new go.Spot(0.5, 0.5, 0, 30)    // initial value
                },
                new go.Binding("alignment", "label_offset", go.Spot.parse).makeTwoWay(go.Spot.stringify))
        ));

    myDiagram.nodeTemplateMap.add("cloud",
        $(go.Node, nodeStyle(),
            $(go.Shape, shapeStyle(),
                {
                    figure: "Cloud",
                    desiredSize: new go.Size(30, 30)
                })
        ));

    myDiagram.nodeTemplateMap.add("valve",
        $(go.Node, nodeStyle(),
            {
                movable: false,
                layerName: "Foreground",
                alignmentFocus: go.Spot.None
            },
            $(go.Shape, shapeStyle(),
                {
                    figure: "Diamond",
                    desiredSize: new go.Size(15, 15),
                    fill: "#3489eb"
                }),
            $(go.TextBlock, textStyle(),
                {
                    _isNodeLabel: true,  // declare draggable by NodeLabelDraggingTool
                    alignment: new go.Spot(0.5, 0.5, 0, 20)    // initial value
                },
                new go.Binding("alignment", "label_offset", go.Spot.parse).makeTwoWay(go.Spot.stringify))
        ));

    myDiagram.nodeTemplateMap.add("variable",
        $(go.Node, nodeStyle(),
            $(go.Shape, shapeStyle(),
                {
                    figure: "Ellipse",
                    desiredSize: new go.Size(25, 25)
                }),
            $(go.TextBlock, textStyle(),
                {
                    _isNodeLabel: true,  // declare draggable by NodeLabelDraggingTool
                    alignment: new go.Spot(0.5, 0.5, 0, 30)    // initial value
                },
                new go.Binding("alignment", "label_offset", go.Spot.parse).makeTwoWay(go.Spot.stringify))
        ));

    // Link templates
    myDiagram.linkTemplateMap.add("flow",
        $(go.Link,
            { toShortLength: 10 },
            new go.Binding("curviness", "curviness").makeTwoWay(),
            $(go.Shape,
                { stroke: "#3489eb", strokeWidth: 5 }),
            $(go.Shape,
                // add a binding to adjust if this shape is visible based on isBiflow function
                new go.Binding("visible", "", isBiflow),
                {
                    fill: "#3489eb",
                    stroke: "#3489eb",
                    fromArrow: "Backward",
                    scale: 2.0,
                }),
            $(go.Shape,
                {
                    fill: "#3489eb",
                    stroke: "#3489eb",
                    toArrow: "Standard",
                    scale: 2.0
                })
        ));

    myDiagram.linkTemplateMap.add("influence",
        $(go.Link,
            { curve: go.Link.Bezier, toShortLength: 8, reshapable: true },
            new go.Binding("curviness", "curviness").makeTwoWay(),
            $(go.Shape,
                { stroke: "orange", strokeWidth: 1.5 }),
            $(go.Shape,
                {
                    fill: "orange",
                    stroke: null,
                    toArrow: "Standard",
                    scale: 1.5
                })
        ));
}

// set the mode (adding stock vs adding flow vs pointer etc) based on which button is clicked
function setMode(mode, itemType) {
    myDiagram.startTransaction();
    document.getElementById(SD.itemType + "_button").className = SD.mode + "_normal";
    document.getElementById(itemType + "_button").className = mode + "_selected";
    SD.mode = mode;
    SD.itemType = itemType;
    if (mode === "pointer") {
        myDiagram.allowLink = false;
        myDiagram.nodes.each(n => n.port.cursor = "");
    } else if (mode === "node") {
        myDiagram.allowLink = false;
        myDiagram.nodes.each(n => n.port.cursor = "");
    } else if (mode === "link") {
        myDiagram.allowLink = true;
        myDiagram.nodes.each(n => n.port.cursor = "pointer");
    }
    myDiagram.commitTransaction("mode changed");
}

function load() {
    // empty the table 
    $('#eqTableBody').empty();
    myDiagram.model = go.Model.fromJson(document.getElementById("mySavedModel").value); // load in the model config to GoJS diagram
    updateTable(true); // load in the information to the equation editing table
    loadTableToDiagram(); // bring the table information into the model json (for updating uniflow arrows)
}

// populates model json with tabel information (not just for saving model in the end, instead gets called every time the table is updated)
function loadTableToDiagram() {
    // get the json from the GoJS model
    var data = myDiagram.model.toJson();
    var json = JSON.parse(data);

    var $tbody = $('#eqTableBody');

    // read the equation, and checkbox values from the table
    $tbody.find('tr').each(function () {
        var name = $(this).find('input[name="name"]').val(); // get the name of the object
        var equation = $(this).find('input[name="equation"]').val(); // get the equation of the object
        var checkbox = $(this).find('input[name="checkbox"]').is(':checked'); // get the checkbox value of the object

        // update the json with the new equation and checkbox values
        $.each(json.nodeDataArray, function (i, item) {
            if (item.label === name) {
                item.equation = equation;
                item.checkbox = checkbox;
            }
        });
    }
    );

    // get current diagram.position
    var pos = myDiagram.position;

    // update the model with the new json
    myDiagram.model = go.Model.fromJson(JSON.stringify(json));
    // set the diagram position back to what it was
    myDiagram.initialPosition = pos;

    // change the textbox on bottom to the new json
    document.getElementById("mySavedModel").value = myDiagram.model.toJson();
}

// This function is used to update the equation editing table with the current model information
// load is a boolean that is true if the function is called when the model is first loaded, as then the equations and checkboxes have to be populated
function updateTable(load = false) {
    var data = myDiagram.model.toJson();
    var json = JSON.parse(data);

    // get tbody by id eqTableBody
    var $tbody = $('#eqTableBody');

    // 1. add new items to table
    $.each(json.nodeDataArray, function (i, item) { // includes stocks, variables, and clouds

        // check if item already exists in table, if not add it
        var exists = false;
        $tbody.find('tr').each(function () {
            if ($(this).find('input[name="name"]').val() === item.label) {
                exists = true;
            }
        });

        if ((item.category === "stock" || item.category === "variable" || item.category === "valve") && !exists) {
            var category = item.category == "valve" ? "flow" : item.category; // if the item is a valve, change the category to flow

            var $tr = $('<tr>').append(
                $('<td>').append(
                    $('<input>').attr('type', 'text').attr('name', 'type').attr('value', category).attr('readonly', true) // add the type of the object to the row (uneditable by user)
                ),
                $('<td>').append(
                    $('<input>').attr('type', 'text').attr('name', 'name').attr('value', item.label).attr('readonly', true) // add the name of the object to the row (uneditable by user)
                ),
                $('<td>').append(
                    $('<input>').attr('type', 'text').attr('name', 'equation') // in the next column, add the equation (editable by user)
                ),
            ).appendTo($tbody);

            if (category === "stock" || category === "flow") {
                // append a checkbox 
                $('<td>').append(
                    // this checkbox determines if the stock is non-negative or if the flow is uniflow
                    // also has an event listener that calls the save function when the checkbox is changed (to update arrows on flows)
                    $('<input>').attr('type', 'checkbox').attr('name', 'checkbox').change(function () {
                        loadTableToDiagram();
                    }))
                    .appendTo($tr);
            } else {
                // if the object is a variable or cloud, add a blank column
                $('<td>').appendTo($tr);
            }

            // depending on the category, change the color of the row (only first 2 columns)
            if (category === "stock") {
                // get the first 2 columns of the row
                $tr.find('td').slice(0, 3).css('background-color', '#ffcc99');
            } else if (category === "flow") {
                $tr.find('td').slice(0, 3).css('background-color', '#99ccff');
            } else if (category === "variable") {
                $tr.find('td').slice(0, 3).css('background-color', '#99ff99');
            }

            if (load) {
                // populate the equation and checkbox from json
                $tr.find('input[name="equation"]').val(item.equation);
                $tr.find('input[name="checkbox"]').prop('checked', item.checkbox);
            }
        }
    });


    // 2. remove any items that are no longer in the model
    $tbody.find('tr').each(function () {
        var name = $(this).find('input[name="name"]').val(); // get the name of the object
        var exists = false;
        $.each(json.nodeDataArray, function (i, item) {
            if (item.category !== "stock" && item.category !== "variable" && item.category !== "valve") { // excludes clouds and influences
                return;
            }

            if (item.label === name) {
                exists = true;
            }
        });

        if (!exists) {
            $(this).remove();
        }
    });
}

function isBiflow(data, node) {
    // search through table to get link's checkbox value
    var $tbody = $('#eqTableBody');
    var biflow = false;

    var labelKey = data.labelKeys[0]; // get the label key of the link
    // search in nodeDataArray for the key with the same labelKey
    for (var node of myDiagram.model["nodeDataArray"]) {
        if (node.key === labelKey) {
            var flowName = node.label;
        }
    }

    $tbody.find('tr').each(function () {
        var name = $(this).find('input[name="name"]').val(); // get the name of the object
        var checkbox = $(this).find('input[name="checkbox"]').is(':checked'); // get the checkbox value of the object

        if (name === flowName) {
            biflow = !checkbox; // if checked, that means it is a uniflow
        }
    });

    return biflow;
}

function run() {
    loadTableToDiagram();

    var json = JSON.parse(myDiagram.model.toJson());
    var engineJson = translate(json);

    // get information on the start time, end time, dt, and integration method and add it to the engine json
    var startTime = document.getElementById("startTime").value;
    var endTime = document.getElementById("endTime").value;
    var dt = document.getElementById("dt").value;
    var integrationMethod = document.getElementById("integrationMethod").value == "euler" ? "euler" : "rk4";

    engineJson.start_time = parseFloat(startTime);
    engineJson.end_time = parseFloat(endTime);
    engineJson.dt = parseFloat(dt);
    engineJson.integration_method = integrationMethod;


    sim.setData(engineJson);
    var data = sim.run();

    console.log(data); // TODO: remove this

    sim.reset();
}

// add button event listeners
// mode buttons
document.getElementById("pointer_button").addEventListener("click", function () { setMode("pointer", "pointer"); });
document.getElementById("stock_button").addEventListener("click", function () { setMode("node", "stock"); });
document.getElementById("cloud_button").addEventListener("click", function () { setMode("node", "cloud"); });
document.getElementById("variable_button").addEventListener("click", function () { setMode("node", "variable"); });
document.getElementById("flow_button").addEventListener("click", function () { setMode("link", "flow"); });
document.getElementById("influence_button").addEventListener("click", function () { setMode("link", "influence"); });

// save, load, and run buttons
document.getElementById("saveButton").addEventListener("click", loadTableToDiagram);
document.getElementById("loadButton").addEventListener("click", load);
document.getElementById("runButton").addEventListener("click", run);

window.addEventListener('DOMContentLoaded', init);