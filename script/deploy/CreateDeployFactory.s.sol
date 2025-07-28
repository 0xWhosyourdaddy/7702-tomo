// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {DeployFactory} from "src/test/DeployFactory.sol";

contract CreateDeployFactory is Script {
    bytes32 constant SALT = bytes32(uint256(1));

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployOwner = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        DeployFactory deployFactory = new DeployFactory{salt: SALT}();
        console2.log("Deploy owner: %s", deployOwner);
        console2.log("Deploy factory address: %s", address(deployFactory));
        console2.log("Completed DeployFactory script");
        vm.stopBroadcast();
    }
}