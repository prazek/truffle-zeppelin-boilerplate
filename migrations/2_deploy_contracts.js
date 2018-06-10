var KittyHubChannel = artifacts.require("./KittyHubChannel.sol");

module.exports = function(deployer) {
  deployer.deploy(KittyHubChannel, 20);
};
