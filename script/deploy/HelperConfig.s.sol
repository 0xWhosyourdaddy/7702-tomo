// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";

struct NetworkConfig {
    address deployFactory;
    bytes32 deployFactorySalt;
    string walletCoreName;
    string walletCoreVersion;
}

abstract contract CodeConstants {
    uint256 public constant ETH_CHAIN_ID = 1;
    uint256 public constant BNB_CHAIN_ID = 56;
    uint256 public constant BASE_CHAIN_ID = 8453;
}

contract HelperConfig is CodeConstants, Script {
    error HelperConfigInvalidChainId();
    mapping(uint256 chainId => NetworkConfig) public networkConfigs;

    constructor() {
        networkConfigs[ETH_CHAIN_ID] = getEthConfig();
        networkConfigs[BNB_CHAIN_ID] = getBnbConfig();
        networkConfigs[BASE_CHAIN_ID] = getBaseConfig();
    }

    function getConfig() public view returns (NetworkConfig memory) {
        return getConfigByChainId(block.chainid);
    }

    function getConfigByChainId(uint256 chainId) public view returns (NetworkConfig memory) {
        return networkConfigs[chainId];
    }

    function getBnbConfig() public pure returns (NetworkConfig memory bnbNetworkConfig) {
        bnbNetworkConfig = NetworkConfig({
            deployFactory: 0x4caCfc1f8AA464EFAE8207A7c1eE1127B5aC3035,
            deployFactorySalt: bytes32(uint256(1)),
            walletCoreName: "wallet-core",
            walletCoreVersion: "1.0.0"
        });
    }

    function getBaseConfig() public pure returns (NetworkConfig memory baseNetworkConfig) {
        baseNetworkConfig = NetworkConfig({
            deployFactory: 0x4caCfc1f8AA464EFAE8207A7c1eE1127B5aC3035,
            deployFactorySalt: bytes32(uint256(1)),
            walletCoreName: "wallet-core",
            walletCoreVersion: "1.0.0"
        });
    }

    function getEthConfig() public pure returns (NetworkConfig memory ethNetworkConfig) {
        ethNetworkConfig = NetworkConfig({
            deployFactory: 0x4caCfc1f8AA464EFAE8207A7c1eE1127B5aC3035,
            deployFactorySalt: bytes32(uint256(1)),
            walletCoreName: "wallet-core",
            walletCoreVersion: "1.0.0"
        });
    }
}