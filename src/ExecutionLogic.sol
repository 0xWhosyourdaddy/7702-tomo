// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.23;

import {Call} from "./Types.sol";
import {Errors} from "./lib/Errors.sol";

abstract contract ExecutionLogic {
    /**
     * @notice Executes multiple contract calls in a single transaction
     * @dev Reverts if any of the calls fail
     * @param calls Array of Call structs containing destination address, value, and calldata
     * @return results Array of bytes containing the return data from each call
     */
    function _batchCall(
        Call[] calldata calls
    ) internal returns (bytes[] memory results) {
        results = new bytes[](calls.length);
        for (uint256 i; i < calls.length; i++) {
            (bool success, bytes memory returnData) = calls[i].target.call{
                value: calls[i].value
            }(calls[i].data);
            if (!success) revert Errors.CallFailed(i, returnData);
            results[i] = returnData;
        }
    }
}
