import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys a contract named "YourContract" using the deployer account and
 * constructor arguments set to the deployer address
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployYourContract: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  /*
    On localhost, the deployer account is the one that comes with Hardhat, which is already funded.

    When deploying to live networks (e.g `yarn deploy --network sepolia`), the deployer account
    should have sufficient balance to pay for the gas fees for contract creation.

    You can generate a random account with `yarn generate` or `yarn account:import` to import your
    existing PK which will fill DEPLOYER_PRIVATE_KEY_ENCRYPTED in the .env file (then used on hardhat.config.ts)
    You can run the `yarn account` command to check your balance in every network.
  */
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("MusicToken", {
    from: deployer,
    args: [hre.ethers.parseEther("1000000")], // 1M tokens
    log: true,
    autoMine: true,
  });

  const musicToken = await hre.ethers.getContract<Contract>("MusicToken", deployer);


  await deploy("AIAgentRegistry", {
    from: deployer,
    // Contract constructor arguments
    args: [musicToken.target],
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.  
  const aiAgentRegistry = await hre.ethers.getContract<Contract>("AIAgentRegistry", deployer);

  await deploy("AgentGovernance", {
    from: deployer,
    args: [musicToken.target, aiAgentRegistry.target],
    log: true,
    autoMine: true,
  });

  const agentGovernance = await hre.ethers.getContract<Contract>("AgentGovernance", deployer);
  //transfer ownership of agentRegistry to agentGovernance
  await aiAgentRegistry.transferOwnership(agentGovernance.target);
  await musicToken.transfer('0x96F16eE794a9d4C520F2F8F9548051ec901ED909', hre.ethers.parseEther("1000"));

};

export default deployYourContract;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags YourContract
deployYourContract.tags = ["YourContract"];
