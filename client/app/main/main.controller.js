'use strict';

angular.module('dablarStockmarketAppApp')
  .controller('MainCtrl', function ($scope, $http, socket) {
    $scope.isButtonDisabled = false;
    $scope.awesomeThings = [];
    $scope.chartObject = {};

    $scope.chartObject.type = 'LineChart';
    $scope.chartObject.options = {
        'title': 'Markets'
    };


    $scope.chartObject.data = {
      'cols': [ {id: 'd', label: 'Date', type: 'date'} ], 
      'rows': []
    };


    $http.get('/api/things').success(function (awesomeThings) {
      $scope.awesomeThings = awesomeThings;
      socket.syncUpdates('thing', $scope.awesomeThings, function (event, thing, things) {
          if (event === 'created'){
            $scope.addStockToChart(thing.name);
          } else if(event === 'deleted') {
            $scope.deleteStockFromChart(thing.name);
          }

      });

      $scope.awesomeThings.forEach(function (thing) {
        $scope.addStockToChart(thing.name);
      });

    });

    $scope.addThing = function() {
      if($scope.newThing === '' || $scope.awesomeThings.length >= 12) {
        return;
      }
      $scope.newThing = $scope.newThing.toUpperCase();
      $scope.errorMsg = '';
      $scope.isButtonDisabled = true;

      if ( $scope.isInAwesomeThings($scope.newThing) ) {
        $scope.errorMsg = 'It is already in.';
        $scope.isButtonDisabled = false;
        $scope.newThing = '';
        return;
      }

      $http.get('https://www.quandl.com/api/v3/datasets/WIKI/' + $scope.newThing + '/metadata.json?' + 'api_key=K8pB5E3zfsj-uy_Givxs')
          .success(function (quandlData) {
        $http.post('/api/things', { name: $scope.newThing });

      }).error( function (quandlData){
        if (quandlData.quandl_error) {
          $scope.errorMsg = quandlData.quandl_error.message;
        }

      }).finally( function(){
        $scope.newThing = '';
        $scope.isButtonDisabled = false;
      });

    };

    $scope.deleteThing = function(thing) {
      $http.delete('/api/things/' + thing._id);
    };

    $scope.$on('$destroy', function () {
      socket.unsyncUpdates('thing');
    });


    $scope.getIndexOfDataset = function(datasetTitle) {
      var res = -1;

      $scope.awesomeThings.some(function(obj, index) {
        if (obj.name === datasetTitle) {
          res = index;
          return true;
        }
      });
      return res;
    };

    $scope.addStockToChart = function(stockName) {
      var trim_start = 'trim_start=' + new Date().getFullYear() + '-01-01&';

      $http.get('https://www.quandl.com/api/v3/datasets/WIKI/' + stockName + '.json?' + trim_start + 'order=asc&api_key=K8pB5E3zfsj-uy_Givxs')
          .success(function (quandlData) {
        var pos = $scope.getIndexOfDataset(quandlData.dataset.dataset_code) + 1;//+1 bc first value is the date... [0]

        //añado linea de datos nueva
        $scope.chartObject.data.cols[pos] = 
            {id: quandlData.dataset.dataset_code, label: quandlData.dataset.dataset_code, type: 'number'};
      
        quandlData.dataset.data.forEach(function (quandlDataObj) {
          var quandlDate = Date.parse(new Date(quandlDataObj[0]));
          var isInserted = false;
          var isYounger = false;
          var indexToInsert = -1;
          
          $scope.chartObject.data.rows.forEach(function (chartObjData, chartObjIndex){
            //recorro los datos y si existe alguna fecha coincidente la inserto
            if (quandlDate === Date.parse(chartObjData.c[0].v) ) {
              chartObjData.c[pos]  = {v: quandlDataObj[1]};
              isInserted = true;
              return false;
            } else if (quandlDate < Date.parse(chartObjData.c[0].v) ) {
              isYounger = true;
              indexToInsert = chartObjIndex;
              return false;
            }
          });

          if (!isInserted && !isYounger) { //inserto al final del array
            var obj = {c: [ { v: new Date(quandlDataObj[0]) } ] };

            obj.c[pos] = {v: quandlDataObj[1]};

            $scope.chartObject.data.rows.push(obj);                
          } else if (!isInserted && isYounger) { //no existia en el obj chart, lo inserto en la posicion correspondiente
            var obj = {c: [ {v: new Date(quandlDataObj[0])} ]};
            obj.c[pos] = {v: quandlDataObj[1]};

            $scope.chartObject.data.rows.splice(indexToInsert, 0, obj);              
          }

        }); //FIN quandlData.dataset.data.forEach
      }).then(function() {
        $scope.chartObject.data.rows.sort(function(a, b){return b.c[0].v - a.c[0].v; });
      });
    };

    $scope.deleteStockFromChart = function(stockName) {
      var pos = -1;

      $scope.chartObject.data.cols.some(function(obj, index) {
        if (obj.id === stockName) {
          pos = index;
          return true;
        }
      });

      $scope.chartObject.data.rows.forEach(function (chartObjData, chartObjIndex) {
        chartObjData.c.splice(pos, 1);

        var isEmpty = true;
        for (var i = 1; i < chartObjData.c.length && isEmpty; i++) {
          if (chartObjData.c[i] !== null) {
            isEmpty = false;
          }
        }

        if (isEmpty) {
          $scope.chartObject.data.rows.splice( chartObjIndex, 1);
        }
        
      });

      $scope.chartObject.data.cols.splice(pos, 1);
        
    };

    $scope.isInAwesomeThings = function(name) {
      return $scope.awesomeThings.some(function(obj) {
        if (obj.name === name) {
          return true;
        }
      });
    };
  });


/*
https://www.quandl.com/api/v1/datasets/WIKI/AMZN.json?
sort_order=asc&
exclude_headers=true&
trim_start=2015-01-01&
trim_end=2015-010-30&
auth_token=PwyZscKorv3wCa-dEbtX

"https://www.quandl.com/api/v3/datasets/WIKI/AAPL.json?order=asc&exclude_headers=true&start_date=2012-11-01&end_date=2012-11-30&column_index=4&collapse=weekly&transformation=rdiff
*/   