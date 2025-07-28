import { ethers } from "ethers";
import erc20Abi from "./abi/ERC20.json";

export async function createAuthorization(
    signer: ethers.Wallet,
    nonce: number,
    targetAddress: string,
    chainId: number
) {
    const auth = await signer.authorize({
        address: targetAddress,
        nonce: nonce,
        chainId: chainId,
    });

    console.log(`Authorization created with nonce: ${nonce}, chainId: ${chainId}, targetAddress: ${targetAddress}`);
    return auth;
}

export async function checkDelegationStatus(provider: ethers.JsonRpcProvider, userAddress: string) {
    console.log("\n=== check delegation status ===");
    try {
        const code = await provider.getCode(userAddress);
        if (code === "0x") {
            console.log("address is not delegated yet");
            return "0x";
        }

        if (code.startsWith("0xef0100")) {
            const delegatedAddress = "0x" + code.slice(8);
            console.log(`${userAddress} is delegated to ${delegatedAddress}`);
            return delegatedAddress;
        } else {
            console.log("address contains code but not a delegation contract");
            return null;
        }
    } catch (error) {
        console.error("error checking delegation status: ", error);
        return null;
    }
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForDelegation(
    provider: ethers.JsonRpcProvider,
    userAddress: string,
    expectedDelegatedAddress: string
): Promise<boolean> {
    const maxWaitTime = 2 * 60 * 1000; // 2 minutes in milliseconds
    const checkInterval = 3 * 1000; // 3 seconds in milliseconds
    const startTime = Date.now();

    console.log("Waiting for delegation status to update...");

    while (Date.now() - startTime < maxWaitTime) {
        await sleep(checkInterval);

        const currentDelegatedAddress = (await checkDelegationStatus(provider, userAddress)) || "";
        console.log(`Checking delegation status... Current: ${currentDelegatedAddress}`);

        if (currentDelegatedAddress.toLowerCase() === expectedDelegatedAddress.toLowerCase()) {
            console.log("✅ Delegation successful! WalletCore is now delegated.");
            return true; // Success
        }
    }

    // If we reach here, the timeout was reached
    console.log("❌ Timeout reached. Delegation status did not change within 2 minutes.");
    return false; // Failure
}

export function calculateStorageAddress(storageImpl: string, walletAddress: string): string {
    // Constants from the contract
    const STORAGE_SALT = ethers.keccak256(ethers.toUtf8Bytes("storage"));

    // Encode the immutable arguments: abi.encode(address(this))
    const immutableArgs = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [walletAddress]);

    // Generate bytecode using OpenZeppelin's exact pattern
    const cloneBytecode = getCloneBytecodeWithImmutableArgs(storageImpl, immutableArgs);

    // Calculate CREATE2 address using OpenZeppelin's logic:
    // Create2.computeAddress(salt, keccak256(bytecode), deployer)
    return ethers.getCreate2Address(
        walletAddress, // deployer (address(this))
        STORAGE_SALT, // salt
        ethers.keccak256(cloneBytecode) // bytecode hash
    );
}

function getCloneBytecodeWithImmutableArgs(implementation: string, immutableArgs: string): string {
    const argsBytes = immutableArgs.slice(2); // Remove 0x prefix
    const argsLength = argsBytes.length / 2; // Convert hex length to byte length

    if (argsLength > 24531) {
        throw new Error("CloneArgumentsTooLong");
    }

    // OpenZeppelin's exact bytecode pattern from _cloneCodeWithImmutableArgs
    // abi.encodePacked(
    //     hex"61",                                    // PUSH2
    //     uint16(args.length + 45),                  // Total length
    //     hex"3d81600a3d39f3363d3d373d3d3d363d73",   // Clone prefix
    //     implementation,                            // Implementation address
    //     hex"5af43d82803e903d91602b57fd5bf3",       // Clone suffix
    //     args                                       // Immutable args
    // );

    const totalLength = argsLength + 45;
    const lengthHex = totalLength.toString(16).padStart(4, "0"); // uint16 as hex
    const implementationBytes = implementation.slice(2).toLowerCase();

    const cloneBytecode =
        "0x61" + // PUSH2 opcode
        lengthHex + // Total length (args.length + 45)
        "3d81600a3d39f3363d3d373d3d3d363d73" + // Clone prefix
        implementationBytes + // Implementation address (20 bytes)
        "5af43d82803e903d91602b57fd5bf3" + // Clone suffix
        argsBytes; // Immutable args

    return cloneBytecode;
}

export interface Call {
    target: string;
    value: bigint;
    data: string;
}

export function tokenTransferWithFeeCalls(
    token: string,
    decimals: number,
    destination: string,
    feeRecipient: string,
    sendAmount: string,
    feeAmount: string
): Call[] {
    const erc20Interface = new ethers.Interface(erc20Abi);

    const calls: Call[] = [
        {
            target: token,
            value: 0n,
            data: erc20Interface.encodeFunctionData("transfer", [feeRecipient, ethers.parseUnits(feeAmount, decimals)]),
        },
        {
            target: token,
            value: 0n,
            data: erc20Interface.encodeFunctionData("transfer", [destination, ethers.parseUnits(sendAmount, decimals)]),
        },
    ];

    return calls;
}
