//This code assumes var derivations has been set prior

var colorMap = {
		"default" : "#A9A9A9",
		"ProcessorBasic" : '#0000FF',
		"ProcessorDerived" : '#008000',
		"External": '#000022',
		"ratingmodel" : '	#FF0000',
		"statistics" : '#FFA500',
		"calculation" : '#000080',
		"fillmissingdata" : '#000080',
		"correctedpassthrough" : "#3CB371", 
		"noprocessor" : '#000080'
};

var shapeMap = {
		"default" : 'ellipse',
		"ProcessorBasic" : 'rectangle',
		"ProcessorDerived" : 'triangle',
		"External" : 'diamond'
};

var timeSeriesMap = {
    "ProcessorBasic" : "ProcessorBasic",
    "External" : "External"
};


var processorMap = {
		"default" : "ratingModel",
		"ratingmodel" : 'ratingModel',
		"statistics" : 'statDerived',
		"calculation" : 'calculation',
		"correctedpassthrough" : "correctedpassthrough",
		"fillmissingdata": "fillmissingdata",
		"conditionalfill": "conditionaldata",
		"datumconversion": "datumconversion",
		"transformation": "transformation",
		"noprocessor": "noprocessor"
};

var getTimePeriodEdges = function(nodes) {
	var dateMap = {};
	var dateList = [];
	
	for(var i = 0; i < derivations.length; i++) {
		var periodStartTime = derivations[i].periodStartTime;
		var periodEndTime = derivations[i].periodEndTime;

		
		if(periodStartTime && !dateMap[periodStartTime]) {
			dateMap[periodStartTime] = periodStartTime;
			dateList.push(periodStartTime);
		}
		
		if(periodEndTime && !dateMap[periodEndTime]) {
			dateMap[periodEndTime] = periodEndTime;
			dateList.push(periodEndTime);
		}
	}
	
	dateList.sort();
	
	return dateList;
};

var makeNode = function(nodeList, nodeData, insertedNodes) {

	var label = nodeData.identifier;
	if(label) {
		label = label.split("@")[0];
	}

	var col = colorMap[nodeData.timeSeriesType || "default"];
	var shape = shapeMap[nodeData.timeSeriesType || "default"];
	var node = { 
			data: { 
				id: nodeData.uniqueId, 
				name: label, 
				parameter: nodeData.parameter,
				sublocation: nodeData.sublocation,
				timeSeriesType: nodeData.timeSeriesType,
				computation: nodeData.computation,
				processorType: nodeData.processorType,
				publish: nodeData.publish,
				primary: nodeData.primary,
				weight:50,
				faveColor: col, 
				faveShape: shape 
			} 
	};
	
	var nodeTimeSeriesType = timeSeriesMap[nodeData.timeSeriesType];
	if(nodeTimeSeriesType){
	  node.classes = nodeTimeSeriesType;
	}
	nodeList.push(node);
  
	var nodeProcessorType = processorMap[nodeData.processorType];
	if(nodeProcessorType){
		node.classes = nodeProcessorType;
	}
	nodeList.push(node);
	
	insertedNodes[nodeData.uniqueId] = true;
};

var insertEdges = function(edgeList, nodeData, traversedEdgeMap, insertedNodes) {
	//for all inputs to this node
	for(var i = 0; i < nodeData.inputTimeSeriesUniqueIds.length; i++) {
		var fromId = nodeData.inputTimeSeriesUniqueIds[i];
		var toId = nodeData.uniqueId;
		insertEdge(edgeList, fromId, toId, nodeData, traversedEdgeMap, insertedNodes)
	}
	
	//from this node to all derived nodes
	for(var i = 0; i < nodeData.derivedTimeSeriesUniqueIds.length; i++) {
		var fromId = nodeData.uniqueId;
		var toId = nodeData.derivedTimeSeriesUniqueIds[i];
		insertEdge(edgeList, fromId, toId, nodeData, traversedEdgeMap, insertedNodes)
	}
}

