/* Author: Karthik S. Vedula
 * Converts the json file exported by gojs (from editor.js) to a json data file that can be used by engine.js
 * Caution! This uses label and not keys to identify nodes, as the user identifies nodes by label in equations.
 */

export function translate(obj) {
    var res = {
        "stocks": {},
        "converters": {},
    }; // the rest of the information (start and end times, dt, and integration method ae added lator in editor.js)

    var stockKeyToName = {}; // used for checking of a stock exists in the model (specifically in the inflows and outflows)

    // add all the stocks and converters to the res object
    for (var i = 0; i < obj.nodeDataArray.length; i++) {
        var node = obj.nodeDataArray[i];

        if (node.category == "stock") {
            stockKeyToName[node.key] = node.label;

            res.stocks[node.label.toString()] = {
                "isNN": node.checkbox.toString(),
                "values": [],
                "safeval": null,
                "equation": node.equation,
                "inflows": {},
                "outflows": {}
            };
        } else if (node.category == "variable") {
            res.converters[node.label.toString()] = {
                "values": [],
                "equation": node.equation
            };
        }
    }

    // add all the flows to the res object
    for (var i = 0; i < obj.linkDataArray.length; i++) {
        var link = obj.linkDataArray[i];

        if (link.category == "influence") {
            continue;
        }

        if (link.category == "flow") {
            // get the flow equation from the link (in the corresponding valve in node data array)
            var flowEq;
            var flowName;
            var isUniflow;
            for (var j = 0; j < obj.nodeDataArray.length; j++) { // find
                if (obj.nodeDataArray[j].key == link.labelKeys[0]) {
                    flowEq = obj.nodeDataArray[j].equation;
                    flowName = obj.nodeDataArray[j].label.toString();
                    isUniflow = obj.nodeDataArray[j].checkbox;
                    break;
                }
            }

            // add a '#' to the flow equation if it is a uniflow (processed in engine.js)
            if (isUniflow) {
                flowEq = "#" + flowEq;
            }

            // check if the from is a stock
            if (stockKeyToName[link.from] !== undefined) {
                // add the flow to the outflows of the source
                res.stocks[stockKeyToName[link.from]].outflows[flowName] = {
                    "equation": flowEq,
                    "values": []
                }
            }

            // check if the to is a stock
            if (stockKeyToName[link.to] !== undefined) {
                // add the flow to the inflows of the target
                res.stocks[stockKeyToName[link.to]].inflows[flowName] = {
                    "equation": flowEq,
                    "values": []
                }
            }
        }
    }

    return res;
}