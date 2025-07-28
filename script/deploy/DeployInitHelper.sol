// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import {Storage} from "src/Storage.sol";
import {WalletCore} from "src/WalletCore.sol";
import {ECDSAValidator} from "src/validator/ECDSAValidator.sol";
import {DeployFactory} from "src/test/DeployFactory.sol";
import {console2} from "forge-std/Script.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

library DeployInitHelper {
    function deployContracts(
        DeployFactory deployFactory,
        bytes32 deployFactorySalt,
        string memory walletCoreName,
        string memory walletCoreVersion
    )
        internal
        returns (
            address storageAddr,
            address ecdsaValidatorAddr,
            address walletCoreAddr
        )
    {
        // Deploy Storage
        storageAddr = _deployIfNeeded(
            deployFactory,
            type(Storage).creationCode,
            deployFactorySalt
        );

        // Deploy ECDSA Validator
        ecdsaValidatorAddr = _deployIfNeeded(
            deployFactory,
            type(ECDSAValidator).creationCode,
            deployFactorySalt
        );

        // Deploy Wallet Core
        walletCoreAddr = _deployIfNeeded(
            deployFactory,
            abi.encodePacked(
                type(WalletCore).creationCode,
                abi.encode(storageAddr, walletCoreName, walletCoreVersion) // constructor args
            ),
            deployFactorySalt
        );
    }

    function _deployIfNeeded(
        DeployFactory deployFactory,
        bytes memory bytecode,
        bytes32 salt
    ) internal returns (address) {
        address derivedAddress = Create2.computeAddress(
            salt,
            keccak256(bytecode),
            address(deployFactory)
        );
        uint256 codeSize = derivedAddress.code.length;

        if (codeSize > 0) {
            console2.log("Skipping deployment for: %s", derivedAddress);
            return payable(derivedAddress);
        }
        return deployFactory.deploy(bytecode, salt);
    }
}
