// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {DeployInitHelper} from "./DeployInitHelper.sol";
import {DeployFactory} from "src/test/DeployFactory.sol";
import {Storage} from "src/Storage.sol";
import {ECDSAValidator} from "src/validator/ECDSAValidator.sol";
import {WalletCore} from "src/WalletCore.sol";
import {HelperConfig, NetworkConfig} from "./HelperConfig.s.sol";

contract DeployInit is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        HelperConfig helperConfig = new HelperConfig();
        NetworkConfig memory config = helperConfig.getConfig();

        vm.startBroadcast(deployerPrivateKey);

        address deployOwner = vm.addr(deployerPrivateKey);
        console2.log("Deploy owner: %s", deployOwner);

        DeployFactory deployFactory = DeployFactory(config.deployFactory);
        bytes32 deployFactorySalt = config.deployFactorySalt;
        console2.log("Deploy factory address: %s", address(deployFactory));
        console2.log("Deploy factory salt:");
        console2.logBytes32(deployFactorySalt);

        string memory walletCoreName = config.walletCoreName;
        string memory walletCoreVersion = config.walletCoreVersion;
        console2.log("WalletCore name: %s", walletCoreName);
        console2.log("WalletCore version: %s", walletCoreVersion);

        address storage_;
        address ecdsaValidator_;
        address walletCore_;

        (storage_, ecdsaValidator_, walletCore_) = DeployInitHelper
            .deployContracts(
                deployFactory,
                deployFactorySalt,
                walletCoreName,
                walletCoreVersion
            );

        console2.log("WalletCore address: %s", walletCore_);
        console2.log("Storage address: %s", storage_);
        console2.log("ECDSAValidator address: %s", ecdsaValidator_);

        // Initialize the wallet core
        WalletCore(payable(walletCore_)).initialize();
        console2.log("WalletCore initialized");

        console2.log("Completed DeployInit script");
        vm.stopBroadcast();
    }
}