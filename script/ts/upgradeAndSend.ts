import { ethers } from "ethers";
import walletCoreAbi from "./abi/WalletCore.json";
import storageAbi from "./abi/Storage.json";
import erc20Abi from "./abi/ERC20.json";
import { networkConfig } from "./config";
import {
    createAuthorization,
    checkDelegationStatus,
    waitForDelegation,
    sleep,
    calculateStorageAddress,
    tokenTransferWithFeeCalls,
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

    const calls = tokenTransferWithFeeCalls(
        config.usdtAddress,
        usdtDecimals,
        "0xc474D30fEeA0500aBaf9D169A1A760aBad5f72ef",
        "0x6007723DAC9Bb830f622bB4561E8017f021b9fB5",
        "0.01",
        "0.001"
    );

    console.log("Calls: ", calls);

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
    const transferTx = await walletCore.executeWithValidator(calls, validator, signature, {
        gasLimit: 300000,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
    });
    console.log("transfer tx sent:", transferTx.hash);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