var insertEdge = function(edgeList, fromId, toId, nodeData, traversedEdgeMap, insertedNodes) {
	var edgeKey = fromId + "-" + toId;
	if(!traversedEdgeMap[edgeKey] && insertedNodes[fromId] && insertedNodes[toId]) {
		var color = colorMap[nodeData.processorType || "default"];
		var edge = { data: { source: fromId, target: toId, faveColor: color, strength: 20 } }

		var procType = processorMap[nodeData.processorType || "default"]
		if(procType) {
			edge.classes = procType;
		}
		edgeList.push(edge);
		traversedEdgeMap[edgeKey] = true; //mark this node as created so it's not added to the graph again
	}
}

/**
 * Returns true if the processor range contains the date. Will also
 * return true if there is no processor range specified for the node as
 * these are nodes that need to be included but have no processor information
 */
var nodeIncludesDate = function(node, dateString) {
	if(!node.periodStartTime || !node.periodEndTime) {
		if(node.timeSeriesType == "ProcessorBasic" || node.timeSeriesType == "External") {
			return true;
		} else {
			return false;
		}
	}
	
	var nodeStartDate = new Date(node.periodStartTime)
	var nodeEndDate = new Date(node.periodEndTime)
	var date = new Date(dateString)
	
	return date <= nodeEndDate && date > nodeStartDate;
}

/**
 * Filter nodes back down to only those with an edge
 */
var filterNodesToActiveEdges = function(nodes, edges) {
	var filteredNodes = [];
	
	//build map of edge nodes attached to edges
	var nodesOnEdgesMap = {}
	for(var i = 0; i < edges.length; i++) {
		nodesOnEdgesMap[edges[i].data.source] = true;
		nodesOnEdgesMap[edges[i].data.target] = true;
	}
	
	for(var i = 0; i < nodes.length; i++) {
		if(nodesOnEdgesMap[nodes[i].data.id]) {
			filteredNodes.push(nodes[i])
		}
	}
	
	return filteredNodes;
}

