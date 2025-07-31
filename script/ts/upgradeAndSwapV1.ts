import { ethers } from "ethers";
import walletCoreAbi from "./abi/WalletCore.json";
import storageAbi from "./abi/Storage.json";
import erc20Abi from "./abi/ERC20.json";
import permit2Abi from "./abi/permit2.json";
import tomoSwapAbi from "./abi/TomoSwap.json";
import { networkConfig } from "./config";
import {
    createAuthorization,
    checkDelegationStatus,
    waitForDelegation,
    sleep,
    calculateStorageAddress,
    encodePath,
    DEADLINE,
    getPermitSignature,
    RoutePlanner,
    CommandType,
    MSG_SENDER,
    SOURCE_MSG_SENDER,
    Call,
    getWalletCoreSignature,
} from "./utils";
import yargs from "yargs/yargs";
import dotenv from "dotenv";

dotenv.config();

function getOptions() {
    const options = yargs(process.argv.slice(2)).option("network", {
        type: "string",
        describe: "network",
        default: "bsc",
    });
    return options.argv;
}

async function main() {
    const { network } = getOptions() as any;
    const config = networkConfig[network];
    const provider = new ethers.JsonRpcProvider(config.rpc);

    const userWallet = new ethers.Wallet(process.env.USER_PRIVATE_KEY!, provider);
    const sponsorWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
    const chainId = Number((await provider.getNetwork()).chainId);

    console.log("Chain ID: ", chainId);
    console.log("User EOA address: ", userWallet.address);
    console.log("Sponsor address: ", sponsorWallet.address);

    let needsDelegation = false;
    const delegatedAddress = (await checkDelegationStatus(provider, userWallet.address)) || "";

    if (delegatedAddress == "0x") {
        needsDelegation = true;
    } else if (delegatedAddress.toLowerCase() == config.walletCoreAddress.toLowerCase()) {
        console.log("Already delegated to WalletCore");
    } else {
        console.log("Invalid delegation status, exiting...");
        process.exit(1);
    }

    let userWalletCoreNonce = 0;
    const userStorageAddress = calculateStorageAddress(config.storageImpl, userWallet.address);
    const userStorageCode = await provider.getCode(userStorageAddress);
    console.log("User storage address: ", userStorageAddress);
    console.log("User storage code: ", userStorageCode);
    if (userStorageCode != "0x") {
        const storage = new ethers.Contract(userStorageAddress, storageAbi, sponsorWallet);
        userWalletCoreNonce = await storage.getNonce();
        console.log("User storage current nonce: ", userWalletCoreNonce);
    }
    const walletCore = new ethers.Contract(userWallet.address, walletCoreAbi, sponsorWallet);

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits("0.1", "gwei");
    const maxPriorityFeePerGas = ethers.parseUnits("0.1", "gwei"); // 0.1 gwei tip for BSC
    const maxFeePerGas = gasPrice + maxPriorityFeePerGas;
    console.log("Current fee data:", {
        gasPrice: feeData.gasPrice?.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
        maxFeePerGas: maxFeePerGas.toString(),
    });

    if (needsDelegation) {
        const userNonce = await provider.getTransactionCount(userWallet.address, "latest");
        // 这个是需要用户签的第一个data （升级EOA地址的授权）
        const userAuth = await createAuthorization(userWallet, userNonce, config.walletCoreAddress, chainId);

        await sleep(3000);
        // 这个是升级EOA地址的最终的calldata, 需要 sponsor签名后，广播的第一个交易
        const upgradeTx = await walletCore.initialize({
            type: 4,
            authorizationList: [userAuth],
            gasLimit: 250000,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
        });

        console.log("upgradetx sent: ", upgradeTx.hash);

        // Wait for delegation to complete
        const delegationSuccessful = await waitForDelegation(provider, userWallet.address, config.walletCoreAddress);

        if (!delegationSuccessful) {
            console.log("Exiting...");
            process.exit(1);
        }
    }

    const usdtContract = new ethers.Contract(config.usdtAddress, erc20Abi, sponsorWallet);
    const usdtDecimals = await usdtContract.decimals();
    console.log("USDT decimals: ", usdtDecimals);

    const permit2 = new ethers.Contract(config.permit2Address, permit2Abi, sponsorWallet);
    const fromAmount = ethers.parseUnits("0.01", usdtDecimals);
    const minReceivedAmount = "1";
    const permitSingle = {
        details: {
            token: config.usdtAddress,
            amount: fromAmount,
            expiration: 0, // expire time for allowance, 0 means block.timestamp
            nonce: 0, // default is 0, will be changed later
        },
        spender: config.tomoSwapAddress, // router's address
        sigDeadline: DEADLINE,
    };

    // 获取permit2的签名 （用户签, 当前接口已有的）
    const permit2Sig = await getPermitSignature(permitSingle, userWallet, permit2, chainId);

    const planner = new RoutePlanner();

    const pathV3 = encodePath([config.usdtAddress, config.usdcAddress], [100]);

    planner.addCommand(CommandType.PERMIT2_PERMIT, [permitSingle, permit2Sig]);
    planner.addCommand(CommandType.UNI_V3_SWAP_EXACT_IN, [
        MSG_SENDER,
        fromAmount,
        minReceivedAmount,
        pathV3,
        SOURCE_MSG_SENDER,
    ]);

    const { commands, inputs } = planner;
    console.log("commands: ", commands);
    console.log("inputs: ", inputs);

    let needsApprove = false;
    const currentAllowance = await usdtContract.allowance(userWallet.address, config.permit2Address);
    console.log("currentAllowance: ", currentAllowance);
    if (currentAllowance < fromAmount) {
        needsApprove = true;
    }

    console.log("needsApprove: ", needsApprove);

    const erc20Interface = new ethers.Interface(erc20Abi);
    const tomoSwapInterface = new ethers.Interface(tomoSwapAbi);

    const feeRecipient = "0x6007723DAC9Bb830f622bB4561E8017f021b9fB5";
    const feeAmount = "0.001";

    const calls: Call[] = [
        ...(needsApprove
            ? [
                  {
                      target: config.usdtAddress,
                      value: 0n,
                      data: erc20Interface.encodeFunctionData("approve", [config.permit2Address, ethers.MaxUint256]),
                  },
              ]
            : []),
        {
            target: config.usdtAddress,
            value: 0n,
            data: erc20Interface.encodeFunctionData("transfer", [
                feeRecipient,
                ethers.parseUnits(feeAmount, usdtDecimals),
            ]),
        },
        {
            target: config.tomoSwapAddress,
            value: 0n,
            data: tomoSwapInterface.encodeFunctionData("execute(bytes,bytes[],uint256)", [commands, inputs, DEADLINE]),
        },
    ];

    console.log("calls: ", calls);

    // const hash = await walletCore.getValidationTypedHash(userWalletCoreNonce, calls);
    // console.log("Hash: ", hash);

    // // 这个是需要用户签的第二个data
    // const sig = await userWallet.signingKey.sign(hash);
    // const signature = ethers.concat([sig.r, sig.s, ethers.toBeHex(sig.v, 1)]);

    // 这个是需要用户签的第二个data, 后端返回hash给前端签即可
    const { signature } = await getWalletCoreSignature(
        userWallet,
        userWallet.address,
        config.walletCoreAddress,
        chainId,
        userWalletCoreNonce,
        calls
    );

    console.log("Signature:", signature);

    const validator = "0x0000000000000000000000000000000000000001";

    await sleep(3000);

    // 这个转账最终的calldata, 需要 sponsor签名后，广播的第二个交易
    const swapTx = await walletCore.executeWithValidator(calls, validator, signature, {
        gasLimit: 300000,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
    });
    console.log("swap tx sent:", swapTx.hash);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
