import { ethers } from "ethers";
import { FeeAmount } from "@uniswap/v3-sdk";
import { PermitSingle } from "@uniswap/permit2-sdk";
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

export enum CommandType {
    UNI_V3_SWAP_EXACT_IN = 0x00,
    UNI_V3_SWAP_EXACT_OUT = 0x01,
    PERMIT2_TRANSFER_FROM = 0x02,
    PERMIT2_PERMIT_BATCH = 0x03,
    SWEEP = 0x04,
    TRANSFER = 0x05,
    PAY_PORTION = 0x06,

    UNI_V2_SWAP_EXACT_IN = 0x08,
    UNI_V2_SWAP_EXACT_OUT = 0x09,
    PERMIT2_PERMIT = 0x0a,
    WRAP_ETH = 0x0b,
    UNWRAP_WETH = 0x0c,
    PERMIT2_TRANSFER_FROM_BATCH = 0x0d,
    BALANCE_CHECK_ERC20 = 0x0e,

    SUSHI_V2_SWAP_EXACT_IN = 0x10,
    SUSHI_V2_SWAP_EXACT_OUT = 0x11,
    SUSHI_V3_SWAP_EXACT_IN = 0x12,
    SUSHI_V3_SWAP_EXACT_OUT = 0x13,
    // 0x14,

    CAKE_V2_SWAP_EXACT_IN = 0x18,
    CAKE_V2_SWAP_EXACT_OUT = 0x19,
    CAKE_V3_SWAP_EXACT_IN = 0x1a,
    CAKE_V3_SWAP_EXACT_OUT = 0x1b,

    EXECUTE_SUB_PLAN = 0x21,
}

const ALLOW_REVERT_FLAG = 0x80;

const REVERTIBLE_COMMANDS = new Set<CommandType>([CommandType.EXECUTE_SUB_PLAN]);

const PERMIT_STRUCT =
    "((address token,uint160 amount,uint48 expiration,uint48 nonce) details, address spender, uint256 sigDeadline)";

const PERMIT_BATCH_STRUCT =
    "((address token,uint160 amount,uint48 expiration,uint48 nonce)[] details, address spender, uint256 sigDeadline)";

const PERMIT2_TRANSFER_FROM_STRUCT = "(address from,address to,uint160 amount,address token)";
const PERMIT2_TRANSFER_FROM_BATCH_STRUCT = PERMIT2_TRANSFER_FROM_STRUCT + "[]";

const ABI_DEFINITION: { [key in CommandType]: string[] } = {
    // Batch Reverts
    [CommandType.EXECUTE_SUB_PLAN]: ["bytes", "bytes[]"],

    // Permit2 Actions
    [CommandType.PERMIT2_PERMIT]: [PERMIT_STRUCT, "bytes"],
    [CommandType.PERMIT2_PERMIT_BATCH]: [PERMIT_BATCH_STRUCT, "bytes"],
    [CommandType.PERMIT2_TRANSFER_FROM]: ["address", "address", "uint160"],
    [CommandType.PERMIT2_TRANSFER_FROM_BATCH]: [PERMIT2_TRANSFER_FROM_BATCH_STRUCT],

    // Uniswap Actions
    [CommandType.UNI_V3_SWAP_EXACT_IN]: ["address", "uint256", "uint256", "bytes", "bool"],
    [CommandType.UNI_V3_SWAP_EXACT_OUT]: ["address", "uint256", "uint256", "bytes", "bool"],
    [CommandType.UNI_V2_SWAP_EXACT_IN]: ["address", "uint256", "uint256", "address[]", "bool"],
    [CommandType.UNI_V2_SWAP_EXACT_OUT]: ["address", "uint256", "uint256", "address[]", "bool"],

    // Pancakeswap Actions
    [CommandType.CAKE_V3_SWAP_EXACT_IN]: ["address", "uint256", "uint256", "bytes", "bool"],
    [CommandType.CAKE_V3_SWAP_EXACT_OUT]: ["address", "uint256", "uint256", "bytes", "bool"],
    [CommandType.CAKE_V2_SWAP_EXACT_IN]: ["address", "uint256", "uint256", "address[]", "bool"],
    [CommandType.CAKE_V2_SWAP_EXACT_OUT]: ["address", "uint256", "uint256", "address[]", "bool"],

    // Sushiswap Actions
    [CommandType.SUSHI_V3_SWAP_EXACT_IN]: ["address", "uint256", "uint256", "bytes", "bool"],
    [CommandType.SUSHI_V3_SWAP_EXACT_OUT]: ["address", "uint256", "uint256", "bytes", "bool"],
    [CommandType.SUSHI_V2_SWAP_EXACT_IN]: ["address", "uint256", "uint256", "address[]", "bool"],
    [CommandType.SUSHI_V2_SWAP_EXACT_OUT]: ["address", "uint256", "uint256", "address[]", "bool"],

    // Token Actions and Checks
    [CommandType.WRAP_ETH]: ["address", "uint256"],
    [CommandType.UNWRAP_WETH]: ["address", "uint256"],
    [CommandType.SWEEP]: ["address", "address", "uint256"],
    [CommandType.TRANSFER]: ["address", "address", "uint256"],
    [CommandType.PAY_PORTION]: ["address", "address", "uint256"],
    [CommandType.BALANCE_CHECK_ERC20]: ["address", "address", "uint256"],
};

