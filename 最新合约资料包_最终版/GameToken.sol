// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title GameToken - Cargo vs Fort 游戏代币
/// @notice 标准 ERC20 代币，用于 CARGO、FORT、DBL 三种游戏代币
/// @dev 固定 18 位小数，支持初始铸造，集成 ERC20Permit 扩展
/// @author Cargo vs Fort Team
/// @custom:version 2.0.0
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameToken is ERC20, ERC20Permit, Ownable {
    /// @dev 三币统一 CAP = 1e8 * 1e18
    uint256 public constant CAP = 100_000_000 * 1e18;

    /* ---------- ① Minter Role ---------- */
    mapping(address => bool) private _minters;
    modifier onlyMinter() { require(_minters[msg.sender], "NOT_MINTER"); _; }

    // === 事件 ===
    event TokenMinted(address indexed to, uint256 indexed amount, address indexed minter);
    event MinterSet(address indexed minter, bool indexed enabled);

    /// @notice 构造函数
    /// @param n 代币名称
    /// @param s 代币符号
    /// @param holder 初始持有者地址
    /// @param initial 初始供应量（已包含小数位）
    constructor(
        string memory n,
        string memory s,
        address holder,
        uint256 initial
    ) ERC20(n, s) ERC20Permit(n) Ownable(msg.sender) {
        _mint(holder, initial);
        _minters[msg.sender] = true;          // 部署者默认可铸
    }



    /// @notice 设置 / 取消铸币员
    function setMinter(address minter, bool enable) external onlyOwner {
        _minters[minter] = enable;
        emit MinterSet(minter, enable);
    }

    /// @notice 铸造代币（仅授权地址）
    function mint(address to, uint256 amount) external onlyMinter {
        require(totalSupply() + amount <= CAP, "CAP_EXCEEDED");
        _mint(to, amount);
        emit TokenMinted(to, amount, msg.sender);
    }
}