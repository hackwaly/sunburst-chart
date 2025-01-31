import { select, event } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { hierarchy, partition } from 'd3-hierarchy';
import { arc } from 'd3-shape';
import { path } from 'd3-path';
import { interpolate } from 'd3-interpolate';
import { transition } from 'd3-transition';
import Kapsule from 'kapsule';
import accessorFn from 'accessor-fn';

function styleInject(css, ref) {
  if (ref === void 0) ref = {};
  var insertAt = ref.insertAt;

  if (!css || typeof document === 'undefined') {
    return;
  }

  var head = document.head || document.getElementsByTagName('head')[0];
  var style = document.createElement('style');
  style.type = 'text/css';

  if (insertAt === 'top') {
    if (head.firstChild) {
      head.insertBefore(style, head.firstChild);
    } else {
      head.appendChild(style);
    }
  } else {
    head.appendChild(style);
  }

  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    style.appendChild(document.createTextNode(css));
  }
}

var css = ".sunburst-viz .slice path {\n  cursor: pointer;\n}\n\n.sunburst-viz text {\n  font-family: sans-serif;\n  font-size: 12px;\n  dominant-baseline: middle;\n  text-anchor: middle;\n  pointer-events: none;\n  fill: #222;\n}\n\n.sunburst-viz text .text-contour {\n  fill: none;\n  stroke: white;\n  stroke-width: 5;\n  stroke-linejoin: 'round';\n}\n\n.sunburst-viz .main-arc {\n  stroke: white;\n  stroke-width: 1px;\n  transition: opacity .4s;\n}\n\n.sunburst-viz .main-arc:hover {\n  opacity: 0.85;\n  transition: opacity .05s;\n}\n\n.sunburst-viz .hidden-arc {\n  fill: none;\n}\n\n.sunburst-tooltip {\n  display: none;\n  position: absolute;\n  max-width: 320px;\n  white-space: nowrap;\n  padding: 5px;\n  border-radius: 3px;\n  font: 12px sans-serif;\n  color: #eee;\n  background: rgba(0,0,0,0.65);\n  pointer-events: none;\n}\n\n.sunburst-tooltip .tooltip-title {\n  font-weight: bold;\n  text-align: center;\n  margin-bottom: 5px;\n}\n";
styleInject(css);

