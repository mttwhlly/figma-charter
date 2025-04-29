// This is the main code for a Figma plugin that generates pie charts from JSON data

// Show the UI
figma.showUI(__html__, { width: 450, height: 550 });

// Listen for messages from the UI
figma.ui.onmessage = function(msg) {
  if (msg.type === 'create-pie-chart') {
    // Log received options for debugging
    console.log('Received options:', msg.options);
    
    // Ensure numeric values are properly parsed
    var options = {
      width: parseInt(msg.options.width) || 400,
      height: parseInt(msg.options.height) || 400,
      showLabels: msg.options.showLabels,
      showValues: msg.options.showValues,
      showPercentages: msg.options.showPercentages,
      labelFontSize: parseInt(msg.options.labelFontSize) || 12,
      showLegend: msg.options.showLegend,
      legendFontSize: parseInt(msg.options.legendFontSize) || 12
    };
    
    createPieChart(msg.data, options);
  } else if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

// Function to create a pie chart
function createPieChart(data, options) {
  // Log options for debugging
  console.log('Creating pie chart with options:', options);
  
  // Load fonts first
  figma.loadFontAsync({ family: "Inter", style: "Regular" }).then(function() {
    figma.loadFontAsync({ family: "Inter", style: "Medium" }).then(function() {
      // After fonts are loaded, continue with chart creation
      createPieChartWithLoadedFonts(data, options);
    });
  });
}

function createPieChartWithLoadedFonts(data, options) {
  // Create a frame for the pie chart
  var frame = figma.createFrame();
  frame.name = "Pie Chart";
  
  // Ensure we're using the values from the options object
  var chartWidth = parseInt(options.width) || 400;
  var chartHeight = parseInt(options.height) || 400;
  console.log('Setting frame dimensions to:', chartWidth, chartHeight);
  
  // Set frame dimensions
  frame.resize(chartWidth, chartHeight);
  
  // Add a subtle border to visualize frame boundaries
  frame.strokes = [{type: 'SOLID', color: {r: 0.9, g: 0.9, b: 0.9}}];
  frame.strokeWeight = 1;
  
  // Calculate total for percentages
  var total = 0;
  for (var i = 0; i < data.length; i++) {
    total += data[i].value;
  }
  
  // Arrays to store slices and labels
  var slices = [];
  var labels = [];
  var valueLabels = [];
  
  // Set the center and radius
  var centerX = chartWidth / 2;
  var centerY = chartHeight / 2;
  var radius = Math.min(centerX, centerY) * 0.8;
  
  // Initialize start angle
  var startAngle = 0;
  
  // Color palette for the slices if none provided
  var defaultColors = [
    "#FF6B6B", "#4ECDC4", "#FFD166", "#6A0572", "#AB83A1",
    "#F6AE2D", "#86BBD8", "#33658A", "#2F4858", "#F26419"
  ];
  
  // Create slices 
  for (var i = 0; i < data.length; i++) {
    var item = data[i];
    var percentage = item.value / total;
    var endAngle = startAngle + (percentage * Math.PI * 2);
    
    // Create pie slice (vector)
    var slice = createSlice(
      centerX, 
      centerY, 
      radius, 
      startAngle, 
      endAngle, 
      item.color || defaultColors[i % defaultColors.length]
    );
    slice.name = item.label || "Slice " + (i+1);
    slices.push(slice);
    
    // Create label if enabled
    if (options.showLabels) {
      var midAngle = startAngle + (percentage * Math.PI);
      var labelRadius = radius * 1.2;
      
      // Calculate label position
      var labelX = centerX + Math.cos(midAngle) * labelRadius;
      var labelY = centerY + Math.sin(midAngle) * labelRadius;
      
      // Create label text
      var label = figma.createText();
      label.characters = item.label || "Item " + (i+1);
      label.fontSize = options.labelFontSize || 12;
      label.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
      
      // Position label
      label.x = labelX - (label.width / 2);
      label.y = labelY - (label.height / 2);
      
      labels.push(label);
      
      // Create value/percentage label if enabled
      if (options.showValues) {
        var valueLabel = figma.createText();
        valueLabel.characters = options.showPercentages 
          ? Math.round(percentage * 100) + "%" 
          : item.value.toString();
        valueLabel.fontSize = (options.labelFontSize || 12) * 0.9;
        valueLabel.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
        
        // Position value label below the main label
        valueLabel.x = labelX - (valueLabel.width / 2);
        valueLabel.y = labelY + (label.height / 2);
        
        valueLabels.push(valueLabel);
      }
    }
    
    // Update start angle for next slice
    startAngle = endAngle;
  }
  
  // Group the slices
  if (slices.length > 0) {
    var pieGroup = figma.group(slices, frame);
    pieGroup.name = "Pie Slices";
  }
  
  // Group the labels
  if (labels.length > 0) {
    var labelGroup = figma.group(labels, frame);
    labelGroup.name = "Labels";
  }
  
  // Group the value labels
  if (valueLabels.length > 0) {
    var valueLabelsGroup = figma.group(valueLabels, frame);
    valueLabelsGroup.name = "Value Labels";
  }
  
  // Create legend if enabled
  if (options.showLegend) {
    var legendItems = createLegend(data, options, defaultColors);
    if (legendItems.length > 0) {
      var legendGroup = figma.group(legendItems, frame);
      legendGroup.name = "Legend";
      legendGroup.x = frame.width - legendGroup.width - 20;
      legendGroup.y = 20;
    }
  }
  
  // Center the chart in the current view
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);
  
  // Close the plugin
  figma.closePlugin();
}

