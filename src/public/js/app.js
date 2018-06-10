App = {
  contracts: {},

  init: function () {
    return App.initWeb3();
  },

  initWeb3: function () {
    // Initialize web3 and set the provider to the testRPC.
    if (typeof web3 !== 'undefined') {
      console.log(window.web3);
      console.log("web3 already there?");
      //web3 = new Web3(web3.currentProvider);
    } else {
      // set the provider you want from Web3.providers
      web3 = new Web3('http://127.0.0.1:9545');
    }

    return App.initContract();
  },

  initContract: function () {
    $.getJSON('/contract', function (data) {

      var contract = new web3.eth.contract(data.contract.abi).at(data.address);
      //contract.setProvider(web3.currentProvider);
      // Save for later use
      App.contracts.KittyHubChannel = contract;
      //App.contracts.KittyHubChannel.options.address = data.address;

      App.loadAccountData();
    });

    return App.bindEvents();
  },

  bindEvents: function () {
    $('#ShowPussy').on('click', App.handleShowPussy);
    $('#AddFundsButton').on('click', App.handleAddFunds);

  },


  handleShowPussy: function (event) {
    event.preventDefault();

    console.log("Show kitte");
    $.post( "/kitten", function( data ) {
      console.log("show kitte success");
      $( ".result" ).html( data );
    });
  },

  handleAddFunds: function (event) {
    event.preventDefault();

    console.log("add funds");
    let newBalance = $('#addingBalance').val();
    console.log(newBalance);
    console.log(web3.eth.defaultAccount);

    App.contracts.KittyHubChannel.methods.addFunds().send({from: web3.eth.defaultAccount, value: newBalance});
    //web3.eth.sendTransaction(App.contracts.KittyHubChannel.address, )
  },


  loadAccountData: function () {
    console.log("loading data");
    web3.eth.getAccounts(console.log);
    App.account = web3.eth.defaultAccount;
    console.log(App.account);
    console.log(App.contracts.KittyHubChannel);
    App.contracts.KittyHubChannel.allocatedFunds.call(App.account)
        .then(function (funds) {
          $('#Balance').text(funds);
      }).catch(function (err) {
        console.log("Load account data:");
        console.log(err);
      });

    $.getJSON('/kittensSeen', function (data) {
        console.log("seen" + data.seen);
        $('#KittiesSeen').text(data.seen);
    });

  },

  /*handleReadData: function (event) {
    event.preventDefault();

    // Read the contract ethereum balance
    web3.eth.getBalance(App.contracts.KittyHubChannel.options.address)
      .then(function (result) {
        $('#KittyHubChannelBalance').text(result);
      })
      .catch(function (err) {
        console.log(err.message);
      });

    // Read the value of the price variable in the contract
    App.contracts.KittyHubChannel.methods.price()
      .call()
      .then(function (result) {
        $('#Price').text(result);
      })
      .catch(function (err) {
        console.log(err.message);
      });
  }*/
};

$(function () {
  $(window).load(function () {
    App.init();
  });
});
