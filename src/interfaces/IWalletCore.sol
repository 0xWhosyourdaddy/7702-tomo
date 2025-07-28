// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IStorage} from "./IStorage.sol";
import {Call, Session} from "src/Types.sol";

interface IWalletCore is IERC165 {
    // EVENTS
    event StorageInitialized();
    event StorageCreated(address storageAddress);

    function initialize() external;

    function executeFromSelf(Call[] calldata calls) external;

    function executeWithValidator(
        Call[] calldata calls,
        address validator,
        bytes calldata validationData
    ) external;

    function executeFromExecutor(
        Call[] calldata calls,
        Session calldata session
    ) external;

    function addValidator(
        address validatorImpl,
        bytes calldata immutableArgs
    ) external;

    function getMainStorage() external view returns (IStorage);

    function isValidSignature(
        bytes32 hash,
        bytes calldata signature
    ) external view returns (bytes4);
}
