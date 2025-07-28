// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.23;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {IValidator} from "../interfaces/IValidator.sol";
import {Errors} from "../lib/Errors.sol";

contract ECDSAValidator is IValidator {
    using ECDSA for bytes32;

    /**
     * @notice Validates a signature against the stored signer address
     * @dev Uses ECDSA recovery to verify the signature matches the typed data hash
     * @param typedDataHash EIP-712 typed data hash to verify
     * @param signature ECDSA signature to validate
     */
    function validate(
        bytes32 typedDataHash,
        bytes calldata signature
    ) external view {
        address recoveredSigner = typedDataHash.recover(signature);
        address signer = getSigner();
        if (recoveredSigner != signer) revert Errors.InvalidSignature();
    }

    /**
     * @notice Returns the signer address stored in this validator clone
     * @dev Retrieves and decodes the initialization arguments used when this clone was created
     * @return address The stored signer address that is authorized to sign transactions
     */
    function getSigner() public view returns (address) {
        return abi.decode(Clones.fetchCloneArgs(address(this)), (address));
    }
}
