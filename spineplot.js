import * as d3 from 'd3';
import * as _ from 'lodash';

/*
 * Simple Spineplot
 */
export default function (config, helper) {

  //Link Spineplot to the helper object in helper.js
  var Spineplot = Object.create(helper);

  Spineplot.init = function (config) {
    var vm = this;

    vm._config = config ? config : {};
    vm._config.orientation = 'horizontal';
    vm._data = [];
    vm._scales = {};
    vm._tip = vm.utils.d3.tip()
      .attr('class', 'd3-tip')
      .direction('n')
      .html(vm._config.tip || function (d) {
        var html = '<div>';
        html += '<span>' + d[vm._config.category] + '</span>';
        html += '</br><span>' + vm.utils.format(d[vm._config.value], 1) + '</span>';
        html += '</div>';
        return html;
      });

  };


  //-------------------------------
  //User config functions
  Spineplot.id = function (columnName) {
    var vm = this;
    vm._config.id = columnName;
    return vm;
  };

  Spineplot.category = function (columnName) {
    var vm = this;
    vm._config.category = columnName;
    return vm;
  };

  Spineplot.value = function (columnName) {
    var vm = this;
    vm._config.value = columnName;
    return vm;
  };

  Spineplot.orientation = function (orientation) {
    var vm = this;
    vm._config.orientation = orientation;
    return vm;
  };

  /**
   * Used to draw a bar chart stacked with multiple bars per group
   * @param {array} columns 
   */
  Spineplot.stackBy = function (columnName) {
    var vm = this;
    vm._config.stackBy = columnName;
    return vm;
  };

  /**
   * column name used for the domain values
   * @param {string} columnName 
   */
  Spineplot.fill = function (columnName) {
    var vm = this;
    vm._config.fill = columnName;
    return vm;
  };

  /**
   * array of values used 
   * @param {array or scale} columnName 
   */
  Spineplot.colors = function (colors) {
    var vm = this;
    if (Array.isArray(colors)) {
      //Using an array of colors for the range 
      vm._config.colors = colors;
    } else {
      //Using a preconfigured d3.scale
      vm._scales.color = colors;
    }
    return vm;
  };

  Spineplot.sortBy = function (option) {
    //option = string [asc,desc] 
    //option = array for groupBy and stackBy
    var vm = this;
    vm._config.sortBy = option;
    return vm;
  };

  Spineplot.format = function (format) {
    var vm = this;
    if (typeof format == 'function' || format instanceof Function)
      vm.utils.format = format;
    else
      vm.utils.format = d3.format(format);
    return vm;
  };

  Spineplot.tip = function (tip) {
    var vm = this;
    vm._config.tip = tip;
    return vm;
  };

  Spineplot.legend = function (legend) {
    var vm = this;
    vm._config.legend = legend;
    return vm;
  };


  //-------------------------------
  //Triggered by the chart.js;
  Spineplot.data = function (data) {
    var vm = this;

    if (vm._config.filter) {
      // In case we want to filter observations
      data = data.filter(vm._config.filter);
    }
    //@TODO - ALLOW MULITPLE SORTS
    if (vm._config.sortBy) {
      if (vm._config.sortBy.category) {
        data = data.sort(function (a, b) {
          return vm._config.sortBy.category === 'desc' ? vm.utils.sortDescending(a[vm._config.category], b[vm._config.category]) : vm.utils.sortAscending(a[vm._config.category], b[vm._config.category]);
        });
      }
      if (vm._config.sortBy.value) {
        data = data.sort(function (a, b) {
          return vm._config.sortBy.value === 'desc' ? vm.utils.sortDescending(a[vm._config.value], b[vm._config.value]) : vm.utils.sortAscending(a[vm._config.value], b[vm._config.value]);
        });
      }
    } else {
      data = data.sort(function (a, b) {
        return vm.utils.sortAscending(a[vm._config.category], b[vm._config.category]);
      });
    }

    var total = 0;
    vm._data = data.map(function(d) {
      d.x0 = total;
      d.x1 = total + d[vm._config.value];
      total += +d[vm._config.value];
      if (vm._config.hasOwnProperty('stackBy') && Array.isArray(vm._config.stackBy) && vm._config.stackBy.length > 0) {
        d.stackValues = d3.stack().keys(vm._config.stackBy)([d]);
        d.totalCollapse = d3.sum(d.stackValues, function(stack) {
          return stack[0][1] - stack[0][0];
        });
      }
      return d;
    });

    if (vm._config.hasOwnProperty('quantiles')) {
      vm._quantiles = vm._setQuantile(data);
      vm._minMax = d3.extent(data, function (d) {
        return +d[vm._config.fill];
      });
    }

    return vm;
  };

  Spineplot.scales = function () {
    var vm = this;
    var config;
    //vm._scales = s;
    /* Use
     * vm._config.category
     * vm._config.categoryAxis.scale
     * vm._config.value
     * vm._config.valueAxis.scale
     * vm._data
     */
    // Normal bars 
    if (vm._config.hasOwnProperty('category') && vm._config.hasOwnProperty('value')) {
      config = {
        column: 'x1',
        type: 'linear',
        range: [0, vm.chart.width],
        minZero: true
      };
      vm._scales.x = vm.utils.generateScale(vm._data, config);

      config = {
        column: vm._config.value,
        type: 'linear',
        range: [vm.chart.height, 0],
        minZero: true
      };
      vm._scales.y = vm.utils.generateScale(vm._data, config);
    }


    //Stack bars on the xAxis
    if (vm._config.orientation === 'horizontal' && vm._config.hasOwnProperty('stackBy')) {
      /* Generate x scale */
      config = {
        column: 'x1',
        type: 'linear',
        range: [0, vm.chart.width],
        minZero: true
      };
      vm._scales.x = vm.utils.generateScale(vm._data, config);

      /* Generate y scale */
      config = {
        column: '',
        type: 'linear',
        range: [vm.chart.height, 0],
        minZero: true
      };
      vm._scales.y = d3.scaleLinear().range(config.range).domain([0, 1]);
    }

    //Stack bars on the yAxis
    if (vm._config.orientation === 'vertical' && vm._config.hasOwnProperty('stackBy')) {
      /* Generate x scale */
      config = {
        column: '',
        txpe: 'linear',
        range: [vm.chart.height, 0],
        minZero: true
      };
      vm._scales.x = d3.scaleLinear().range(config.range).domain([0, 1]);

      /* Generate y scale */
      config = {
        column: vm._config.value,
        type: 'linear',
        range: [0, vm.chart.width],
        minZero: true
      };
      vm._scales.y = vm.utils.generateScale(vm._data, config);
      
    }
    //vm.chart.scales.x = vm._scales.x;
    //vm.chart.scales.y = vm._scales.y;

    if (vm._config.hasOwnProperty('colors'))
      vm._scales.color = d3.scaleOrdinal(vm._config.colors);
    else
      vm._scales.color = d3.scaleOrdinal(d3.schemeCategory10);

    return vm;
  };

  Spineplot.drawLabels = function() {
    var vm = this;

    var groups = vm.chart.svg().selectAll('.division')
    groups.each(function(dat) {
      var el = this;
      dat.stackValues.forEach(function(sv) {

        var rectW = vm._scales.x(sv[0].data[vm._config.value]);
        var rectH = vm._scales.y((sv[0][0] / sv[0].data.totalCollapse)) - vm._scales.y(sv[0][1] / sv[0].data.totalCollapse);
        
        if (rectH > 40) {
          d3.select(el).append('text')
            .attr('class', 'dbox-label')
            .attr('transform', function() {
              return 'translate(' + (vm._scales.x(sv[0].data.x0) + rectW/2) + ',' + (sv[0][1] ? vm._scales.y(sv[0][1] / sv[0].data.totalCollapse) + 20 : vm._scales.y(0) + 20) + ')';
            })
            .text(function() {
              return sv.key;
            });

          /*d3.select(el).append('text')
            .attr('class', 'dbox-label')
            .attr('transform', function() {
              var rectH = vm._scales.x(sv[0].data[vm._config.value]);
              return 'translate(' + (vm._scales.x(sv[0].data.x0) + rectH/2) + ',' + (sv[0][1] ? vm._scales.y(sv[0][1] / sv[0].data.totalCollapse) + 40 : vm._scales.y(0) + 40) + ')';
            })
            .text(function(d) {
              return d.RANGO_EDAD;
            });*/

          d3.select(el).append('text')
            .attr('class', 'dbox-label')
            .attr('transform', function() {
              return 'translate(' + (vm._scales.x(sv[0].data.x0) + rectW/2) + ',' + (sv[0][1] ? vm._scales.y(sv[0][1] / sv[0].data.totalCollapse) + 40 : vm._scales.y(0) + 40) + ')';
            })
            .text(function(d) {
              return d[sv.key] ? vm.utils.format(d[sv.key], 1) : '';
            });

          //COEFFICIENT
          d3.select(el).append('text')
            .attr('class', 'dbox-label-coefficient')
            .attr('transform', function() {
              return 'translate(' + (vm._scales.x(sv[0].data.x0) + rectW/2) + ',' + (sv[0][1] ? vm._scales.y(sv[0][1] / sv[0].data.totalCollapse) + 60 : vm._scales.y(0) + 60) + ')';
            })
            .text(function(d) {
              return d[sv.key + 'coefficient'] ? '(' + d[sv.key + 'coefficient'].toFixed(1) + ')' : '';
            });
        }
      })
    });
  }

  Spineplot.draw = function() {
    var vm = this;
    if (vm._config.hasOwnProperty('stackBy')) {
      if (vm._config.orientation === 'horizontal') vm._drawStackByXAxis();
      if (vm._config.orientation === 'vertical') vm._drawStackByYAxis();
      return vm;
    }

    vm.chart.svg().call(vm._tip);

    const axesTip = vm.utils.d3.tip()
      .attr('class', 'title-tip')
      .html(d => {
        return d[vm._config.category];
      });
    vm.chart.svg().call(axesTip);

    if (vm._config.orientation === 'horizontal') {

      /**
       * x axis tick labels
       */
      let posX = [];
      vm._xLabels = vm.chart.svg().append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + (vm.chart.height + 20) + ')')
        .selectAll('.tick')
        .data(vm._data)
        .enter()
        .append('g')
        .attr('class', 'tick')
        .attr('transform', d => {
          const x = vm._scales.x(d.x0) + (vm._scales.x(d.x1 - d.x0) / 2);
          posX.push(x);
          return 'translate(' + x + ', 8)'; 
        })
        .append('text')
        .attr('text-anchor', 'middle')
        .text(function(d) {
          return d[vm._config.category];
        });

      let labelMaxWidth = d3.min(vm._data, function (d) {
        return (vm._scales.x(d.x1) - vm._scales.x(d.x0)) * 0.9;
      });
      const largestLabelWidth = d3.max(vm._xLabels.nodes(), function (node) {
        return node.getComputedTextLength();
      });
      let removed = [];

      vm._xLabels.each(function (d, index, el) {
        //const currentWidth = this.getComputedTextLength();
        //let labelMaxWidth = (vm._scales.x(d.x1) - vm._scales.x(d.x0)) * 0.9;
        if (largestLabelWidth < (labelMaxWidth * 2)) {
          d3.select(this).call(vm.utils.wrap, labelMaxWidth, axesTip);
        } else {
          d3.select(this)
            .attr('text-anchor', 'end')
            .attr('dy', 0)
            .attr('transform', 'translate(3,-8)rotate(-90)');
          let newLabelMaxWidth = vm._config.size.margin.bottom * 0.9;
          if (this.getComputedTextLength() > newLabelMaxWidth) {
            d3.select(this)
              .on('mouseover', axesTip.show)
              .on('mouseout', axesTip.hide);
            let i = 1;
            while (this.getComputedTextLength() > newLabelMaxWidth) {
              d3.select(this).text(function (d) {
                return (d[vm._config.category] + '').slice(0, -i) + '...';
              }).attr('title', d);
              ++i;
            }
          }
        }

        let textSize = window.getComputedStyle(this, null).getPropertyValue("font-size");
        let numSize = Number(textSize.replace(/\D/g,''));

        if (index !== 0 && index !== vm._data.length - 1) {
          let diffPos1 = posX[index] - posX[index - 1];
          let diffPos2 = posX[index + 1] - posX[index];

          let lessThanPrev = d.value < vm._data[index - 1].value;
          let lessThanPost = d.value < vm._data[index + 1].value;

          if (diffPos1 < numSize - 2 || diffPos2 < numSize - 2) {
            if (lessThanPrev || lessThanPost) {
              d3.select(this).remove();
              removed.push(index);
            }
          }
        }
      });
      

      vm.chart.svg().selectAll('.bar')
        .data(vm._data)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('id', (d, i) => {
          var id = 'spineplot-' + i;
          if (vm._config.id) {
            id = 'spineplot-' + d[vm._config.id];
          }
          return id;
        })
        .attr('x', (d) => vm._scales.x(d.x0) )
        .attr('y', 0)
        .attr('width', d => vm._scales.x(d[vm._config.value]) )
        .attr('height', vm.chart.height ? vm.chart.height : 100)
        .attr('fill', (d) => {
          return vm._scales.color !== false ? vm._scales.color(d[vm._config.fill]) : vm._getQuantileColor(d[vm._config.fill], 'default');
        })
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .style('opacity', 0.9)
        .on('mouseover', function(d, i) {
          if (vm._config.hasOwnProperty('quantiles') && vm._config.quantiles.hasOwnProperty('colorsOnHover')) { //OnHover colors
            d3.select(this).attr('fill', function (d) {
              return vm._getQuantileColor(d[vm._config.fill], 'onHover');
            });
          }
          vm._tip.show(d, d3.select(this).node());

          if (vm._config.hasOwnProperty('onmouseover')) { //External function call, must be after all the internal code; allowing the user to overide 
            vm._config.onmouseover.call(this, d, i);
          }

        })
        .on('mouseout', function (d, i) {
          if (vm._config.hasOwnProperty('quantiles') && vm._config.quantiles.hasOwnProperty('colorsOnHover')) { //OnHover reset default color
            d3.select(this).attr('fill', function (d) {
              return vm._getQuantileColor(d[vm._config.fill], 'default');
            });
          }
          vm._tip.hide();

          if (vm._config.hasOwnProperty('onmouseout')) { //External function call, must be after all the internal code; allowing the user to overide 
            vm._config.onmouseout.call(this, d, i);
          }
        })
        .on('click', function (d, i) {
          if (vm._config.hasOwnProperty('click')) {
            vm._config.onclick.call(this, d, i);
          }
        });
    }
    return vm;
  };


  //
  /** 
   * Draw bars grouped by 
   */
  Spineplot._drawStackByXAxis = function () {
    var vm = this;
    vm._tip.html(vm._config.tip || function (d) {
      var cat = '';
      cat += '<span>' + d.key + '</span>';
      if (d.key !== d[0].data[vm._config.category]) {
        cat += '<br><span>' + vm.utils.format(d[0].data[d.key], 1) + '</span>';
        cat += '<br><span>' + d[0].data[vm._config.category] + '</span>';
        cat += '<br><span>' + vm.utils.format(d[0].data[vm._config.value], 1) + '</span>';
      } else {
        cat += '<br><span>' + vm.utils.format(d[0].data[d.key], 1) + '</span>';
      }
      return cat;
    });
    vm.chart.svg().call(vm._tip);

    const axesTip = vm.utils.d3.tip()
      .attr('class', 'title-tip')
      .html(d => {
        return d[vm._config.category];
      });
    vm.chart.svg().call(axesTip);

    /**
     * x axis labels
     */
    vm._xLabels = vm.chart.svg().append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + (vm.chart.height + 20) + ')')
      .selectAll('g')
      .data(vm._data)
      .enter()
      .append('g')
      .attr('class', 'tick')
      .attr('transform', d => {
        const x = vm._scales.x(d.x0) + (vm._scales.x(d.x1 - d.x0) / 2);
        return 'translate(' + x + ', 0)';
      })
      .append('text')
      .attr('text-anchor', 'middle')
      .text(d => d[vm._config.category]);

    let labelMaxWidth = d3.min(vm._data, function(d) {
      return (vm._scales.x(d.x1) - vm._scales.x(d.x0)) * 0.9;
    });
    const largestLabelWidth = d3.max(vm._xLabels.nodes(), function (node) {
      return node.getComputedTextLength();
    });
    
    vm._xLabels.each(function (d) {
      //const currentWidth = this.getComputedTextLength();
      //let labelMaxWidth = (vm._scales.x(d.x1) - vm._scales.x(d.x0)) * 0.9;
      if (largestLabelWidth < (labelMaxWidth * 2)) {
        d3.select(this).call(vm.utils.wrap, labelMaxWidth, axesTip);
      } else {
        d3.select(this)
          .attr('text-anchor', 'end')
          .attr('dy', 0)
          .attr('transform', 'translate(3,-8)rotate(-90)');
        let newLabelMaxWidth = vm._config.size.margin.bottom * 0.9;
        if (this.getComputedTextLength() > newLabelMaxWidth) {
          d3.select(this)
            .on('mouseover', axesTip.show)
            .on('mouseout', axesTip.hide);
          let i = 1;
          while (this.getComputedTextLength() > newLabelMaxWidth) {
            d3.select(this).text(function (d) {
              return (d[vm._config.category] + '').slice(0, -i) + '...';
            }).attr('title', d);
            ++i;
          }
        }
      }
    });
      
    var groups = vm.chart.svg().append('g')
      .selectAll('g')
      .data(vm._data)
      .enter().append('g')
      .attr('class', 'division');

    groups.selectAll('rect')
      .data(function (d) {
        return d.stackValues;
      })
      .enter().append('rect')
      .attr('y', function (d) {
        return d[0][1] ? vm._scales.y(d[0][1] / d[0].data.totalCollapse) : vm._scales.y(0);
      })
      .attr('x', function (d) {
        return vm._scales.x(d[0].data.x0);
      })
      .attr('width', function (d) {
        return vm._scales.x(d[0].data[vm._config.value]);
      })
      .attr('height', function (d) {
        var h = vm._scales.y((d[0][0] / d[0].data.totalCollapse)) - vm._scales.y(d[0][1] / d[0].data.totalCollapse)
        return h;
      })
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('fill', function (d) {
        return vm._scales.color(d[vm._config.fill]);
      })
      .on('mouseover', function (d, i) {
        if (vm._config.hasOwnProperty('quantiles') && vm._config.quantiles.hasOwnProperty('colorsOnHover')) { //OnHover colors
          d3.select(this).attr('fill', function (d) {
            return vm._getQuantileColor(d[vm._config.fill], 'onHover');
          });
        }
        vm._tip.show(d, d3.select(this).node());

        if (vm._config.hasOwnProperty('onmouseover')) {
          //External function call. It must be after all the internal code; allowing the user to overide 
          vm._config.onmouseover.call(this, d, i);
        }

      })
      .on('mouseout', function (d, i) {
        if (vm._config.hasOwnProperty('quantiles') && vm._config.quantiles.hasOwnProperty('colorsOnHover')) { //OnHover reset default color
          d3.select(this).attr('fill', function (d) {
            return vm._getQuantileColor(d[vm._config.fill], 'default');
          });
        }
        vm._tip.hide();

        if (vm._config.hasOwnProperty('onmouseout')) { //External function call, must be after all the internal code; allowing the user to overide 
          vm._config.onmouseout.call(this, d, i);
        }
      })
      .on('click', function (d, i) {
        if (vm._config.hasOwnProperty('click')) {
          vm._config.onclick.call(this, d, i);
        }
      });

      Spineplot.drawLabels();
  };

  Spineplot._drawStackByYAxis = function () {
    var vm = this;

    vm._tip.html(vm._config.tip || function (d) {
      var html = '<div><span>' + d[vm._config.category] + '<span><br>';
      for (var k in d.data) {
        if ((d[1] - d[0]) == d.data[k]) {
          html += '<span>' + k + '</span>';
        }
      }
      html += '<br>' + vm.utils.format(d[1] - d[0]);
      return html;
    });

    vm.chart.svg().call(vm._tip);

    vm.chart.svg().append('g')
      .selectAll('g')
      .data(vm._data)
      .enter().append('g')
      .attr('class', 'division')
      .attr('fill', function (d) {
        return vm._scales.color(d.key);
      })
      .selectAll('rect')
      .data(function (d) {
        return d;
      })
      .enter().append('rect')
      .attr('y', function (d) {
        return vm._scales.y(d.data[vm._config.value]);
      })
      .attr('x', function (d) {
        return vm._scales.x(d[0]);
      })
      .attr('height', vm._scales.y.bandwidth())
      .attr('width', function (d) {
        return vm._scales.x(d[1]) - vm._scales.x(d[0]);
      })
      .on('mouseover', function (d, i) {
        if (vm._config.hasOwnProperty('quantiles') && vm._config.quantiles.hasOwnProperty('colorsOnHover')) { //OnHover colors
          d3.select(this).attr('fill', function (d) {
            return vm._getQuantileColor(d[vm._config.fill], 'onHover');
          });
        }
        vm._tip.show(d, d3.select(this).node());

        if (vm._config.hasOwnProperty('onmouseover')) {
          //External function call. It must be after all the internal code; allowing the user to overide 
          vm._config.onmouseover.call(this, d, i);
        }

      })
      .on('mouseout', function (d, i) {
        if (vm._config.hasOwnProperty('quantiles') && vm._config.quantiles.hasOwnProperty('colorsOnHover')) { //OnHover reset default color
          d3.select(this).attr('fill', function (d) {
            return vm._getQuantileColor(d[vm._config.fill], 'default');
          });
        }
        vm._tip.hide();

        if (vm._config.hasOwnProperty('onmouseout')) { //External function call, must be after all the internal code; allowing the user to overide 
          vm._config.onmouseout.call(this, d, i);
        }
      })
      .on('click', function (d, i) {
        if (vm._config.hasOwnProperty('click')) {
          vm._config.onclick.call(this, d, i);
        }
      });

  };

  Spineplot._setQuantile = function (data) {
    var vm = this;
    var values = [];
    var quantile = [];

    if (vm._config.quantiles && vm._config.quantiles.predefinedQuantiles &&
      vm._config.quantiles.predefinedQuantiles.length > 0) {
      return vm._config.quantiles.predefinedQuantiles;
    }

    data.forEach(function (d) {
      values.push(+d[vm._config.fill]);
    });

    values.sort(vm.utils.sortAscending);

    //@TODO use quantile scale instead of manual calculations 
    if (vm._config && vm._config.quantiles && vm._config.quantiles.buckets) {

      if (vm._config.quantiles.ignoreZeros === true) {
        var aux = _.dropWhile(values, function (o) {
          return o <= 0;
        });
        //aux.unshift(values[0]);  

        quantile.push(values[0]);
        quantile.push(0);

        for (var i = 1; i <= vm._config.quantiles.buckets - 1; i++) {
          quantile.push(d3.quantile(aux, i * 1 / (vm._config.quantiles.buckets - 1)));
        }

      } else {
        quantile.push(d3.quantile(values, 0));
        for (var j = 1; j <= vm._config.quantiles.buckets; j++) {
          quantile.push(d3.quantile(values, j * 1 / vm._config.quantiles.buckets));
        }
      }

    } else {
      quantile = [d3.quantile(values, 0), d3.quantile(values, 0.2), d3.quantile(values, 0.4), d3.quantile(values, 0.6), d3.quantile(values, 0.8), d3.quantile(values, 1)];
    }

    //@TODO - VALIDATE WHEN ZEROS NEED TO BE PUT ON QUANTILE 1 AND RECALCULATE NON ZERO VALUES INTO THE REST OF THE BUCKETS
    if (vm._config.quantiles && vm._config.quantiles.buckets && vm._config.quantiles.buckets === 5) {

      if (quantile[1] === quantile[2] && quantile[2] === quantile[3] && quantile[3] === quantile[4] && quantile[4] === quantile[5]) {
        quantile = [d3.quantile(values, 0), d3.quantile(values, 0.2)];
      }
    }

    return quantile;
  };

  Spineplot._getQuantileColor = function (d, type) {
    var vm = this;
    var total = parseFloat(d);

    //@TODO use quantile scale instead of manual calculations 
    if (vm._config && vm._config.bars.quantiles && vm._config.bars.quantiles.colors) {
      if (vm._quantiles.length > 2) {

        if (vm._config && vm._config.bars.min !== undefined && vm._config.bars.max !== undefined) {
          if (total < vm._config.bars.min || total > vm._config.bars.max) {
            return vm._config.bars.quantiles.outOfRangeColor;
          }
        } else {
          if (total < vm._minMax[0] || total > vm._minMax[1]) {
            return vm._config.bars.quantiles.outOfRangeColor;
          }
        }

        if (type == 'default') {
          if (total <= vm._quantiles[1]) {
            return vm._config.bars.quantiles.colors[0]; //'#f7c7c5';
          } else if (total <= vm._quantiles[2]) {
            return vm._config.bars.quantiles.colors[1]; //'#e65158';
          } else if (total <= vm._quantiles[3]) {
            return vm._config.bars.quantiles.colors[2]; //'#c20216';
          } else if (total <= vm._quantiles[4]) {
            return vm._config.quantiles.colors[3]; //'#750000';
          } else if (total <= vm._quantiles[5]) {
            return vm._config.quantiles.colors[4]; //'#480000';
          }
        }

        if (type == 'onHover' && vm._config.hasOwnProperty('quantiles') && vm._config.quantiles.hasOwnProperty('colorsOnHover')) {
          if (total <= vm._quantiles[1]) {
            return vm._config.quantiles.colorsOnHover[0]; //'#f7c7c5';
          } else if (total <= vm._quantiles[2]) {
            return vm._config.quantiles.colorsOnHover[1]; //'#e65158';
          } else if (total <= vm._quantiles[3]) {
            return vm._config.quantiles.colorsOnHover[2]; //'#c20216';
          } else if (total <= vm._quantiles[4]) {
            return vm._config.quantiles.colorsOnHover[3]; //'#750000';
          } else if (total <= vm._quantiles[5]) {
            return vm._config.quantiles.colorsOnHover[4]; //'#480000';
          }
        }

      }
    }

    if (vm._quantiles.length == 2) {
      /*if(total === 0 ){
        return d4theme.colors.quantiles[0];//return '#fff';
      }else if(total <= vm._quantiles[1]){
        return d4theme.colors.quantiles[1];//return '#f7c7c5';
      }*/
      if (total <= vm._quantiles[1]) {
        return vm._config.quantiles.colors[0]; //'#f7c7c5';
      }
    }

  };

  Spineplot.init(config);
  return Spineplot;
}