// Helper function to create a pie slice
function createSlice(centerX, centerY, radius, startAngle, endAngle, color) {
  // Create the slice as a vector
  var slice = figma.createVector();
  
  var startX = centerX + radius * Math.cos(startAngle);
  var startY = centerY + radius * Math.sin(startAngle);
  var endX = centerX + radius * Math.cos(endAngle);
  var endY = centerY + radius * Math.sin(endAngle);
  
  // For approximating an arc with cubic bezier curves
  // Using a simple approximation: we'll create multiple bezier curves for larger arcs
  
  var pathData = "M " + centerX + " " + centerY + " "; // Start at center
  pathData += "L " + startX + " " + startY + " "; // Line to start of arc
  
  // Add curves to approximate the arc
  var angleDiff = endAngle - startAngle;
  // Use more segments for larger arcs
  var segments = Math.max(1, Math.ceil(Math.abs(angleDiff) / (Math.PI / 4)));
  
  for (var i = 0; i < segments; i++) {
    var segStartAngle = startAngle + (angleDiff * i / segments);
    var segEndAngle = startAngle + (angleDiff * (i + 1) / segments);
    
    var segStartX = centerX + radius * Math.cos(segStartAngle);
    var segStartY = centerY + radius * Math.sin(segStartAngle);
    var segEndX = centerX + radius * Math.cos(segEndAngle);
    var segEndY = centerY + radius * Math.sin(segEndAngle);
    
    // Calculate control points for the cubic bezier
    // Using a good approximation for circular arcs
    var segMidAngle = (segStartAngle + segEndAngle) / 2;
    var handleLength = radius * 4/3 * Math.tan(Math.abs(segEndAngle - segStartAngle) / 4);
    
    var cp1x = segStartX - handleLength * Math.sin(segStartAngle);
    var cp1y = segStartY + handleLength * Math.cos(segStartAngle);
    var cp2x = segEndX + handleLength * Math.sin(segEndAngle);
    var cp2y = segEndY - handleLength * Math.cos(segEndAngle);
    
    // Add the cubic bezier curve segment
    pathData += "C " + cp1x + " " + cp1y + " " + cp2x + " " + cp2y + " " + segEndX + " " + segEndY + " ";
  }
  
  pathData += "Z"; // Close the path
  
  // Set the vector path
  slice.vectorPaths = [{ 
    windingRule: 'EVENODD', 
    data: pathData 
  }];
  
  // Set the fill color
  var rgb = hexToRgb(color);
  slice.fills = [{ type: 'SOLID', color: { r: rgb.r, g: rgb.g, b: rgb.b } }];
  
  return slice;
}

// Helper function to create legend items
function createLegend(data, options, defaultColors) {
  var legendItems = [];
  var totalHeight = 0;
  var itemSpacing = 8;
  var colorSquareSize = 12;
  
  for (var i = 0; i < data.length; i++) {
    var item = data[i];
    
    // Create color square
    var colorSquare = figma.createRectangle();
    colorSquare.resize(colorSquareSize, colorSquareSize);
    colorSquare.x = 0;
    colorSquare.y = totalHeight;
    
    var rgb = hexToRgb(item.color || defaultColors[i % defaultColors.length]);
    colorSquare.fills = [{ type: 'SOLID', color: { r: rgb.r, g: rgb.g, b: rgb.b } }];
    
    legendItems.push(colorSquare);
    
    // Create label text
    var label = figma.createText();
    label.characters = item.label || "Item " + (i+1);
    label.fontSize = options.legendFontSize || 12;
    label.x = colorSquareSize + 8;
    label.y = totalHeight - 2; // Adjust for visual alignment
    
    legendItems.push(label);
    
    totalHeight += Math.max(colorSquareSize, label.height) + itemSpacing;
  }
  
  return legendItems;
}

// Helper function to convert hex color to RGB
function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse hex values
  var r = parseInt(hex.substring(0, 2), 16) / 255;
  var g = parseInt(hex.substring(2, 4), 16) / 255;
  var b = parseInt(hex.substring(4, 6), 16) / 255;
  
  return { r: r, g: g, b: b };
}