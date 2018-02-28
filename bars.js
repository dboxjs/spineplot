/*
 * Simple Bar chart
 */
export default function(config,api) {

  function Bars(config, api) {
    var vm = this;
    vm.api = api; 

    vm._config = config ? config : {};
    vm._data = [];
    vm._config.colorScale = d3.schemeCategory20c;
    vm._config._format = function(d){
      if(d % 1 == 0){
        return d3.format(",.0f")(d);
      } else if(d < 1 && d > 0) {
        return d3.format(",.2f")(d);
      } else {
        return d3.format(",.1f")(d);
      }
    };
    vm._scales = {};
    //vm._tip = d3.tip().attr('class', 'd3-tip tip-bars').html(vm._config.data.tip || function(d){ return d;});
    vm._tip = d3.tip()
      .attr('class', 'd3-tip')
      .direction('n')
      .html(vm._config.tip || function(d){ return vm._config._format(d[vm._config.y])});
  }

  //-------------------------------
  //User config functions
  Bars.prototype.id = function(columnName) {
    var vm = this;
    vm._config.id = columnName;
    return vm;
  }

  Bars.prototype.x = function(columnName) {
    var vm = this;
    vm._config.x = columnName;
    return vm;
  }

  Bars.prototype.y = function(columnName) {
    var vm = this;
    vm._config.y = columnName;
    return vm;
  }

  /**
   * Used to draw a bar chart with multiple bars per group
   * @param {array} columns 
   */
  Bars.prototype.groupBy = function(columns) {
    var vm = this;
    vm._config.groupBy = columns;
    return vm;
  }

  /**
   * Used to draw a bar chart stacked with multiple bars per group
   * @param {array} columns 
   */
  Bars.prototype.stackBy = function(columnName) {
    var vm = this;
    vm._config.stackBy = columnName;
    return vm;
  }

  /**
   * column name used for the domain values
   * @param {string} columnName 
   */
  Bars.prototype.color = function(columnName) {
    var vm = this;
    vm._config.color = columnName;
    return vm;
  }

  /**
   * array of values used 
   * @param {array or scale} columnName 
   */
  Bars.prototype.colorScale = function(colorScale) {
    var vm = this;
    if(Array.isArray(colorScale)) {
      //Using an array of colors for the range 
      vm._config.colorScale = colorScale;
    } else {
      //Using a preconfigured d3.scale
      vm._scales.color = colorScale;
      vm._config.colorScale = colorScale.range();
    }
    return vm;
  }

  Bars.prototype.sortBy = function(option) {
    //option = string [asc,desc] 
    //option = array for groupBy and stackBy
    var vm = this;
    vm._config.sortBy = option;
    return vm;
  }

  Bars.prototype.format = function(format) {
    var vm = this;
    if (typeof format == 'function' || format instanceof Function)
      vm._config._format = format;
    else
      vm._config._format = d3.format(format);
    return vm;
  }

  Bars.prototype.tip = function(tip) {
    var vm = this;
    vm._config.tip = tip; 
    return vm;
  }

  Bars.prototype.legend = function(legend) {
    var vm = this;
    vm._config.legend = legend; 
    return vm;
  }


  //-------------------------------
  //Triggered by the chart.js;
  Bars.prototype.data = function(data) {
    var vm = this;
  
    if(vm._config.data.filter){
      //In case we want to filter observations
      data = data.filter(vm._config.data.filter);
    }
    
    if(vm._config.hasOwnProperty('stackBy') && Array.isArray(vm._config.stackBy) && vm._config.stackBy.length > 0 ){
      // Used in a stackbar, transpose the data into layers 
      vm._data = d3.stack().keys(vm._config.stackBy)(data)
    }else{
      // Normal bar, save the data as numbers 
      vm._data = data.map(function(d) {
        if(d[vm._config.x] == Number(d[vm._config.x]))
          d[vm._config.x] = +d[vm._config.x];
        if(d[vm._config.y] == Number(d[vm._config.y]))
          d[vm._config.y] = +d[vm._config.y];
        return d;
      });
    }

    //@TODO - ALLOW MULITPLE SORTS
    if(vm._config.sortBy){
      vm._data = vm._data.sort(function(a, b) {
        return a[vm._config.sortBy[0]] - b[vm._config.sortBy[0]];
      });
    }

    if(vm._config.hasOwnProperty('bars') && vm._config.bars.hasOwnProperty('quantiles'){
      vm._quantiles = vm._setQuantile(data);
      vm._minMax = d3.extent(data, function(d) { return +d[vm._config.color]; })
    }
      
    return vm;
  }

  Bars.prototype.scales = function(s) {
    var vm = this;
    var config; 
    //vm._scales = s;
    /* Use
    * vm._config.x
    * vm._config.xAxis.scale
    * vm._config.y
    * vm._config.yAxis.scale
    * vm._data
    */
    //Normal bars 
    if(vm._config.hasOwnProperty('x')  && vm._config.hasOwnProperty('y') ){
      config = {
        column: vm._config.x,
        type: vm._config.xAxis.scale,
        range: [0, vm.api.chart.width],
        minZero: vm._config.xAxis.minZero
      };
      vm._scales.x = vm.api.utils.generateScale(vm._data, config);

      config = {
        column: vm._config.y,
        type: vm._config.yAxis.scale,
        range: [vm.api.chart.height, 0],
        minZero: vm._config.xAxis.minZero
      };
      vm._scales.y = vm.api.utils.generateScale(vm._data, config);
    }

    //GroupBy bars on the xAxis
    if(vm._config.hasOwnProperty('x') && vm._config.hasOwnProperty('groupBy')){
      /* Generate x scale */
      config = {
          column: vm._config.x,
          type: vm._config.xAxis.scale,
          groupBy: 'parent', 
          range: [0, vm.api.chart.width],
          minZero: vm._config.xAxis.minZero
      };
      vm._scales.x = vm.api.utils.generateScale(vm._data, config);

      /* Generate groupBy scale */
      config = {
          column: vm._config.groupBy,
          type: 'band',
          groupBy: 'children', 
          range: [0, vm._scales.x.bandwidth()],
      };
      vm._scales.groupBy = vm.api.utils.generateScale(vm._data, config);
      //vm.api.chart.scales.groupBy = vm._scales.groupBy; 
      
      /* Generate y scale */
      config = {
        column: vm._config.groupBy,
        type: vm._config.yAxis.scale,
        groupBy: 'data', 
        range: [vm.api.chart.height, 0],
        minZero: vm._config.xAxis.minZero
      };
      vm._scales.y = vm.api.utils.generateScale(vm._data, config);
    }

    //GroupBy bars on the yAxis
    if(vm._config.hasOwnProperty('y') && vm._config.hasOwnProperty('groupBy')){
      /* Generate y scale */
      config = {
          column: vm._config.y,
          type: vm._config.yAxis.scale,
          groupBy: 'parent', 
          range: [0, vm.api.chart.height],
          minZero: vm._config.xAxis.minZero
      };
      vm._scales.y = vm.api.utils.generateScale(vm._data, config);

      /* Generate groupBy scale */
      config = {
          column: vm._config.groupBy,
          type: 'band',
          groupBy: 'children', 
          range: [0, vm._scales.y.bandwidth()],
      };
      vm._scales.groupBy = vm.api.utils.generateScale(vm._data, config);
      //vm.api.chart.scales.groupBy = vm._scales.groupBy; 
      
      /* Generate x scale */
      config = {
        column: vm._config.groupBy,
        type: vm._config.xAxis.scale,
        groupBy: 'data', 
        range: [0, vm.api.chart.width],
        minZero: vm._config.xAxis.minZero
      };
      vm._scales.x = vm.api.utils.generateScale(vm._data, config);
    }


    //Stack bars on the xAxis
    if(vm._config.hasOwnProperty('x') && vm._config.hasOwnProperty('stackBy')){
      /* Generate x scale */
      config = {
          column: vm._config.x,
          type: vm._config.xAxis.scale,
          stackBy: 'parent', 
          range: [0, vm.api.chart.width],
          minZero: vm._config.xAxis.minZero
      };
      vm._scales.x = vm.api.utils.generateScale(vm._data, config);
      
      /* Generate y scale */
      config = {
        column: '',
        stackBy: 'data',
        type: vm._config.yAxis.scale,
        range: [vm.api.chart.height, 0],
        minZero: vm._config.xAxis.minZero
      };
      vm._scales.y = vm.api.utils.generateScale(vm._data, config);
    }

     //Stack bars on the yAxis
     if(vm._config.hasOwnProperty('y') && vm._config.hasOwnProperty('stackBy')){
      /* Generate x scale */
      config = {
          column: '',
          type: vm._config.xAxis.scale,
          stackBy: 'data', 
          range: [0, vm.api.chart.width],
          minZero: vm._config.xAxis.minZero
      };
      vm._scales.x = vm.api.utils.generateScale(vm._data, config);
      
      /* Generate y scale */
      config = {
        column: vm._config.y,
        stackBy: 'parent',
        type: vm._config.yAxis.scale,
        range: [vm.api.chart.height, 0],
        minZero: vm._config.xAxis.minZero
      };
      vm._scales.y = vm.api.utils.generateScale(vm._data, config);
    }


    //vm.api.chart.scales.x = vm._scales.x;
    //vm.api.chart.scales.y = vm._scales.y;

    if(!vm._scales.hasOwnProperty('color')){
      if(vm._config.hasOwnProperty('colorScale'))
        vm._scales.color = d3.scaleOrdinal(vm._config.colorScale);
      else
        vm._scales.color = d3.scaleOrdinal(d3.schemeCategory10);
    }
    
    if(vm._config.hasOwnProperty('bars') && vm._config.bars.hasOwnProperty('quantiles'))
      vm._scales.color = false;
    return vm;
  }

  Bars.prototype.draw = function() {
    var vm = this;

    if(vm._config.hasOwnProperty('groupBy') ){
      if(vm._config.hasOwnProperty('x') ) vm.drawGroupByXAxis();
      if(vm._config.hasOwnProperty('y') )  vm.drawGroupByYAxis();
      return vm; 
    }

    if(vm._config.hasOwnProperty('stackBy')){
      if(vm._config.hasOwnProperty('x')) vm.drawStackByXAxis();
      if(vm._config.hasOwnProperty('y')) vm.drawStackByYAxis();
      return vm; 
    } 

    vm.api.chart.svg().call(vm._tip);
  
    vm.api.chart.svg().selectAll(".bar")
      .data(vm._data)
      .enter().append("rect")
        .attr("class", "bar")
        .attr("id", function(d,i) {
          var id = "bars-" + i;
          if(vm._config.id){
            id = "bars-" + d[vm._config.id];
          }  
          return id
        })
        .attr("x", function(d) { 
          var value = vm._scales.x(d[vm._config.x]); 
          if (vm._config.xAxis.scale == 'linear') value = 0; 
          return value
        })
        .attr("y", function(d) { 
          return vm._scales.y(d[vm._config.y]);
        })
        .attr("width", function(d){ 
          return vm._scales.x.bandwidth ? vm._scales.x.bandwidth() : vm._scales.x(d[vm._config.x]) 
        })
        .attr("height", function(d) { 
          return vm._scales.y.bandwidth ? vm._scales.y.bandwidth() :  vm.api.chart.height - vm._scales.y(d[vm._config.y]); 
        })
        .attr("fill", function(d){             
          return vm._scales.color !== false ? vm._scales.color(d[vm._config.color]): vm._getQuantileColor(d[vm._config.color],'default');
        })
        .style("opacity", 0.9)
        .on('mouseover', function(d,i) {
          if(vm._config.hasOwnProperty('bars') && vm._config.bars.hasOwnProperty('quantiles') && vm._config.bars.quantiles.hasOwnProperty('colorsOnHover')){ //OnHover colors
            d3.select(this).attr('fill', function(d) {
                return vm._getQuantileColor(d[vm._config.color],'onHover');
            })
          }
          vm._tip.show(d, d3.select(this).node());

          if (vm._config.data.onmouseover) { //External function call, must be after all the internal code; allowing the user to overide 
            vm._config.data.onmouseover.call(this, d, i);
          }

        })
        .on('mouseout', function(d,i) {
          if(vm._config.bars && vm._config.bars.quantiles.colorsOnHover){ //OnHover reset default color
            d3.select(this).attr('fill', function(d) {
              return vm._getQuantileColor(d[vm._config.color],'default');
            })
          }
          vm._tip.hide();

          if (vm._config.data.onmouseout) { //External function call, must be after all the internal code; allowing the user to overide 
            vm._config.data.onmouseout.call(this, d, i)
          }
        })
        .on('click', function(d,i) {
          if (vm._config.data.onclick) {
            vm._config.data.onclick.call(this, d, i)
          }
        });

    
    
    
    
    /*if(vm._config.xAxis.enabled) {
       vm.api.chart.svg().append("g")
          .attr("class", "xAxis axis")
          .attr("transform", "translate(0," + vm.api.chart.height + ")")
          .call(d3.axisBottom(vm._scales.x)
            .tickValues(vm._config.xAxis.tickValues)
            .tickFormat(vm._config.xAxis.tickFormat)
          );
        //vm.api.chart.svg().selectAll(".xAxis.axis text").attr("transform", "translate(0,10)rotate(-20)");
    }*/

    /*if(vm._config.yAxis.enabled) {
      if(vm._config.yAxis.position == 'right') {
        var yAxis = d3.axisRight(vm._scales.y)
              .ticks(vm._config.yAxis.ticks)
              .tickValues(vm._config.yAxis.tickValues)
              .tickFormat(vm._config.yAxis.tickFormat);
      } else {
        var yAxis = d3.axisLeft(vm._scales.y)
              .ticks(vm._config.yAxis.ticks)
              .tickValues(vm._config.yAxis.tickValues)
              .tickFormat(vm._config.yAxis.tickFormat);
      }
      var axisY = vm.api.chart.svg().append("g")
          .attr("class", "yAxis axis");
      if(vm._config.yAxis.position == 'right')
        axisY.attr("transform", "translate(" + vm.api.chart.width + ",0)");
      axisY.call(yAxis);
        /*
        Axis Title
        .append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", 6)
          .attr("dy", "0.71em")
          .attr("text-anchor", "end")
          .text("Frequency");
        
    }*/
    
    
    
    return vm;
  } 

  /** 
   * Draw bars grouped by 
  */
  Bars.prototype.drawGroupByXAxis = function(){
    var vm = this;
    vm._tip.html(vm._config.tip || function(d){ 
      return d.key + '<br>' +vm._config._format(d.value)
    });

    vm.api.chart.svg().call(vm._tip);
    
    vm.api.chart.svg().append("g")
      .selectAll("g")
      .data(vm._data)
      .enter().append("g")
        .attr("transform", function(d) { return "translate(" + vm._scales.x(d[vm._config.x]) + ",0)"; })
      .selectAll("rect")
      .data(function(d) { return vm._config.groupBy.map(function(key) { return {key: key, value: d[key]}; }); })
      .enter().append("rect")
        .attr("x", function(d) { return vm._scales.groupBy(d.key); })
        .attr("y", function(d) { 
          return vm._scales.y(d.value); 
        })
        .attr("width", vm._scales.groupBy.bandwidth())
        .attr("height", function(d) { return vm.api.chart.height - vm._scales.y(d.value); })
        .attr("fill", function(d) { return vm._scales.color(d.key); }) 
        .on('mouseover', function(d,i) {
          if(vm._config.hasOwnProperty('bars') && vm._config.bars.hasOwnProperty('quantiles') && vm._config.bars.quantiles.hasOwnProperty('colorsOnHover')){ //OnHover colors
            d3.select(this).attr('fill', function(d) {
                return vm._getQuantileColor(d[vm._config.color],'onHover');
            })
          }
          vm._tip.show(d, d3.select(this).node());

          if (vm._config.data.onmouseover) { 
            //External function call. It must be after all the internal code; allowing the user to overide 
            vm._config.data.onmouseover.call(this, d, i);
          }

        })
        .on('mouseout', function(d,i) {
          if(vm._config.bars && vm._config.bars.quantiles.colorsOnHover){ //OnHover reset default color
            d3.select(this).attr('fill', function(d) {
              return vm._getQuantileColor(d[vm._config.color],'default');
            })
          }
          vm._tip.hide();

          if (vm._config.data.onmouseout) { //External function call, must be after all the internal code; allowing the user to overide 
            vm._config.data.onmouseout.call(this, d, i)
          }
        })
        .on('click', function(d,i) {
          if (vm._config.data.onclick) {
            vm._config.data.onclick.call(this, d, i)
          }
        });

   
  }

  Bars.prototype.drawGroupByYAxis = function(){
    var vm = this;
    vm._tip.html(vm._config.tip || function(d){ 
      return d.key + '<br>' +vm._config._format(d.value)
    });

    vm.api.chart.svg().call(vm._tip);
    
    vm.api.chart.svg().append("g")
      .selectAll("g")
      .data(vm._data)
      .enter().append("g")
        .attr("transform", function(d) { return "translate(0,"+ vm._scales.y(d[vm._config.y]) +" )"; })
      .selectAll("rect")
      .data(function(d) { return vm._config.groupBy.map(function(key) { return {key: key, value: d[key]}; }); })
      .enter().append("rect")
        .attr("y", function(d) { return vm._scales.groupBy(d.key); })
        .attr("x", 0)
        .attr("width", function(d) { return  vm._scales.x(d.value); })
        .attr("height", vm._scales.groupBy.bandwidth())
        .attr("fill", function(d) { return vm._scales.color(d.key); }) 
        .on('mouseover', function(d,i) {
          if(vm._config.hasOwnProperty('bars') && vm._config.bars.hasOwnProperty('quantiles') && vm._config.bars.quantiles.hasOwnProperty('colorsOnHover')){ //OnHover colors
            d3.select(this).attr('fill', function(d) {
                return vm._getQuantileColor(d[vm._config.color],'onHover');
            })
          }
          vm._tip.show(d, d3.select(this).node());

          if (vm._config.data.onmouseover) { 
            //External function call. It must be after all the internal code; allowing the user to overide 
            vm._config.data.onmouseover.call(this, d, i);
          }

        })
        .on('mouseout', function(d,i) {
          if(vm._config.bars && vm._config.bars.quantiles.colorsOnHover){ //OnHover reset default color
            d3.select(this).attr('fill', function(d) {
              return vm._getQuantileColor(d[vm._config.color],'default');
            })
          }
          vm._tip.hide();

          if (vm._config.data.onmouseout) { //External function call, must be after all the internal code; allowing the user to overide 
            vm._config.data.onmouseout.call(this, d, i)
          }
        })
        .on('click', function(d,i) {
          if (vm._config.data.onclick) {
            vm._config.data.onclick.call(this, d, i)
          }
        });

  }

  Bars.prototype.drawStackByXAxis = function(){
    var vm = this;
    vm._tip.html(vm._config.tip || function(d){ 
      var cat = ''
      for (var k in d.data) {
        if( (d[1]-d[0]) == d.data[k]){
          cat = k;
        }
      }
      return cat + '<br>' +vm._config._format(d[1]-d[0])
    });

    vm.api.chart.svg().call(vm._tip);

    vm.api.chart.svg().append("g")
      .selectAll("g")
      .data(vm._data)
      .enter().append("g")
        .attr("fill", function(d) {return vm._scales.color(d.key); })
        //.attr("transform", function(d) { return "translate(0,"+ vm._scales.y(d[vm._config.y]) +" )"; })
      .selectAll("rect")
      .data(function(d) {  return d; })
      .enter().append("rect")
        .attr("y", function(d) {  return vm._scales.y(d[1]); })
        .attr("x", function(d) { return vm._scales.x(d.data[vm._config.x]); })
        .attr("width", function(d){ return vm._scales.x.bandwidth()})
        .attr("height", function(d) { return vm._scales.y(d[0]) - vm._scales.y(d[1]); })
        .on('mouseover', function(d,i) {
          if(vm._config.hasOwnProperty('bars') && vm._config.bars.hasOwnProperty('quantiles') && vm._config.bars.quantiles.hasOwnProperty('colorsOnHover')){ //OnHover colors
            d3.select(this).attr('fill', function(d) {
                return vm._getQuantileColor(d[vm._config.color],'onHover');
            })
          }
          vm._tip.show(d, d3.select(this).node());

          if (vm._config.data.onmouseover) { 
            //External function call. It must be after all the internal code; allowing the user to overide 
            vm._config.data.onmouseover.call(this, d, i);
          }

        })
        .on('mouseout', function(d,i) {
          if(vm._config.bars && vm._config.bars.quantiles.colorsOnHover){ //OnHover reset default color
            d3.select(this).attr('fill', function(d) {
              return vm._getQuantileColor(d[vm._config.color],'default');
            })
          }
          vm._tip.hide();

          if (vm._config.data.onmouseout) { //External function call, must be after all the internal code; allowing the user to overide 
            vm._config.data.onmouseout.call(this, d, i)
          }
        })
        .on('click', function(d,i) {
          if (vm._config.data.onclick) {
            vm._config.data.onclick.call(this, d, i)
          }
        });
        

  }

  Bars.prototype.drawStackByYAxis = function(){
    var vm = this;

    vm._tip.html(vm._config.tip || function(d){ 
      var cat = ''
      for (var k in d.data) {
        if( (d[1]-d[0]) == d.data[k]){
          cat = k;
        }
      }
      return cat + '<br>' +vm._config._format(d[1]-d[0])
    });

    vm.api.chart.svg().call(vm._tip);

    vm.api.chart.svg().append("g")
      .selectAll("g")
      .data(vm._data)
      .enter().append("g")
        .attr("fill", function(d) {return vm._scales.color(d.key); })
      .selectAll("rect")
      .data(function(d) { return d; })
      .enter().append("rect")
        .attr("y", function(d) { return vm._scales.y(d.data[vm._config.y]); })
        .attr("x", function(d) { return vm._scales.x(d[0]); })
        .attr("height", function(d){ return vm._scales.y.bandwidth()})
        .attr("width", function(d) { return vm._scales.x(d[1]) - vm._scales.x(d[0]); })
        .on('mouseover', function(d,i) {
          if(vm._config.hasOwnProperty('bars') && vm._config.bars.hasOwnProperty('quantiles') && vm._config.bars.quantiles.hasOwnProperty('colorsOnHover')){ //OnHover colors
            d3.select(this).attr('fill', function(d) {
                return vm._getQuantileColor(d[vm._config.color],'onHover');
            })
          }
          vm._tip.show(d, d3.select(this).node());

          if (vm._config.data.onmouseover) { 
            //External function call. It must be after all the internal code; allowing the user to overide 
            vm._config.data.onmouseover.call(this, d, i);
          }

        })
        .on('mouseout', function(d,i) {
          if(vm._config.bars && vm._config.bars.quantiles.colorsOnHover){ //OnHover reset default color
            d3.select(this).attr('fill', function(d) {
              return vm._getQuantileColor(d[vm._config.color],'default');
            })
          }
          vm._tip.hide();

          if (vm._config.data.onmouseout) { //External function call, must be after all the internal code; allowing the user to overide 
            vm._config.data.onmouseout.call(this, d, i)
          }
        })
        .on('click', function(d,i) {
          if (vm._config.data.onclick) {
            vm._config.data.onclick.call(this, d, i)
          }
        });
        
  }

  Bars.prototype._setQuantile = function(data){
    var vm = this; 
    var values = [];
    var quantile = []; 

    if(vm._config.bars && vm._config.bars.quantiles &&  vm._config.bars.quantiles.predefinedQuantiles 
        && vm._config.bars.quantiles.predefinedQuantiles.length > 0){
      return vm._config.bars.quantiles.predefinedQuantiles;
    }

    data.forEach(function(d){      
      values.push(+d[vm._config.color]);
    });

    values.sort(d3.ascending);
    
    //@TODO use quantile scale instead of manual calculations 
    if(vm._config && vm._config.bars && vm._config.bars.quantiles && vm._config.bars.quantiles.buckets){

      if(vm._config.bars.quantiles.ignoreZeros === true){
        var aux = _.dropWhile(values, function(o) { return o <= 0 });
        //aux.unshift(values[0]);  

        quantile.push(values[0]);
        quantile.push(0);
        
        for(var i = 1; i <= vm._config.bars.quantiles.buckets - 1; i++ ){        
          quantile.push( d3.quantile(aux,  i* 1/(vm._config.bars.quantiles.buckets - 1) ) )
        }

      }else{
        quantile.push( d3.quantile(values, 0) )
        for(var i = 1; i <= vm._config.bars.quantiles.buckets; i++ ){        
          quantile.push( d3.quantile(values,  i* 1/vm._config.bars.quantiles.buckets ) )
        }
      }
        
    }else{
      quantile = [ d3.quantile(values, 0), d3.quantile(values, 0.2), d3.quantile(values, 0.4), d3.quantile(values, 0.6), d3.quantile(values, 0.8), d3.quantile(values,1) ];
    }
   
    //@TODO - VALIDATE WHEN ZEROS NEED TO BE PUT ON QUANTILE 1 AND RECALCULATE NON ZERO VALUES INTO THE REST OF THE BUCKETS
    if(vm._config.bars && vm._config.bars.quantiles && vm._config.bars.quantiles.buckets && vm._config.bars.quantiles.buckets === 5){

      if( quantile[1] === quantile[2] && quantile[2] === quantile[3] && quantile[3] === quantile[4] && quantile[4] === quantile[5]){
        quantile = [ d3.quantile(values, 0), d3.quantile(values, 0.2) ];
      }
    }
   
    return quantile;
  }

  Bars.prototype._getQuantileColor = function(d,type){
    var vm = this; 
    var total = parseFloat(d);

    //@TODO use quantile scale instead of manual calculations 
    if(vm._config && vm._config.bars && vm._config.bars.quantiles && vm._config.bars.quantiles.colors){
      if(vm._quantiles.length > 2){

        if(vm._config && vm._config.bars && vm._config.bars.min !== undefined && vm._config.bars.max !== undefined){
          if(total < vm._config.bars.min || total > vm._config.bars.max){
            console.log('outOfRangeColor', total, vm._config.bars.min ,vm._config.bars.max)
            return vm._config.bars.quantiles.outOfRangeColor; 
          }
        }else{
          if(total < vm._minMax[0] || total > vm._minMax[1]){
            console.log('outOfRangeColor', total, vm._config.bars.min ,vm._config.bars.max)
            return vm._config.bars.quantiles.outOfRangeColor; 
          }
        }

        if(type == 'default'){
          if(total <= vm._quantiles[1]){
            return vm._config.bars.quantiles.colors[0];//"#f7c7c5";
          }else if(total <= vm._quantiles[2]){
            return vm._config.bars.quantiles.colors[1];//"#e65158";
          }else if(total <= vm._quantiles[3]){
            return vm._config.bars.quantiles.colors[2];//"#c20216";
          }else if(total <= vm._quantiles[4]){
            return vm._config.bars.quantiles.colors[3];//"#750000";
          }else if(total <= vm._quantiles[5]){
            return vm._config.bars.quantiles.colors[4];//"#480000";
          }
        }

        if(type == 'onHover' && vm._config.bars.quantiles.colorsOnHover){
          if(total <= vm._quantiles[1]){
            return vm._config.bars.quantiles.colorsOnHover[0];//"#f7c7c5";
          }else if(total <= vm._quantiles[2]){
            return vm._config.bars.quantiles.colorsOnHover[1];//"#e65158";
          }else if(total <= vm._quantiles[3]){
            return vm._config.bars.quantiles.colorsOnHover[2];//"#c20216";
          }else if(total <= vm._quantiles[4]){
            return vm._config.bars.quantiles.colorsOnHover[3];//"#750000";
          }else if(total <= vm._quantiles[5]){
            return vm._config.bars.quantiles.colorsOnHover[4];//"#480000";
          }
        }

      }
    }

    if(vm._quantiles.length == 2){
      /*if(total === 0 ){
        return d4theme.colors.quantiles[0];//return '#fff';
      }else if(total <= vm._quantiles[1]){
        return d4theme.colors.quantiles[1];//return "#f7c7c5";
      }*/
      if(total <= vm._quantiles[1]){
        return vm._config.bars.quantiles.colors[0];//"#f7c7c5";
      }
    }

  }

  return new Bars(config,api);
}