var TRANSITION_DURATION = 750;
var CHAR_PX = 6;
var sunburst = Kapsule({
  props: {
    width: {
      "default": window.innerWidth
    },
    height: {
      "default": window.innerHeight
    },
    data: {
      onChange: function onChange(_, state) {
        state.needsReparse = true;
      }
    },
    children: {
      "default": 'children',
      onChange: function onChange(_, state) {
        state.needsReparse = true;
      }
    },
    sort: {
      onChange: function onChange(_, state) {
        state.needsReparse = true;
      }
    },
    label: {
      "default": function _default(d) {
        return d.name;
      }
    },
    size: {
      "default": 'value',
      onChange: function onChange(_, state) {
        state.needsReparse = true;
      }
    },
    color: {
      "default": function _default(d) {
        return 'lightgrey';
      }
    },
    minSliceAngle: {
      "default": .2
    },
    maxLevels: {},
    showLabels: {
      "default": true
    },
    tooltipContent: {
      "default": function _default(d) {
        return '';
      },
      triggerUpdate: false
    },
    tooltipTitle: {
      "default": null,
      triggerUpdate: false
    },
    showTooltip: {
      "default": function _default(d) {
        return true;
      },
      triggerUpdate: false
    },
    focusOnNode: {
      onChange: function onChange(d, state) {
        if (d && state.initialised) {
          moveStackToFront(d.__dataNode);
        }

        function moveStackToFront(elD) {
          state.svg.selectAll('.slice').filter(function (d) {
            return d === elD;
          }).each(function (d) {
            this.parentNode.appendChild(this);

            if (d.parent) {
              moveStackToFront(d.parent);
            }
          });
        }
      }
    },
    excludeRoot: {
      "default": false,
      onChange: function onChange(_, state) {
        state.needsReparse = true;
      }
    },
    onClick: {
      triggerUpdate: false
    },
    onHover: {
      triggerUpdate: false
    }
  },
  methods: {
    _parseData: function _parseData(state) {
      if (state.data) {
        var hierData = hierarchy(state.data, accessorFn(state.children)).sum(accessorFn(state.size));

        if (state.sort) {
          hierData.sort(state.sort);
        }

        partition().padding(0)(hierData);

        if (state.excludeRoot) {
          // re-scale y values if excluding root
          var yScale = scaleLinear().domain([hierData.y1 - hierData.y0, 1]);
          hierData.descendants().forEach(function (d) {
            d.y0 = yScale(d.y0);
            d.y1 = yScale(d.y1);
          });
        }

        hierData.descendants().forEach(function (d, i) {
          d.id = i; // Mark each node with a unique ID

          d.data.__dataNode = d; // Dual-link data nodes
        });
        state.layoutData = hierData.descendants();
      }
    }
  },
  aliases: {
    onNodeClick: 'onClick'
  },
  init: function init(domNode, state) {
    var _this = this;

    state.chartId = Math.round(Math.random() * 1e12); // Unique ID for DOM elems

    state.radiusScale = scaleLinear();
    state.angleScale = scaleLinear().domain([0, 10]) // For initial build-in animation
    .range([0, 2 * Math.PI]).clamp(true);
    state.arc = arc().startAngle(function (d) {
      return state.angleScale(d.x0);
    }).endAngle(function (d) {
      return state.angleScale(d.x1);
    }).innerRadius(function (d) {
      return Math.max(0, state.radiusScale(d.y0));
    }).outerRadius(function (d) {
      return Math.max(0, state.radiusScale(d.y1));
    });
    var el = select(domNode).append('div').attr('class', 'sunburst-viz');
    state.svg = el.append('svg');
    state.canvas = state.svg.append('g'); // tooltips

    state.tooltip = select('body').append('div').attr('class', 'sunburst-tooltip'); // tooltip cleanup on unmount

    domNode.addEventListener('DOMNodeRemoved', function (e) {
      if (e.target === this) {
        state.tooltip.remove();
      }
    });
    state.canvas.on('mousemove', function () {
      state.tooltip.style('left', event.pageX + 'px').style('top', event.pageY + 'px').style('transform', "translate(-".concat(event.offsetX / state.width * 100, "%, 21px)")); // adjust horizontal position to not exceed canvas boundaries
    }); // Reset focus by clicking on canvas

    state.svg.on('click', function () {
      return (state.onClick || _this.focusOnNode)(null);
    }) // By default reset zoom when clicking on canvas
    .on('mouseover', function () {
      return state.onHover && state.onHover(null);
    });
  },
  update: function update(state) {
    var _this2 = this;

    if (state.needsReparse) {
      this._parseData();

      state.needsReparse = false;
    }

    var maxRadius = Math.min(state.width, state.height) / 2;
    state.radiusScale.range([maxRadius * .1, maxRadius]);
    state.svg.style('width', state.width + 'px').style('height', state.height + 'px').attr('viewBox', "".concat(-state.width / 2, " ").concat(-state.height / 2, " ").concat(state.width, " ").concat(state.height));
    if (!state.layoutData) return;
    var focusD = state.focusOnNode && state.focusOnNode.__dataNode.y0 >= 0 && state.focusOnNode.__dataNode || {
      x0: 0,
      x1: 1,
      y0: 0,
      y1: 1
    };
    var slice = state.canvas.selectAll('.slice').data(state.layoutData.filter(function (d) {
      return (// Show only slices with a large enough angle and within the max levels
        d.x1 >= focusD.x0 && d.x0 <= focusD.x1 && (d.x1 - d.x0) / (focusD.x1 - focusD.x0) > state.minSliceAngle / 360 && (!state.maxLevels || d.depth - (focusD.depth || (state.excludeRoot ? 1 : 0)) < state.maxLevels) && (d.y0 >= 0 || focusD.parent)
      );
    } // hide negative layers on top level
    ), function (d) {
      return d.id;
    });
    var nameOf = accessorFn(state.label);
    var colorOf = accessorFn(state.color);
    var transition$1 = transition().duration(TRANSITION_DURATION);
    var levelYDelta = state.layoutData[0].y1 - state.layoutData[0].y0;
    var maxY = Math.min(1, focusD.y0 + levelYDelta * Math.min(focusD.hasOwnProperty('height') ? focusD.height + 1 : Infinity, state.maxLevels || Infinity)); // Apply zoom

    state.svg.transition(transition$1).tween('scale', function () {
      var xd = interpolate(state.angleScale.domain(), [focusD.x0, focusD.x1]);
      var yd = interpolate(state.radiusScale.domain(), [focusD.y0, maxY]);
      return function (t) {
        state.angleScale.domain(xd(t));
        state.radiusScale.domain(yd(t));
      };
    }); // Exiting

    var oldSlice = slice.exit().transition(transition$1).style('opacity', 0).remove();
    oldSlice.select('path.main-arc').attrTween('d', function (d) {
      return function () {
        return state.arc(d);
      };
    });
    oldSlice.select('path.hidden-arc').attrTween('d', function (d) {
      return function () {
        return middleArcLine(d);
      };
    }); // Entering

    var newSlice = slice.enter().append('g').attr('class', 'slice').style('opacity', 0).on('click', function (d) {
      event.stopPropagation();

      (state.onClick || _this2.focusOnNode)(d.data);
    }).on('mouseover', function (d) {
      event.stopPropagation();
      state.onHover && state.onHover(d.data);
      state.tooltip.style('display', state.showTooltip(d.data, d) ? 'inline' : 'none');
      state.tooltip.html("<div class=\"tooltip-title\">".concat(state.tooltipTitle ? state.tooltipTitle(d.data, d) : getNodeStack(d).slice(state.excludeRoot ? 1 : 0).map(function (d) {
        return nameOf(d.data);
      }).join(' &rarr; '), "</div>").concat(state.tooltipContent(d.data, d)));
    }).on('mouseout', function () {
      state.tooltip.style('display', 'none');
    });
    newSlice.append('path').attr('class', 'main-arc').style('fill', function (d) {
      return colorOf(d.data, d.parent);
    });
    newSlice.append('path').attr('class', 'hidden-arc').attr('id', function (d) {
      return "hidden-arc-".concat(state.chartId, "-").concat(d.id);
    });
    var label = newSlice.append('text').attr('class', 'path-label'); // Add white contour

    label.append('textPath').attr('class', 'text-contour').attr('startOffset', '50%').attr('xlink:href', function (d) {
      return "#hidden-arc-".concat(state.chartId, "-").concat(d.id);
    });
    label.append('textPath').attr('class', 'text-stroke').attr('startOffset', '50%').attr('xlink:href', function (d) {
      return "#hidden-arc-".concat(state.chartId, "-").concat(d.id);
    }); // Entering + Updating

    var allSlices = slice.merge(newSlice);
    allSlices.style('opacity', 1);
    allSlices.select('path.main-arc').transition(transition$1).attrTween('d', function (d) {
      return function () {
        return state.arc(d);
      };
    }).style('fill', function (d) {
      return colorOf(d.data, d.parent);
    });
    allSlices.select('path.hidden-arc').transition(transition$1).attrTween('d', function (d) {
      return function () {
        return middleArcLine(d);
      };
    });
    allSlices.select('.path-label').transition(transition$1).styleTween('display', function (d) {
      return function () {
        return state.showLabels && textFits(d) ? null : 'none';
      };
    }); // Ensure propagation of data to children

    allSlices.selectAll('text.path-label').select('textPath.text-contour');
    allSlices.selectAll('text.path-label').select('textPath.text-stroke');
    allSlices.selectAll('text.path-label').selectAll('textPath').text(function (d) {
      return nameOf(d.data);
    }); //

    function middleArcLine(d) {
      var halfPi = Math.PI / 2;
      var angles = [state.angleScale(d.x0) - halfPi, state.angleScale(d.x1) - halfPi];
      var r = Math.max(0, (state.radiusScale(d.y0) + state.radiusScale(d.y1)) / 2);
      if (!r || !(angles[1] - angles[0])) return '';
      var middleAngle = (angles[1] + angles[0]) / 2;
      var invertDirection = middleAngle > 0 && middleAngle < Math.PI; // On lower quadrants write text ccw

      if (invertDirection) {
        angles.reverse();
      }

      var path$1 = path();
      path$1.arc(0, 0, r, angles[0], angles[1], invertDirection);
      return path$1.toString();
    }

    function textFits(d) {
      var deltaAngle = state.angleScale(d.x1) - state.angleScale(d.x0);
      var r = Math.max(0, (state.radiusScale(d.y0) + state.radiusScale(d.y1)) / 2);
      var perimeter = r * deltaAngle;
      return nameOf(d.data).toString().length * CHAR_PX < perimeter;
    }

    function getNodeStack(d) {
      var stack = [];
      var curNode = d;

      while (curNode) {
        stack.unshift(curNode);
        curNode = curNode.parent;
      }

      return stack;
    }
  }
});

export default sunburst;
