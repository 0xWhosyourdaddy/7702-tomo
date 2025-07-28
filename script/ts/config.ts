import dotenv from "dotenv";

dotenv.config();

export interface networkConfigItem {
    rpc: string;
    usdtAddress: string;
    usdcAddress: string;
    tomoSwapAddress: string;
    permit2Address: string;
    walletCoreAddress: string;
    storageImpl: string;
}

export interface networkConfigInfo {
    [key: string]: networkConfigItem;
}

export const networkConfig: networkConfigInfo = {
    bsc: {
        rpc: process.env.BSC_RPC_URL!,
        usdtAddress: "0x55d398326f99059fF775485246999027B3197955",
        usdcAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        tomoSwapAddress: "0xcF74F56112f260DdEe729753553FbD18509DEF8F",
        permit2Address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
        walletCoreAddress: "0x6b483BE98D5fcA84d51Dff932EC1b87A9921F756",
        storageImpl: "0x4bE37E398bB78CBD003c06724f1820aaDA59E6dB",
    },
};