export class RoutePlanner {
    commands: string;
    inputs: string[];

    constructor() {
        this.commands = "0x";
        this.inputs = [];
    }

    addSubPlan(subplan: RoutePlanner): void {
        this.addCommand(CommandType.EXECUTE_SUB_PLAN, [subplan.commands, subplan.inputs], true);
    }

    addCommand(type: CommandType, parameters: any[], allowRevert = false): void {
        let command = createCommand(type, parameters);
        this.inputs.push(command.encodedInput);
        if (allowRevert) {
            if (!REVERTIBLE_COMMANDS.has(command.type)) {
                throw new Error(`command type: ${command.type} cannot be allowed to revert`);
            }
            command.type = command.type | ALLOW_REVERT_FLAG;
        }

        this.commands = this.commands.concat(command.type.toString(16).padStart(2, "0"));
    }
}

export type RouterCommand = {
    type: CommandType;
    encodedInput: string;
};

export function createCommand(type: CommandType, parameters: any[]): RouterCommand {
    const encodedInput = ethers.AbiCoder.defaultAbiCoder().encode(ABI_DEFINITION[type], parameters);
    return { type, encodedInput };
}

const FEE_SIZE = 3;

// v3
export function encodePath(path: string[], fees: FeeAmount[]): string {
    if (path.length != fees.length + 1) {
        throw new Error("path/fee lengths do not match");
    }

    let encoded = "0x";
    for (let i = 0; i < fees.length; i++) {
        // 20 byte encoding of the address
        encoded += path[i].slice(2);
        // 3 byte encoding of the fee
        encoded += fees[i].toString(16).padStart(2 * FEE_SIZE, "0");
    }
    // encode the final token
    encoded += path[path.length - 1].slice(2);

    return encoded.toLowerCase();
}

export function encodePathExactInput(tokens: string[]) {
    return encodePath(tokens, new Array(tokens.length - 1).fill(FeeAmount.LOWEST));
}

export function encodePathExactOutput(tokens: string[]) {
    return encodePath(tokens.slice().reverse(), new Array(tokens.length - 1).fill(FeeAmount.MEDIUM));
}

export function expandTo18Decimals(n: number): bigint {
    return ethers.parseEther(n.toString());
}

export const DEADLINE = 6000000000;
export const CONTRACT_BALANCE = "0x8000000000000000000000000000000000000000000000000000000000000000";
export const ZERO_ADDRESS = ethers.ZeroAddress;
export const ONE_PERCENT_BIPS = 100;
export const MSG_SENDER: string = "0x0000000000000000000000000000000000000001";
export const ADDRESS_THIS: string = "0x0000000000000000000000000000000000000002";
export const SOURCE_MSG_SENDER: boolean = true;
export const SOURCE_ROUTER: boolean = false;

export const PERMIT2_PERMIT_TYPE = {
    PermitDetails: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint160" },
        { name: "expiration", type: "uint48" },
        { name: "nonce", type: "uint48" },
    ],
    PermitSingle: [
        { name: "details", type: "PermitDetails" },
        { name: "spender", type: "address" },
        { name: "sigDeadline", type: "uint256" },
    ],
};

export function getEip712Domain(chainId: number, verifyingContract: string) {
    return {
        name: "Permit2",
        chainId,
        verifyingContract,
    };
}

export async function signPermit(
    permit: PermitSingle,
    signer: ethers.Wallet,
    chainId: number,
    verifyingContract: string
): Promise<string> {
    const eip712Domain = getEip712Domain(chainId, verifyingContract);
    const signature = await signer.signTypedData(eip712Domain, PERMIT2_PERMIT_TYPE, permit);

    return signature;
}

export async function getPermitSignature(
    permit: PermitSingle,
    signer: ethers.Wallet,
    permit2: ethers.Contract,
    chainId: number
): Promise<string> {
    const permit2Address = await permit2.getAddress();
    // look up the correct nonce for this permit
    const nextNonce = (await permit2.allowance(signer.address, permit.details.token, permit.spender)).nonce;
    permit.details.nonce = nextNonce;
    return await signPermit(permit, signer, chainId, permit2Address);
}
