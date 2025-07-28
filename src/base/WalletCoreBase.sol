// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import {IStorage} from "../interfaces/IStorage.sol";

abstract contract WalletCoreBase {
    function _hashTypedDataV4(
        bytes32 structHash
    ) internal view virtual returns (bytes32);

    function _walletImplementation() internal view virtual returns (address);

    function getMainStorage() public view virtual returns (IStorage);
}
