// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MusicToken
 * @dev ERC20 Token for the AI Agent Registry system
 */
contract MusicToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("Music Token", "MUSIC") {
        _mint(msg.sender, initialSupply);
    }
} 