var makeDerivationCurve = function(forDateString) {
	$("#cy").html("");
	$("#cy").removeClass();
	
	var nodes = [];
	var edges = [];
	var traversedEdgeMap = {};
	var insertedNodes = {};
	
	for(var i = 0; i < derivations.length; i++) {
		var n = derivations[i];
		if(nodeIncludesDate(n, forDateString)) {
			makeNode(nodes, n, insertedNodes);
		}
	}
	
	for(var i = 0; i < derivations.length; i++) {
		var n = derivations[i]
		if(nodeIncludesDate(n, forDateString)) {
			insertEdges(edges, n, traversedEdgeMap, insertedNodes);
		}
	}
	
	nodes = filterNodesToActiveEdges(nodes, edges);
	
	var graph = cytoscape({
		container: document.getElementById('cy'),
	
		layout: {
			padding: 10,
			name: 'cose-bilkent',
			directed: true,
			spacingFactor: 1.5,
			nodeDimensionsIncludeLabels: true,
			tile: false
		},
		
		wheelSensitivity: .25,
	  minZoom: .25,
	  maxZoom: 2,
	
		style: cytoscape.stylesheet()
		.selector('node')
		.css({
			'shape': 'rectangle',
			'width': 'mapData(weight, 40, 80, 20, 60)',
			'content': 'data(name)',
			'text-outline-width': 2,
			'text-outline-color': 'data(faveColor)',
			'text-wrap': 'wrap',
			'text-max-width': '200px',
			'background-color': '#fff',
			'color': '#fff',
			'border-width': 2,
			'border-color': '#333',
			'font-size': 10,
			'text-margin-y': -9
		})
		.selector('node.ProcessorBasic')
		.css({
		  'background-image': 'url("data:image/jpeg;base64,' + basicImage + '")'
		})
		.selector('node.External')
		.css({
		  'background-image': 'url("data:image/jpeg;base64,' + externalImage + '")'
		})
		.selector('node.ratingModel')
		.css({
		  'background-image': 'url("data:image/jpeg;base64,' + rateModelImage + '")'
		})
		.selector('node.calculation')
		.css({
		  'background-image': 'url("data:image/jpeg;base64,' + calculatedImage + '")'
		})
		.selector('node.correctedpassthrough')
		.css({
		  'background-image': 'url("data:image/jpeg;base64,' + correctedPassThroughImage + '")'
		})
		.selector('node.statDerived')
		.css({
		  'background-image': 'url("data:image/jpeg;base64,' + statsImage + '")'
		})
		.selector('node.transformation')
		.css({
		  'background-image': 'url("data:image/jpeg;base64,' + statsImage + '")'
		})
		.selector('node.fillmissingdata')
		.css({
		  'background-image': 'url("data:image/jpeg;base64,' + fillMissingDataImage + '")'
		})
		.selector('node.conditionaldata')
		.css({
		  'background-image': 'url("data:image/jpeg;base64,' + conditionalDataImage + '")'
		})
		.selector('node.datumconversion')
		.css({
		  'background-image': 'url("data:image/jpeg;base64,' + verticalDatumConversionImage + '")'
		})
		.selector('node.noprocessor')
		.css({
		  'background-image': 'url("data:image/jpeg;base64,' + noProcessorImage + '")'
		})
		.selector(':selected')
		.css({
			'border-width': 2,
			'border-color': '#dd0000'
		})
		.selector('edge')
		.css({
			'curve-style': 'bezier',
			'opacity': 0.666,
			'width': 'mapData(strength, 70, 100, 2, 6)',
			'target-arrow-shape': 'triangle',
			'source-arrow-shape': 'circle',
			'line-color': '#000080',
			'source-arrow-color': '#000080',
			'target-arrow-color': '#000080'
		})
		.selector('.faded')
		.css({
			'opacity': 0.25,
			'text-opacity': 0
		}),
		
		elements: {
			nodes: nodes,
			edges: edges
		},
	
		ready: function(){
			var cy = window.cy = this;
	
			cy.nodes().forEach(function(n){
				n.qtip({
					content: [
						{ display: "Parameter", value: n.data('parameter') || "" },
						{ display: "Sublocation", value: n.data('sublocation') || ""  },
						{ display: "Type", value: n.data('timeSeriesType') || ""  },
						{ display: "Computation", value: n.data('computation') || ""  },
						{ display: "Processor", value: n.data('processorType') || "" },
						{ display: "Publish", value: n.data('publish') || ""  },
						{ display: "Primary", value: n.data('primary') || ""  }
						].map(function( link ){
							return '<span>' + link.display + ' : ' + link.value + '</span>';
						}).join('<br />\n'),
						position: {
							my: 'top center',
							at: 'bottom center'
						},
						style: {
							classes: 'qtip-bootstrap',
							tip: {
								width: 16,
								height: 8,
							}
						}
				});
			});
		}
	});
	
	var _graph = graph;
	graph.on("zoom", function() {
		$("#zoomLevel").html(Math.floor(_graph.zoom()*100));
	});
	return graph;
}

var periodMarkers = getTimePeriodEdges(derivations);


var cy = makeDerivationCurve(periodMarkers[periodMarkers.length-1]);


function attachPeriodChangeHandler(newButton, inDateSelected) {
	var dateSelected = inDateSelected;
	newButton.click(function() {
		if(cy) {
			cy.destroy();
		}
		cy = makeDerivationCurve(dateSelected);
	})
}

var dateSelector = $("#dateSelector");
dateSelector.html("");
for(var i = periodMarkers.length - 1; i > 0 ; i--) {
	var newButton = $("<label>");
	newButton.addClass("btn");
	newButton.addClass("btn-default");
	newButton.html("<input type=\"radio\" value=\"" + periodMarkers[i-1] + "\"> " + new Date(periodMarkers[i-1]).toLocaleString() + " thru " + new Date(periodMarkers[i]).toLocaleString())
	if(i == periodMarkers.length - 1) {
		newButton.addClass("active");
	}
	var periodSelected = periodMarkers[i];
	attachPeriodChangeHandler(newButton, periodSelected);
	dateSelector.append(newButton);
}