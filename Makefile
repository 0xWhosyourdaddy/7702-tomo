-include .env

.PHONY: all clean remove install build format anvil

all: clean remove install build

# Clean the repo
clean  :; forge clean

# Remove modules
remove :; rm -rf .gitmodules && rm -rf .git/modules/* && rm -rf lib && touch .gitmodules && git add . && git commit -m "modules"

install :; forge install foundry-rs/forge-std@v1.9.4 --no-commit && forge install OpenZeppelin/openzeppelin-contracts@v5.2.0 --no-commit && forge install OpenZeppelin/openzeppelin-contracts-upgradeable@v5.1.0 --no-commit && forge install Uniswap/v2-core@v1.0.1 --no-commit && forge install Uniswap/v2-periphery --no-commit && forge install Uniswap/v3-core --no-commit && forge install Uniswap/v3-periphery --no-commit && forge install Uniswap/permit2 --no-commit && forge install Uniswap/universal-router --no-commit && forge install Uniswap/solidity-lib@v2.1.0 --no-commit && forge install transmissions11/solmate --no-commit && forge install smartcontractkit/chainlink-brownie-contracts@1.1.1 --no-commit && forge install Cyfrin/foundry-devops@0.2.3 --no-commit && forge install safe-global/safe-smart-account@v1.4.1-3 --no-commit && forge install dmfxyz/murky --no-commit && forge install eth-infinitism/account-abstraction@v0.7.0 --no-commit && forge install aave-dao/aave-v3-origin@v3.1.0 --no-commit && forge install chiru-labs/ERC721A@v4.3.0 --no-commit && forge install chiru-labs/ERC721A-Upgradeable@v4.3.0 --no-commit && forge install huff-language/foundry-huff --no-commit

build:; forge build

format :; forge fmt

anvil :; anvil --steps-tracing --block-time 1

#################################### bsc ###########################################
deploy-factory-bsc:; forge script script/deploy/CreateDeployFactory.s.sol:CreateDeployFactory --rpc-url ${BSC_RPC_URL} --broadcast --verify --etherscan-api-key ${BSC_API_KEY}

deploy-init-bsc:; forge script script/deploy/DeployInit.s.sol:DeployInit --rpc-url ${BSC_RPC_URL} --broadcast --verify --etherscan-api-key ${BSC_API_KEY}

# forge verify-contract 0x6b483BE98D5fcA84d51Dff932EC1b87A9921F756 --constructor-args $(cast abi-encode "constructor(address,string,string)" 0x4bE37E398bB78CBD003c06724f1820aaDA59E6dB "wallet-core" "1.0.0") --rpc-url https://tiniest-maximum-isle.bsc.quiknode.pro/8e90bf938b9cf5e9c1e08fca25a712aee52e6c54 --etherscan-api-key HCP2BNAD2IK62U7G5ZSQHN35VFYIBNB36W src/WalletCore.sol:WalletCore

#################################### base ###########################################
deploy-factory-base:; forge script script/deploy/CreateDeployFactory.s.sol:CreateDeployFactory --rpc-url ${BASE_RPC_URL} --broadcast --verify --etherscan-api-key ${BASE_API_KEY}

deploy-init-base:; forge script script/deploy/DeployInit.s.sol:DeployInit --rpc-url ${BASE_RPC_URL} --broadcast --verify --etherscan-api-key ${BASE_API_KEY}

#################################### eth ###########################################
deploy-factory-eth:; forge script script/deploy/CreateDeployFactory.s.sol:CreateDeployFactory --rpc-url ${ETH_RPC_URL} --broadcast --verify --etherscan-api-key ${ETH_API_KEY}

deploy-init-eth:; forge script script/deploy/DeployInit.s.sol:DeployInit --rpc-url ${ETH_RPC_URL} --broadcast --verify --etherscan-api-key ${ETH_API_KEY}



