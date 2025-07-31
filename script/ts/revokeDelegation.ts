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

    const userWallet = new ethers.Wallet(process.env.USER2_PRIVATE_KEY!, provider);
    const sponsorWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
    const chainId = Number((await provider.getNetwork()).chainId);

    console.log("Chain ID: ", chainId);
    console.log("User EOA address: ", userWallet.address);
    console.log("Sponsor address: ", sponsorWallet.address);

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits("0.1", "gwei");
    const maxPriorityFeePerGas = ethers.parseUnits("0.1", "gwei"); // 0.1 gwei tip for BSC
    const maxFeePerGas = gasPrice + maxPriorityFeePerGas;
    console.log("Current fee data:", {
        gasPrice: feeData.gasPrice?.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
        maxFeePerGas: maxFeePerGas.toString(),
    });

    const userNonce = await provider.getTransactionCount(userWallet.address, "latest");

    const userAuth = await createAuthorization(userWallet, userNonce, ethers.ZeroAddress, chainId);

    await sleep(3000);

    const txData = {
        type: 4,
        to: userWallet.address,
        value: 0,
        data: "0x", // Empty data since we're just revoking
        gasLimit: 250000,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
        authorizationList: [userAuth],
    };

    const tx = await sponsorWallet.sendTransaction(txData);

    console.log("Revoke transaction sent:", tx.hash);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
