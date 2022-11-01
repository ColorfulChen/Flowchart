document.onload = (function (d3, saveAs, Blob, undefined) {
  "use strict";

  // define graphcreator object
  var GraphCreator = function (svg, nodes, edges) {
    var thisGraph = this;
    console.log('thisGraph:');
    console.log(thisGraph);

    thisGraph.nodes = nodes || [];
    thisGraph.edges = edges || [];

    thisGraph.state = {
      selectedNode: null,
      selectedEdge: null,
      mouseDownNode: null,
      mouseDownLink: null,
      justDragged: false,
      justScaleTransGraph: false,
      lastKeyDown: -1,
      shiftNodeDrag: false,
      selectedText: null,
      drawLine: false
    };

    // define arrow markers for graph links
    var defs = svg.append('defs');
    defs.append('svg:marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', "32")
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    //define arrow markers for leading arrow
    defs.append('marker')
      .attr('id', 'mark-end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 7)
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    thisGraph.svg = svg;
    thisGraph.svgG = svg.append("g")
      .classed(thisGraph.consts.graphClass, true);
    var svgG = thisGraph.svgG;

    // displayed when dragging between nodes
    thisGraph.dragLine = svgG.append('path')
      .attr('class', 'link dragline hidden')
      .attr('d', 'M0,0L0,0')
      .style('marker-end', 'url(#mark-end-arrow)');

    // svg nodes and edges
    thisGraph.paths = svgG.append("g").selectAll("g");
    thisGraph.circles = svgG.append("g").selectAll("g");

    thisGraph.drag = d3.behavior.drag()
      .origin(function (d) {
        // d = selected circle. The drag origin is the origin of the circle
        return {
          x: d.x,
          y: d.y
        };
      })
      .on("drag", function (args) {
        thisGraph.state.justDragged = true;
        thisGraph.dragmove.call(thisGraph, args);
      })
      .on("dragend", function (args) {
        // args = circle that was dragged
      });

    // listen for key events
    d3.select(window).on("keydown", function () {
        thisGraph.svgKeyDown.call(thisGraph);
      })
      .on("keyup", function () {
        thisGraph.svgKeyUp.call(thisGraph);
      });
    svg.on("mousedown", function (d) {
      thisGraph.svgMouseDown.call(thisGraph, d);
    });
    svg.on("mouseup", function (d) {
      thisGraph.svgMouseUp.call(thisGraph, d);
    });

    // listen for dragging
    var dragSvg = d3.behavior.zoom()
      .on("zoom", function () {
        console.log('zoom triggered');
        if (d3.event.sourceEvent.shiftKey) {
          // TODO  the internal d3 state is still changing
          return false;
        } else {
          thisGraph.zoomed.call(thisGraph);
        }
        return true;
      })
      .on("zoomstart", function () {
        var ael = d3.select("#" + thisGraph.consts.activeEditId).node();
        if (ael) {
          ael.blur();
        }
        if (!d3.event.sourceEvent.shiftKey) d3.select('body').style("cursor", "move");
      })
      .on("zoomend", function () {
        d3.select('body').style("cursor", "auto");
      });

    svg.call(dragSvg).on("dblclick.zoom", null);

    // listen for resize
    window.onresize = function () {
      thisGraph.updateWindow(svg);
    };

    // help icon click
    d3.select("#help").on("click", function () {
      $('#helpbox').removeClass('hidden');
    });

    // reset zoom
    d3.select("#reset-zoom").on("click", function () {
      d3.select(".graph")
        .transition() // start a transition
        .duration(1000) // make it last 1 second
        .attr('transform', "translate(1,0)");

      dragSvg.scale(1);
      dragSvg.translate([1, 0]);
      scale = 1;
      translate = [0, 0];
    });

    // d3.select("#zoom-in").on("click", function () {
    //   d3.select(".graph")
    //     .transition() // start a transition
    //     .duration(1000) // make it last 1 second
    //     .attr('transform', "translate(1,0)");

    //   scale = scale + 0.1;
    //   dragSvg.scale(scale);
    //   dragSvg.translate([1, 0]);
    //   translate = [0, 0];
    //   thisGraph.zoomed.call(thisGraph)
    // });

    // d3.select("#zoom-out").on("click", function () {
    //   d3.select(".graph")
    //     .transition() // start a transition
    //     .duration(1000) // make it last 1 second
    //     .attr('transform', "translate(1,0)");

    //   scale = scale - 0.1;
    //   dragSvg.scale(scale);
    //   dragSvg.translate([1, 0]);
    //   translate = [0, 0];
    //   thisGraph.zoomed.call(thisGraph)
    // });

    // handle download data
    d3.select("#download-input").on("click", function () {
      var saveEdges = [];
      thisGraph.edges.forEach(function (val, i) {
        saveEdges.push({
          source: val.source.id,
          target: val.target.id
        });
      });
      var blob = new Blob([window.JSON.stringify({
        "nodes": thisGraph.nodes,
        "edges": saveEdges
      })], {
        type: "text/plain;charset=utf-8"
      });
      saveAs(blob, "mydag.json");
    });


    // handle uploaded data
    d3.select("#upload-input").on("click", function () {
      document.getElementById("hidden-file-upload").click();
    });
    d3.select("#hidden-file-upload").on("change", function () {
      if (window.File && window.FileReader && window.FileList && window.Blob) {
        var uploadFile = this.files[0];
        var filereader = new window.FileReader();

        filereader.onload = function () {
          var txtRes = filereader.result;
          // TODO better error handling
          try {
            var jsonObj = JSON.parse(txtRes);
            thisGraph.deleteGraph(true);
            thisGraph.nodes = jsonObj.nodes;
            thisGraph.setIdCt(jsonObj.nodes.length + 1);
            var newEdges = jsonObj.edges;
            newEdges.forEach(function (e, i) {
              newEdges[i] = {
                source: thisGraph.nodes.filter(function (n) {
                  return n.id == e.source;
                })[0],
                target: thisGraph.nodes.filter(function (n) {
                  return n.id == e.target;
                })[0]
              };
            });
            thisGraph.edges = newEdges;
            thisGraph.updateGraph();
          } catch (err) {
            window.alert("Error parsing uploaded file\nerror message: " + err.message);
            return;
          }
        };
        filereader.readAsText(uploadFile);

      } else {
        alert("Your browser won't let you save this graph -- try upgrading your browser to IE 10+ or Chrome or Firefox.");
      }

    });

    // handle delete graph
    d3.select("#delete-graph").on("click", function () {
      thisGraph.deleteGraph(false);
    });

    $('#flowComponents .components-btn').not('.noComponent').attr('draggable', 'true').on('dragstart', function (ev) {
      ev.originalEvent.dataTransfer.setData('text', $(this).children('span').text());
      ev.originalEvent.dataTransfer.setData('shapename', $(this).attr('for-name'));
      ev.originalEvent.dataTransfer.setData('component', $(this).attr('name'));
      console.log('drag start');
      console.log('shapename:' + $(this).attr('for-name') + ';shapeLabel:' + $(this).children('span').text());
      // $('#reset-zoom').trigger("click");
    });
    //creat
    $('#container').on('drop', function (ev) {
      var position = {};
      position.x = (parseInt(ev.originalEvent.offsetX) - translate[0]) / scale,
        position.y = (parseInt(ev.originalEvent.offsetY) - translate[1]) / scale;
      var shapeLabel = ev.originalEvent.dataTransfer.getData('text'),
        shapename = ev.originalEvent.dataTransfer.getData('shapename'),
        component = ev.originalEvent.dataTransfer.getData('component'),
        shapeId = shapename + new Date().getTime();

      var d = {
        id: generateUUID(),
        title: shapeLabel,
        x: position.x,
        y: position.y,
        name: component,
        state: 0
      };
      thisGraph.nodes.push(d);
      thisGraph.updateGraph();

    }).on('dragover', function (ev) {
      ev.preventDefault();
      console.log('drag over');
    });

    function judgeGraph() {
      var errMessage = "";

      var nodes = thisGraph.nodes;
      var edges = thisGraph.edges;

      var start = 0; //check start component
      var end = 0; //check end component

      for (var i in nodes) {
        if (nodes[i].name == "startComponent") {
          start++;
        } else if (nodes[i].name == "endComponent") {
          end++;
        }
      }

      if (start != 1) {
        if (start < 1) {
          errMessage = errMessage + "Missing Start Component!\n";
        } else {
          errMessage = errMessage + "More than 1 Start Component was created!\n";
        }
      }

      if (end != 1) {
        if (end < 1) {
          errMessage += "Missing End Component!\n";
        } else {
          errMessage += "More than 1 End Component was created!\n";
        }
      }

      function getInOut(curnode) {
        var inout = [0, 0];
        inout[0] = 0;
        inout[1] = 0;

        for (var j in edges) {
          if (edges[j].source.id == nodes[curnode].id) {
            inout[0]++;
          }
          if (edges[j].target.id == nodes[curnode].id) {
            inout[1]++;
          }
        }

        return inout;
      }

      function judgestartComponent() {
        if (edgeinout[0] != 1) {
          if (edgeinout[0] < 1) {
            errMessage += `${nodes[i].name} does not connect to components!\n`;
          } else {
            errMessage += `${nodes[i].name} Link to more than 1 components!\n`;
          }
        }

        if (edgeinout[1] > 0) {
          errMessage += `${nodes[i].name} can not be connected\n`;
        }
      }

      function judgeendComponent() {
        if (edgeinout[1] != 1) {
          if (edgeinout[1] < 1) {
            errMessage += `There are no component connect to ${nodes[i].name}!\n`;
          } else {
            errMessage += `There are more than 1 component connect to ${nodes[i].name}!\n`;
          }
        }

        if (edgeinout[0] > 0) {
          errMessage += `${nodes[i].name} can not connect to any component\n`;
        }
      }

      function judgeordinaryComponent() {
        if (edgeinout[1] != 1 && !(edgeinout[1] == 2 && nodes[i].state == 10)) {
          if (edgeinout[1] < 1) {
            errMessage += `There are no component connect to ${nodes[i].name} ${nodes[i].title}!\n`;
          } else {
            errMessage += `There are more than 1 component connect to ${nodes[i].name} ${nodes[i].title}!\n`;
          }
        }

        if (edgeinout[0] != 1) {
          if (edgeinout[0] < 1) {
            errMessage += `${nodes[i].name} ${nodes[i].title} does not connect to components!\n`;
          } else {
            errMessage += `${nodes[i].name} ${nodes[i].title} Link to more than 1 components!\n`;
          }
        }
      }

      function judgeconnecterComponent() {
        if (edgeinout[0] != 1) {
          if (edgeinout[0] < 1) {
            errMessage += `${nodes[i].name} ${nodes[i].title} does not connect to components!\n`;
          } else {
            errMessage += `${nodes[i].name} ${nodes[i].title} Link to more than 1 components!\n`;
          }
        }
      }

      function judgebranchComponent() {
        if (edgeinout[1] != 1) {
          if (edgeinout[1] < 1) {
            errMessage += `There are no component connect to ${nodes[i].name} ${nodes[i].title}!\n`;
          } else {
            errMessage += `There are more than 1 component connect to ${nodes[i].name} ${nodes[i].title}!\n`;
          }
        }

        if (edgeinout[0] != 2) {
          if (edgeinout[0] < 2) {
            errMessage += `${nodes[i].name} ${nodes[i].title} needs 2 edges connect to components!\n`;
          } else {
            errMessage += `${nodes[i].name} ${nodes[i].title} Link to more than 2 components!\n`;
          }
        }
      }

      var edgeinout;

      for (var i in nodes) {
        edgeinout = getInOut(i);

        switch (nodes[i].name) {
          case `startComponent`:
            judgestartComponent();
            break;

          case `endComponent`:
            judgeendComponent();
            break;

          case `activityComponent`:
            judgeordinaryComponent();
            break;

          case `branchComponent`:
            judgebranchComponent();
            break;

          case `connecterComponent`:
            judgeconnecterComponent()
            break;

          case `pageconnecterComponent`:
            judgeconnecterComponent()
            break;

          case `databaseComponent`:
            judgestartComponent();
            break;

          case `fileComponent`:
            judgestartComponent();
            break;

          default:
            judgeordinaryComponent();
        }
      }

      return errMessage;
    }

    //选择左侧工具
    $('#flowComponents .components-btn').on('click', function () {
      $(this).siblings().removeClass('active').end().addClass('active');
      if ('drawLineBtn' == $(this).attr('name')) {
        thisGraph.state.drawLine = true;
        $('#container').on('mouseover mouseout', '.conceptG', function () {
          if (event.type == 'mouseover') {
            this.style.cursor = 'crosshair';
          } else if (event.type == 'mouseout') {
            this.style.cursor = 'default';
          }
        });
      } else {
        $('#container').off('mouseover mouseout', '.conceptG');
        thisGraph.state.drawLine = false;
      }
    });

    //点击导入导出按钮
    $('.editor-toolbar').on('click', '.sign.in,.sign.out', function (event) {
      var isImport = $(this).hasClass('in');
      $('.ui.modal').modal({
          onDeny: function () {
            // window.alert('取消!');
          },
          onApprove: function () {
            if (isImport) {
              var jsonStr = $('div.json_data textarea').val();

              thisGraph.nodes = [];
              thisGraph.edges = [];

              if (jsonStr) {
                var json = JSON.parse(jsonStr);
                var edges = [];
                var nodes = json.nodes;

                for (var i in json.edges) {
                  var source = json.edges[i].source.id;
                  var target = json.edges[i].target.id;
                  var edge = {};
                  for (var j in json.nodes) {
                    var node = json.nodes[j].id
                    if (source == node) {
                      edge.source = nodes[j];
                    }
                    if (target == node) {
                      edge.target = nodes[j];
                    }
                  }
                  edges.push(edge);
                }
                thisGraph.nodes = thisGraph.nodes.concat(nodes);
                thisGraph.edges = thisGraph.edges.concat(edges);
                graph.updateGraph();
                graph.updateGraph();
              }
            }
          },
          onHidden: function () {
            $('#div.json_data input,textarea').val('');
          }
        })
        .modal('setting', 'transition', 'scale')
        .modal('show');

      if ($(this).hasClass('in')) {
        $('div.json_data .header').text('导入数据');
      } else {
        $('div.json_data .header').text('导出数据');
        var json = {};
        json.nodes = thisGraph.nodes;
        json.edges = thisGraph.edges;
        console.log(JSON.stringify(json));
        $('div.json_data textarea').val(JSON.stringify(json));
      }
    });
    //点击导出代码按钮
    $('.editor-toolbar').on('click', '.save', function (event) {
      $('div.json_data .header').text('导出代码');
      $('.ui.modal').modal('show');

      var code = judgeGraph();
      if (!code) {
        var header = "#include<bits/stdc++.h>";
        var currentNode;
        var nodes = thisGraph.nodes;
        var edges = thisGraph.edges;
        var tab = 0;


        function dumpCode() {
          var codeStr = "";
          tab = tab + 1;

          while (currentNode.name != "endComponent") {
            //if we are in if branch
            if (currentNode.name == "branchComponent") {
              if (currentNode.state == 0) {
                codeStr = codeStr + dumpifBranchCode();
              } else if (currentNode.state == 1) {
                codeStr = codeStr + dumpwhileBranchCode();
              }
            }
            //if we are in do-while branch
            if (currentNode.state == 10) {
              codeStr = codeStr + dumpdowhileBranchCode();
            }

            for (var i in edges) {
              if (edges[i].source.id == currentNode.id) {
                if (currentNode.name != "startComponent" && currentNode.name != "connecterComponent") {
                  codeStr = codeStr + indentation(tab) + currentNode.title.toString().replace("\n", "") + ";\n";
                }
                currentNode = edges[i].target;
                break;
              }
            }
          }

          tab = tab - 1;
          return codeStr;
        }

        function dumpifBranchCode() {
          tab = tab + 1;
          var trueBranch;
          var falseBranch;
          var branchStr = currentNode.title.toString().replace('\n', '');

          for (var i in edges) {
            if (edges[i].source.id == currentNode.id) {
              //trueBranch
              if (edges[i].target.x < edges[i].source.x) {
                trueBranch = edges[i].target;
              }
              //falseBranch
              else {
                falseBranch = edges[i].target;
              }
            }
          }

          var trueStr = "";
          while (trueBranch.name != "connecterComponent") {
            if (trueBranch.name == "branchComponent") {
              if (trueBranch.state == 0) {
                currentNode = trueBranch;
                trueStr = trueStr + dumpifBranchCode();
                trueBranch = currentNode;
              } else if (trueBranch.state == 1) {
                currentNode = trueBranch;
                trueStr = trueStr + dumpwhileBranchCode();
                trueBranch = currentNode;
              }
            }
            if (trueBranch.state == 10) {
              currentNode = trueBranch;
              trueStr = trueStr + dumpdowhileBranchCode();
              trueBranch = currentNode;
            }

            for (var i in edges) {
              if (edges[i].source.id == trueBranch.id) {
                if (trueBranch.name != "connecterComponent") {
                  trueStr = trueStr + indentation(tab) + trueBranch.title.toString().replace("\n", "") + ";\n";
                }
                trueBranch = edges[i].target;
                break;
              }
            }
          }

          var falseStr = "";
          while (falseBranch.name != "connecterComponent") {
            if (falseBranch.name == "branchComponent") {
              if (falseBranch.state == 0) {
                currentNode = falseBranch;
                falseStr = falseStr + dumpifBranchCode();
                falseBranch = currentNode;
              } else if (falseBranch.state == 1) {
                currentNode = falseBranch;
                falseStr = falseStr + dumpwhileBranchCode();
                falseBranch = currentNode;
              }
            }
            if (falseBranch.state == 10) {
              currentNode = falseBranch;
              falseStr = falseStr + dumpdowhileBranchCode();
              falseBranch = currentNode;
            }

            for (var i in edges) {
              if (edges[i].source.id == falseBranch.id) {
                if (falseBranch.name != "connecterComponent") {
                  falseStr = falseStr + indentation(tab) + falseBranch.title.toString().replace("\n", "") + ";\n";
                }
                falseBranch = edges[i].target;
                break;
              }
            }
          }

          tab = tab - 1;
          currentNode = trueBranch;

          return `${indentation(tab)}if( ${branchStr} ){\n${trueStr}${indentation(tab)}}\n${indentation(tab)}else{\n${falseStr}${indentation(tab)}}\n`
        }

        function dumpwhileBranchCode() {
          tab = tab + 1;
          var branchNode = currentNode;
          var branchStr = branchNode.title.toString().replace("\n", "");
          var trueBranch = null;
          var falseBranch = null;

          for (var i in edges) {
            if (edges[i].source.id == currentNode.id) {
              if (!trueBranch) {
                trueBranch = edges[i].target;
              } else if (!falseBranch) {
                falseBranch = edges[i].target;
                break;
              }
            }
          }

          if (trueBranch.y > falseBranch.y) {
            var tempNode = trueBranch;
            trueBranch = falseBranch;
            falseBranch = tempNode;
            tempNode = null;
          }

          var trueStr = "";

          while (trueBranch != branchNode) {
            if (trueBranch.name == "branchComponent") {
              if (trueBranch.state == 0) {
                currentNode = trueBranch;
                trueStr = trueStr + dumpifBranchCode();
                trueBranch = currentNode;
              } else if (trueBranch.state == 1) {
                currentNode = trueBranch;
                trueStr = trueStr + dumpwhileBranchCode();
                trueBranch = currentNode;
              }
            }

            if (trueBranch.state == 10) {
              currentNode = trueBranch;
              trueStr = trueStr + dumpdowhileBranchCode();
              trueBranch = currentNode;
            }

            for (var i in edges) {
              if (edges[i].source.id == trueBranch.id) {
                if (trueBranch != branchNode) {
                  trueStr = trueStr + indentation(tab) + trueBranch.title.toString().replace("\n", "") + ";\n";
                }
                trueBranch = edges[i].target;
                break;
              }
            }
          }

          tab = tab - 1;
          currentNode = falseBranch;
          return `${indentation(tab)}while( ${branchStr} ){\n${trueStr}${indentation(tab)}}\n`;
        }

        function dumpdowhileBranchCode() {
          tab = tab + 1;
          var branchNode = currentNode;
          var trueBranch = branchNode;
          var falseBranch;
          var trueStr = "";
          var isContinue = true;
          var branchStr;

          while (isContinue) {
            if (trueBranch.name == "branchComponent") {
              if (trueBranch.state == 0) {
                currentNode = trueBranch;
                trueStr = trueStr + dumpifBranchCode();
                trueBranch = currentNode;
              } else if (trueBranch.state == 1) {
                currentNode = trueBranch;
                trueStr = trueStr + dumpwhileBranchCode();
                trueBranch = currentNode;
              } else if (trueBranch.state == 2) {
                for (var i in edges) {
                  if (edges[i].source == trueBranch) {
                    if (edges[i].target == branchNode) {
                      isContinue = false;
                      for (var j in edges) {
                        if (j != i && edges[j].source == trueBranch) {
                          falseBranch = edges[j].target;
                        }
                      }
                      branchStr = trueBranch.title.toString().replace("\n", "");
                      break;
                    }
                  }
                }
              }
            }

            if (!isContinue) break;

            if (trueBranch != branchNode && trueBranch.state == 10) {
              currentNode = trueBranch;
              trueStr = trueStr + dumpdowhileBranchCode();
              trueBranch = currentNode;
            }

            for (var i in edges) {
              if (edges[i].source == trueBranch) {
                trueStr = trueStr + indentation(tab) + trueBranch.title.toString().replace("\n", "") + ";\n";

                for (var j in nodes) {
                  if (edges[i].target == nodes[j]) {
                    trueBranch = nodes[j];
                    break;
                  }
                }
                break;
              }
            }
          }

          tab = tab - 1;
          currentNode = falseBranch;
          return `${indentation(tab)}do{\n${trueStr}${indentation(tab)}}while( ${branchStr} )\n`;
        }



        for (var i in nodes) {
          console.log(nodes[i]);
          //find the entrance of progran
          if (nodes[i].name == "startComponent") {
            currentNode = nodes[i];
          }
        }

        code = `${header}\nint main(){\n${dumpCode()}\treturn 0;\n}`;

      } else {
        code = `Error!\n${code}`;
      }
      console.log(code);
      $('div.json_data textarea').val(code);

    });

    $('.editor-toolbar').on('click', '.eye', function (event) {
      $('div.json_data .header').text('检查代码');
      $('.ui.modal').modal('show');

      var err = judgeGraph();

      if (!err) {
        err = "The flow chart is Good!\n";
      }
      $('div.json_data textarea').val(err);

    });

    $('.editor-toolbar').on('click', '.align.justify', function (event) {
      var err = judgeGraph();
      if (!err) {
        var nodes = thisGraph.nodes;
        var edges = thisGraph.edges;

        var standardComponent;
        for (var i in nodes) {
          if (nodes[i].name == "startComponent") {
            standardComponent = nodes[i];
            break;
          }
        }

        function modify(curComponent, isModifyConnecter) {
          var offset = new Array;
          offset[0] = curComponent.x;
          offset[1] = curComponent.y;
          var verticalGap = 200;
          var horizonGap = 150;

          var copyComponent = curComponent;
          while (copyComponent.name != 'endComponent') {
            console.log(copyComponent);

            if (copyComponent.name == 'branchComponent') {
              var b1 = -1;
              var b2 = -1;

              for (var j in edges) {
                if (edges[j].source.id == copyComponent.id) {
                  if (b1 == -1) {
                    b1 = j;
                  } else {
                    b2 = j;
                    break;
                  }
                }
              }

              if (copyComponent.state == 0) { //if branch
                if (edges[b1].target.x <= edges[b2].target.x) {
                  edges[b1].target.x = copyComponent.x - horizonGap;
                  edges[b2].target.x = copyComponent.x + horizonGap;
                } else {
                  edges[b1].target.x = copyComponent.x + horizonGap;
                  edges[b2].target.x = copyComponent.x - horizonGap;
                }
                edges[b1].target.y = copyComponent.y + verticalGap;
                edges[b2].target.y = copyComponent.y + verticalGap;

                modify(edges[b1].target, 0);
                modify(edges[b2].target, 1);
                return;
              } else if (copyComponent.state == 1) {

              } else if (copyComponent.state == 2) { //do-while branch
                if (edges[b1].target.y > edges[b2].target.y) {
                  //b1 is false branch
                  edges[b1].target.x = offset[0];
                  edges[b1].target.y = offset[1] + verticalGap;
                  modify(edges[b1].target, 0);
                  return;
                } else {
                  edges[b2].target.x = offset[0];
                  edges[b2].target.y = offset[1] + verticalGap;
                  modify(edges[b2].target, 0);
                  return;
                }
              }
            } else {
              for (var j in edges) {
                if (edges[j].source.id == copyComponent.id) {
                  if (edges[j].target.name != 'connecterComponent') {
                    offset[1] += verticalGap;
                    edges[j].target.x = offset[0];
                    edges[j].target.y = offset[1];
                    copyComponent = edges[j].target;
                    break;
                  } else {
                    if (isModifyConnecter == 0) {
                      edges[j].target.x = offset[0];
                      edges[j].target.y = offset[1] + verticalGap;
                      return;
                    } else if (isModifyConnecter == 1) {
                      offset[1] += verticalGap;
                      edges[j].target.x = (edges[j].target.x + offset[0]) / 2;
                      if (offset[1] > edges[j].target.y) {
                        edges[j].target.y = offset[1];
                      }
                      for (var k in edges) {
                        if (edges[k].source == edges[j].target) {
                          if (edges[k].target.name != 'connecterComponent') {
                            edges[k].target.x = edges[j].target.x;
                            edges[k].target.y = edges[j].target.y + verticalGap;
                          } else {
                            edges[k].target.x = (edges[j].target.x + edges[k].target.x) / 2;
                            if (edges[j].target.y + verticalGap > edges[k].target.y) {
                              edges[k].target.y = edges[j].target.y + verticalGap;
                            }
                          }
                          modify(edges[k].target, 0);
                          return;
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          thisGraph.updateGraph();
          return;
        }

        modify(standardComponent, 0);
      } else {
        $('div.json_data .header').text('检查代码');
        $('.ui.modal').modal('show');
        err = `Error!\n${err}`;
        $('div.json_data textarea').val(err);
      }
    });

    $('.editor-toolbar').on('click', '.star', function (event) {
      window.open('https://github.com/MrChenYukun/onlineFlowchartGenerator');
    });
  };
  //constant config
  GraphCreator.prototype.consts = {
    selectedClass: "selected",
    connectClass: "connect-node",
    circleGClass: "conceptG",
    graphClass: "graph",
    activeEditId: "active-editing",
    BACKSPACE_KEY: 8,
    DELETE_KEY: 46,
    ENTER_KEY: 13,
    TAB_KEY: 9,
    nodeRadius: 50,
    startComponent: "M -60 -50 A 5 7 0 1 0 -60 50 L 60 50 A 5 7 0 1 0 60 -50 Z ",
    activityComponent: "M -100 -50 L 100 -50 L 100 50 L -100 50 Z",
    branchComponent: "M 0 -50 L -100 0 L 0 50 L 100 0 Z",
    connecterComponent: "M 0 -50 A 10 10 0 1 0 0 50 A 10 10 0 1 0 0 -50 Z",
    pageconnecterComponent: "M 0 -40 A 5 5 0 1 0 0 40 A 5 5 0 1 0 0 -40 Z",
    databaseComponent: " M -60 -50 A 5 7 0 1 0 -60 50 L 60 50 A 5 7 0 1 0 60 -50 A 5 7 0 1 0 60 50 A 5 7 0 1 0 60 -50 Z",
    fileComponent: "M -100 -50 L -100 30 A 10 4 0 1 0 0 30 A 10 4 0 1 1 100 30 L 100 -50 Z",
    endComponent: "M -60 -50 A 5 7 0 1 0 -60 50 L 60 50 A 5 7 0 1 0 60 -50 Z "
  };

  /* PROTOTYPE FUNCTIONS */

  GraphCreator.prototype.dragmove = function (d) {
    var thisGraph = this;
    if (thisGraph.state.shiftNodeDrag || thisGraph.state.drawLine) {
      thisGraph.dragLine.attr('d', 'M' + d.x + ',' + d.y + 'L' + d3.mouse(thisGraph.svgG.node())[0] + ',' + d3.mouse(this.svgG.node())[1]);
    } else {
      d.x += d3.event.dx;
      d.y += d3.event.dy;
      thisGraph.updateGraph();
    }
  };

  GraphCreator.prototype.deleteGraph = function (skipPrompt) {
    var thisGraph = this,
      doDelete = true;
    if (!skipPrompt) {
      doDelete = window.confirm("Press OK to delete this graph");
    }
    if (doDelete) {
      thisGraph.nodes = [];
      thisGraph.edges = [];
      thisGraph.updateGraph();
    }
  };

  /* select all text in element: taken from http://stackoverflow.com/questions/6139107/programatically-select-text-in-a-contenteditable-html-element */
  GraphCreator.prototype.selectElementContents = function (el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };


  /* insert svg line breaks: taken from http://stackoverflow.com/questions/13241475/how-do-i-include-newlines-in-labels-in-d3-charts */
  GraphCreator.prototype.insertTitleLinebreaks = function (gEl, d) {
    gEl.select("text").remove();
    d.title = d.title.replace('\n', '');

    var words = d.title.split(/;/),
      nwords = words.length;
    var el = gEl.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-" + (nwords - 1) * 7.5);

    for (var i = 0; i < words.length; i++) {
      var tspan = el.append('tspan').text(words[i]);
      if (i > 0)
        tspan.attr('x', 0).attr('dy', '15');
    }

    if (d.name == "branchComponent") {
      //for if branch
      if (d.state == 0) {
        el.append("tspan").text("T").attr('x', -80).attr('y', 5);
        el.append("tspan").text("F").attr('x', 80).attr('y', 5);
      }
      //for while branch
      else if (d.state == 1) {
        el.append("tspan").text("T").attr('x', 0).attr('y', 40);
        el.append("tspan").text("F").attr('x', 80).attr('y', 5);
      }
      //for do-while branch
      else if (d.state == 2) {
        el.append("tspan").text("T").attr('x', -80).attr('y', 5);
        el.append("tspan").text("F").attr('x', 0).attr('y', 40);
      }
    }

    return;
  };


  // remove edges associated with a node
  GraphCreator.prototype.spliceLinksForNode = function (node) {
    var thisGraph = this,
      toSplice = thisGraph.edges.filter(function (l) {
        return (l.source === node || l.target === node);
      });
    toSplice.map(function (l) {
      thisGraph.edges.splice(thisGraph.edges.indexOf(l), 1);
    });
  };

  GraphCreator.prototype.replaceSelectEdge = function (d3Path, edgeData) {
    var thisGraph = this;
    d3Path.classed(thisGraph.consts.selectedClass, true);
    if (thisGraph.state.selectedEdge) {
      thisGraph.removeSelectFromEdge();
    }
    thisGraph.state.selectedEdge = edgeData;
  };

  GraphCreator.prototype.replaceSelectNode = function (d3Node, nodeData) {
    // A circle node has been selected.

    var thisGraph = this;
    d3Node.classed(this.consts.selectedClass, true);
    if (thisGraph.state.selectedNode) {
      thisGraph.removeSelectFromNode();
    }
    thisGraph.state.selectedNode = nodeData;

  };

  GraphCreator.prototype.removeSelectFromNode = function () {
    // A circle node has been deselected.

    var thisGraph = this;
    thisGraph.circles.filter(function (cd) {
      return cd == thisGraph.state.selectedNode;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedNode = null;

    d3.selectAll("div#inspector").remove();

  };

  GraphCreator.prototype.removeSelectFromEdge = function () {
    var thisGraph = this;
    thisGraph.paths.filter(function (cd) {
      return cd === thisGraph.state.selectedEdge;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedEdge = null;
  };

  GraphCreator.prototype.pathMouseDown = function (d3path, d) {
    var thisGraph = this,
      state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownLink = d;

    if (state.selectedNode) {
      thisGraph.removeSelectFromNode();
    }

    var prevEdge = state.selectedEdge;
    if (!prevEdge || prevEdge !== d) {
      thisGraph.replaceSelectEdge(d3path, d);
    } else {
      thisGraph.removeSelectFromEdge();
    }
  };

  // mousedown on node
  GraphCreator.prototype.circleMouseDown = function (d3node, d) {
    var thisGraph = this,
      state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownNode = d;

    if (d3.event.shiftKey || thisGraph.state.drawLine) {
      // Automatically create node when they shift + drag?
      state.shiftNodeDrag = d3.event.shiftKey;
      // reposition dragged directed edge
      thisGraph.dragLine.classed('hidden', false)
        .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
      return;
    }
  };

  // mouseup on nodes
  GraphCreator.prototype.circleMouseUp = function (d3node, d) {
    //console.log('circle mouse up');
    var thisGraph = this,
      state = thisGraph.state,
      consts = thisGraph.consts;
    // reset the states
    state.shiftNodeDrag = false;
    d3node.classed(consts.connectClass, false);

    var mouseDownNode = state.mouseDownNode;

    if (!mouseDownNode) return;

    thisGraph.dragLine.classed("hidden", true);

    if (mouseDownNode !== d) {
      // we're in a different node: create new edge for mousedown edge and add to graph
      var newEdge = {
        source: mouseDownNode,
        target: d
      };
      var edgeisPush = true;
      thisGraph.paths.each(function (d) {
        if ((d.source === newEdge.source && d.target === newEdge.target)) {
          edgeisPush = false;
          return;
        }
      });

      if (edgeisPush) {
        thisGraph.edges.push(newEdge);
      }

      thisGraph.updateGraph();
    } else {
      // we're in the same node
      var prevNode = state.selectedNode;
      if (state.justDragged) {
        // dragged, not clicked
        if (state.selectedEdge) {
          thisGraph.removeSelectFromEdge();
        }
        if (!prevNode || prevNode !== d) {
          thisGraph.removeSelectFromNode();
          thisGraph.replaceSelectNode(d3node, d);
        } else {
          thisGraph.removeSelectFromNode();
        }

      } else {
        // clicked, not dragged
        if (d3.event.shiftKey) {

        } else {
          if (state.selectedEdge) {
            thisGraph.removeSelectFromEdge();
          }
          if (!prevNode || prevNode !== d) {
            thisGraph.replaceSelectNode(d3node, d);
            // thisGraph.menuEvent();
          } else {
            thisGraph.removeSelectFromNode();
          }
        }
      }
    }

    thisGraph.updateGraph();
    state.mouseDownNode = null;
    return;

  }; // end of circles mouseup

  // mousedown on main svg
  GraphCreator.prototype.svgMouseDown = function () {
    this.state.graphMouseDown = true;
  };

  // mouseup on main svg
  GraphCreator.prototype.svgMouseUp = function () {
    var thisGraph = this,
      state = thisGraph.state;
    if (state.justScaleTransGraph) {
      // dragged not clicked
      state.justScaleTransGraph = false;
    } else if (state.graphMouseDown && d3.event.shiftKey) {
      // clicked not dragged from svg
      var xycoords = d3.mouse(thisGraph.svgG.node()),
        d = {
          id: generateUUID(),
          title: "",
          x: xycoords[0],
          y: xycoords[1],
          state: 0
        };
      thisGraph.nodes.push(d);
      thisGraph.updateGraph();
    } else if (state.shiftNodeDrag || state.drawLine) {
      // dragged from node
      state.shiftNodeDrag = false;
      thisGraph.dragLine.classed("hidden", true);
    }
    state.graphMouseDown = false;
  };

  // keydown on main svg
  GraphCreator.prototype.svgKeyDown = function () {
    var thisGraph = this,
      state = thisGraph.state,
      consts = thisGraph.consts;
    // make sure repeated key presses don't register for each keydown
    if (state.lastKeyDown !== -1) return;

    state.lastKeyDown = d3.event.keyCode;
    var selectedNode = state.selectedNode,
      selectedEdge = state.selectedEdge;

    switch (d3.event.keyCode) {
      case consts.BACKSPACE_KEY:
      case consts.DELETE_KEY:
        d3.event.preventDefault();
        if (selectedNode) {
          thisGraph.nodes.splice(thisGraph.nodes.indexOf(selectedNode), 1);
          thisGraph.spliceLinksForNode(selectedNode);
          state.selectedNode = null;
          thisGraph.updateGraph();
          // thisGraph.
        } else if (selectedEdge) {
          if (selectedEdge.source.name == "branchComponent" && selectedEdge.source.state == 2) {
            selectedEdge.target.state = 0;
          }
          thisGraph.edges.splice(thisGraph.edges.indexOf(selectedEdge), 1);
          state.selectedEdge = null;
          thisGraph.updateGraph();
        }
        break;

      case consts.TAB_KEY:
        d3.event.preventDefault();
        if (selectedNode) {
          if (selectedNode.name == "branchComponent") {
            var index = thisGraph.nodes.indexOf(selectedNode);
            thisGraph.nodes[index].state = (thisGraph.nodes[index].state + 1) % 3;
            thisGraph.updateGraph();
          }
        }
        break;
    }
  };

  GraphCreator.prototype.svgKeyUp = function () {
    this.state.lastKeyDown = -1;
  };

  // call to propagate changes to graph
  //update rectangle
  GraphCreator.prototype.updateGraph = function () {

    var thisGraph = this,
      consts = thisGraph.consts,
      state = thisGraph.state;

    thisGraph.paths = thisGraph.paths.data(thisGraph.edges, function (d) {
      return String(d.source.id) + "+" + String(d.target.id);
    });
    var paths = thisGraph.paths;
    // update existing paths

    paths.style('marker-end', 'url(#end-arrow)')
      .classed(consts.selectedClass, function (d) {
        return d === state.selectedEdge;
      })
      .attr("d", function (d) {
        //源头是分支块的情况比较复杂
        if (d.source.name == "branchComponent") {
          // if-branch
          if (d.source.state == 0) {
            return "M" + d.source.x + "," + d.source.y +
              "L" + d.target.x + "," + d.source.y +
              "L" + d.target.x + "," + d.target.y;
          }
          //while-branch
          else if (d.source.state == 1) {
            if (abs(d.target.y - d.source.y) > 300) {
              return "M" + d.source.x + "," + d.source.y +
                "L" + (d.source.x + 180) + "," + d.source.y +
                "L" + (d.source.x + 180) + "," + (d.target.y - 100) +
                "L" + d.target.x + "," + (d.target.y - 100) +
                "L" + d.target.x + "," + d.target.y;
            } else {
              return "M" + d.source.x + "," + d.source.y +
                "L" + d.target.x + "," + d.source.y +
                "L" + d.target.x + "," + d.target.y;
            }
          }
          //do-while branch
          else if (d.source.state == 2) {
            //在上方
            if (d.target.y < d.source.y) {
              d.target.state = 10;
              return "M" + d.source.x + "," + d.source.y +
                "L" + (d.source.x - 180) + "," + d.source.y +
                "L" + (d.source.x - 180) + "," + (d.target.y - 100) +
                "L" + d.target.x + "," + (d.target.y - 100) +
                "L" + d.target.x + "," + d.target.y;
            } else {
              d.target.state = 0;
              return "M" + d.source.x + "," + d.source.y +
                "L" + d.target.x + "," + d.source.y +
                "L" + d.target.x + "," + d.target.y;
            }
          }
        }
        //如果目标是分支，且状态为2，也是拐着连接
        else if (d.target.name == "branchComponent" && d.target.state == 1 && d.target.y < d.source.y) {
          return "M" + d.source.x + "," + d.source.y +
            "L" + d.source.x + "," + (d.source.y + 100) +
            "L" + (d.source.x - 180) + "," + (d.source.y + 100) +
            "L" + (d.source.x - 180) + "," + (d.target.y - 100) +
            "L" + d.target.x + "," + (d.target.y - 100) +
            "L" + d.target.x + "," + d.target.y;
        }
        //如果目标是分支,结束，或者流程只能上下被连接
        else if (d.target.name == "branchComponent" ||
          d.target.name == "activityComponent" ||
          d.target.name == "endComponent") {
          return "M" + d.source.x + "," + d.source.y +
            "L" + d.target.x + "," + d.source.y +
            "L" + d.target.x + "," + d.target.y;
        }
        //如果源头是开始或流程块，只能上下伸出边
        else if (d.source.name == "activityComponent" ||
          d.source.name == "startComponent" ||
          d.source.name == "connecterComponent" ||
        d.source.name == "pageconnecterComponent") {
          return "M" + d.source.x + "," + d.source.y +
            "L" + d.source.x + "," + d.target.y +
            "L" + d.target.x + "," + d.target.y;
        }
        //上下箭头
        else if (abs(d.target.x - d.source.x) < abs(d.target.y - d.source.y)) {
          return "M" + d.source.x + "," + d.source.y +
            "L" + d.target.x + "," + d.source.y +
            "L" + d.target.x + "," + d.target.y;
        }
        //左右箭头
        else {
          return "M" + d.source.x + "," + d.source.y +
            "L" + d.source.x + "," + d.target.y +
            "L" + d.target.x + "," + d.target.y;
        }
      });

    // add new paths
    paths.enter()
      .append("path")
      .style('marker-end', 'url(#end-arrow)')
      .classed("link", true)
      .attr("d", function (d) {
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
      })
      .on("mousedown", function (d) {
        thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);
      })
      .on("mouseup", function (d) {
        state.mouseDownLink = null;
      });

    // remove old links
    paths.exit().remove();

    // update existing nodes
    thisGraph.circles = thisGraph.circles.data(thisGraph.nodes, function (d) {
      return d.id;
    });
    thisGraph.circles.attr("transform", function (d) {
      return "translate(" + d.x + "," + d.y + ")";
      //return "translate(" + (d.x - translate[0]) * scale + "," + (d.y - translate[1]) * scale + ")";
    });

    // add new nodes
    var newGs = thisGraph.circles.enter()
      .append("g")
      .attr({
        "id": function (d) {
          return generateUUID();
        }
      });

    newGs.classed(consts.circleGClass, true)
      .attr("transform", function (d) {
        //return "translate(" + (d.x - translate[0]) * scale + "," + (d.y - translate[1]) * scale + ")";
        return "translate(" + d.x + "," + d.y + ")";
      })
      .on("mouseover", function (d) {
        console.log('on mouse over d:');
        if (state.shiftNodeDrag) {
          d3.select(this).classed(consts.connectClass, true);
        }
      })
      .on("mouseout", function (d) {
        console.log('on mouse out d:');
        d3.select(this).classed(consts.connectClass, false);
      })
      .on("mousedown", function (d) {
        console.log('on mouse down d:');
        thisGraph.circleMouseDown.call(thisGraph, d3.select(this), d);
      })
      .on("mouseup", function (d) {
        console.log('on mouse up d:');
        console.log(d);
        thisGraph.circleMouseUp.call(thisGraph, d3.select(this), d);
      })
      .on("dblclick", function (d) {
        console.log('on double click d:');
        thisGraph.circleDoubleClick.call(thisGraph, d3.select(this), d);
      })
      .call(thisGraph.drag);

    newGs.append("path")
      .attr("d", function (d) {
        if (d.name == "startComponent") {
          return consts.startComponent;
        } else if (d.name == "activityComponent") {
          return consts.activityComponent;
        } else if (d.name == "branchComponent") {
          return consts.branchComponent;
        } else if (d.name == "connecterComponent") {
          return consts.connecterComponent;
        } else if (d.name == "pageconnecterComponent") {
          return consts.pageconnecterComponent;
        } else if (d.name == "databaseComponent") {
          return consts.databaseComponent;
        } else if (d.name == "fileComponent") {
          return consts.fileComponent;
        } else if (d.name == "endComponent") {
          return consts.endComponent;
        } else {
          return consts.activityComponent;
        }
      });

    thisGraph.circles.each(function (d) {
      thisGraph.insertTitleLinebreaks(d3.select(this), d);
    });

    // remove old nodes
    thisGraph.circles.exit().remove();
  };

  GraphCreator.prototype.zoomed = function () {
    this.state.justScaleTransGraph = true;
    translate = d3.event.translate;
    scale = d3.event.scale;
    d3.select("." + this.consts.graphClass)
      .attr("transform", "translate(" + translate + ") scale(" + scale + ")");
  };

  GraphCreator.prototype.updateWindow = function (svg) {
    var docEl = document.documentElement,
      bodyEl = document.getElementsByTagName('body')[0];
    var x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    var y = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;
    svg.attr("width", x).attr("height", y);
  };

  GraphCreator.prototype.circleDoubleClick = function (d3node, d) {
    $('div.json_data .header').text('导入节点数据');
    $('.ui.modal').modal({
        onDeny: function () {
          // window.alert('取消!');
        },
        onApprove: function () {
          var newtext = $('div.json_data textarea').val();
          if (newtext) {
            d.title = newtext;
            graph.insertTitleLinebreaks(d3node, d);
            graph.updateGraph();
          }
        },
        onHidden: function () {
          $('#div.json_data input,textarea').val('');
        }
      })
      .modal('setting', 'transition', 'scale')
      .modal('show');
    return;
  }; // end of circles mousedblclick


  /**** MAIN ****/

  // warn the user when leaving
  // window.onbeforeunload = function () {
  //   return "Make sure to save your graph locally before leaving :-)";
  // };

  /** MAIN SVG CREATION **/
  var translate = [0, 0];
  var scale = 1;

  var svg = d3.select("div#container").append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

  var graph = new GraphCreator(svg, [], []);
  graph.updateGraph();
})(window.d3, window.saveAs, window.Blob);

function generateUUID() {
  var d = new Date().getTime();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  return uuid;
};

function abs(absoluteValue) {

  if (absoluteValue < 0) {
    return absoluteValue * -1;
  } else return absoluteValue
}

function indentation(value) {
  var str = "";
  for (var i = 0; i < value; i++) {
    str += '\t';
  }
  return str;
}