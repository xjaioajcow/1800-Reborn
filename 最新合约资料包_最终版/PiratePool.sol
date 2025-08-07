// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title PiratePool - 海盗质押分红池
/// @notice 海盗质押获得出航敌币20%分红，30天无活动自动回收
/// @dev 实现双池质押系统，支持CARGO和FORT代币质押分红
/// @author Cargo vs Fort Team
/// @custom:version 2.0.0
/// @custom:security-contact security@cargovsfort.com
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ShipSBT.sol";

contract PiratePool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice 质押池结构
    struct Pool {
        IERC20  token;              // 质押代币合约
        uint256 totalStake;         // 总质押量
        uint256 accPerShare;        // 累积每股分红 (1e18精度)
        uint256 lastActiveBlock;    // 最后活跃区块
        uint256 pendingDust;        // 精度损失累积
    }

    // === 常量配置 ===
    uint256 constant BLOCKS_30_DAY = 864_000;      // 30天区块数
    uint256 constant PRECISION = 1e18;             // 分红精度
    uint256 constant POKE_BOUNTY_PCT = 100;        // poke回收赏金比例 (1%)
    uint256 constant PERCENTAGE_BASE = 100;        // 百分比计算基数
    uint256 constant BPS_BASE = 10_000;            // 基点计算基数
    uint256 constant BURN_PERCENT_DEFAULT = 40;    // 默认销毁比例
    uint256 constant JACKPOT_PERCENT_DEFAULT = 60; // 默认奖池比例
    address constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // === 状态变量 ===
    mapping(uint8 => Pool) public pools;                           // 0=CARGO池, 1=FORT池
    mapping(uint8 => mapping(address => uint256)) public userStake; // 用户质押量
    mapping(uint8 => mapping(address => uint256)) public userDebt;  // 用户债务(已领取分红)
    address public gameCore;                                        // 游戏核心合约地址
    ShipSBT public shipSBT;                                         // ShipSBT 合约地址

    // === 自定义错误 ===
    error ALREADY_INIT();
    error BAL_LOW();
    error NO_REWARD();
    error AMT_ZERO();
    error POOL_ACTIVE();

    // === 事件 ===
    event Staked(address indexed user, uint8 poolId, uint256 amount);
    event Unstaked(address indexed user, uint8 poolId, uint256 amount);
    event Claimed(address indexed user, uint8 poolId, uint256 reward);
    event Recycled(uint8 poolId, uint256 jackpotPart, uint256 burnPart);
    event PoolsInitialized(address cargoToken, address fortToken);
    event RewardDeposited(uint8 indexed poolId, uint256 indexed amount, address indexed from);
    event GameCoreSet(address indexed oldGameCore, address indexed newGameCore);
    event ShipSBTSet(address indexed oldShipSBT, address indexed newShipSBT);

    modifier onlyGameCore() {
        require(msg.sender == gameCore, "NOT_GAME_CORE");
        _;
    }

    modifier onlyPirate() {
        require(address(shipSBT) != address(0), "SHIP_SBT_NOT_SET");
        require(_isPirateHolder(msg.sender), "NOT_PIRATE");
        _;
    }

    /// @notice 检查地址是否持有海盗NFT
    /// @dev 直接使用 ShipSBT 的 hasPirate 函数
    function _isPirateHolder(address user) internal view returns (bool) {
        return shipSBT.hasPirate(user);
    }

    constructor() Ownable(msg.sender) {
        // 构造函数为空，通过initPools初始化
    }

    /// @notice 设置游戏核心合约地址
    function setGameCore(address _gameCore) external onlyOwner {
        require(_gameCore != address(0), "ZERO_ADDR");
        address oldGameCore = gameCore;
        gameCore = _gameCore;
        emit GameCoreSet(oldGameCore, _gameCore);
    }

    /// @notice 设置 ShipSBT 合约地址
    function setShipSBT(address _shipSBT) external onlyOwner {
        require(_shipSBT != address(0), "ZERO_ADDR");
        address oldShipSBT = address(shipSBT);
        shipSBT = ShipSBT(_shipSBT);
        emit ShipSBTSet(oldShipSBT, _shipSBT);
    }

    /// @notice 初始化两个质押池的代币地址
    /// @param cargo CARGO代币合约地址
    /// @param fort FORT代币合约地址
    function initPools(address cargo, address fort) external onlyOwner nonReentrant {
        require(cargo != address(0) && fort != address(0), "ZERO_ADDR");
        if (address(pools[0].token) != address(0)) {
            revert ALREADY_INIT();
        }

        // 初始化 CARGO 池 (pid=0)
        pools[0].token            = IERC20(cargo);
        pools[0].totalStake       = 0;
        pools[0].accPerShare      = 0;
        pools[0].lastActiveBlock  = uint32(block.number);
        pools[0].pendingDust      = 0;

        // 初始化 FORT 池 (pid=1)
        pools[1].token            = IERC20(fort);
        pools[1].totalStake       = 0;
        pools[1].accPerShare      = 0;
        pools[1].lastActiveBlock  = uint32(block.number);
        pools[1].pendingDust      = 0;

        emit PoolsInitialized(cargo, fort);
    }

    /// @notice 质押代币到指定池子（仅海盗持有者）
    /// @param pid 池子ID (0=CARGO池, 1=FORT池)
    /// @param amt 质押数量
    function stake(uint8 pid, uint256 amt) external onlyPirate nonReentrant {
        require(pid <= 1, "INVALID_PID");

        _updatePool(pid);

        if (amt > 0) {
            pools[pid].token.safeTransferFrom(msg.sender, address(this), amt);
            userStake[pid][msg.sender] += amt;
            pools[pid].totalStake += amt;
            pools[pid].lastActiveBlock = block.number;
        }

        userDebt[pid][msg.sender] = userStake[pid][msg.sender] * pools[pid].accPerShare / PRECISION;

        emit Staked(msg.sender, pid, amt);
    }

    /// @notice 取消质押并领取奖励（仅海盗持有者）
    /// @param pid 池子ID (0=CARGO池, 1=FORT池)
    /// @param amt 取消质押数量
    function unstake(uint8 pid, uint256 amt) external onlyPirate nonReentrant {
        require(pid <= 1, "INVALID_PID");

        _updatePool(pid);

        if (userStake[pid][msg.sender] < amt) {
            revert BAL_LOW();
        }

        // 先领取待领奖励
        uint256 pending = _pending(pid, msg.sender);
        if (pending > 0) {
            pools[pid].token.safeTransfer(msg.sender, pending);
            emit Claimed(msg.sender, pid, pending);
        }

        // 取消质押
        if (amt > 0) {
            userStake[pid][msg.sender] -= amt;
            pools[pid].totalStake -= amt;
            pools[pid].token.safeTransfer(msg.sender, amt);
            emit Unstaked(msg.sender, pid, amt);
        }

        userDebt[pid][msg.sender] = userStake[pid][msg.sender] * pools[pid].accPerShare / PRECISION;
    }

    /// @notice 领取质押奖励（仅海盗持有者）
    /// @param pid 池子ID (0=CARGO池, 1=FORT池)
    function claim(uint8 pid) external onlyPirate nonReentrant {
        require(pid <= 1, "INVALID_PID");

        _updatePool(pid);

        uint256 pending = _pending(pid, msg.sender);
        if (pending == 0) {
            revert NO_REWARD();
        }

        pools[pid].token.safeTransfer(msg.sender, pending);
        userDebt[pid][msg.sender] = userStake[pid][msg.sender] * pools[pid].accPerShare / PRECISION;

        emit Claimed(msg.sender, pid, pending);
    }

    /// @notice 存入奖励 (由CoreGameV2调用)
    /// @param pid 池子ID (0=CARGO池, 1=FORT池)
    /// @param amt 奖励数量
    function depositReward(uint8 pid, uint256 amt) external onlyGameCore {
        require(pid <= 1, "INVALID_PID");
        if (amt == 0) {
            revert AMT_ZERO();
        }

        // CoreGameV2调用，将20%敌币注入
        pools[pid].token.safeTransferFrom(msg.sender, address(this), amt);
        _updatePoolOnReward(pid, amt);
        pools[pid].lastActiveBlock = block.number;

        emit RewardDeposited(pid, amt, msg.sender);
    }

    /// @notice 回收闲置池子资金
    /// @param pid 池子ID (0=CARGO池, 1=FORT池)
    /// @param jackpot 奖池地址
    /// @param burnPct 销毁百分比 (40 = 40%)
    function recycleIfIdle(uint8 pid, address jackpot, uint256 burnPct) external onlyOwner nonReentrant {
        require(pid <= 1, "INVALID_PID");

        // 检查是否超过30天无活动
        if (block.number - pools[pid].lastActiveBlock < BLOCKS_30_DAY) {
            revert POOL_ACTIVE();
        }

        uint256 bal = pools[pid].token.balanceOf(address(this));
        if (bal == 0) return;

        // burnPct=40 → 销毁40%，其余60%回Jackpot
        uint256 burnAmt = bal * burnPct / PERCENTAGE_BASE;
        uint256 jackpotAmt = bal - burnAmt;

        if (burnAmt > 0) {
            // 转到销毁地址，真正销毁代币
            pools[pid].token.safeTransfer(DEAD_ADDRESS, burnAmt);
        }

        if (jackpotAmt > 0) {
            pools[pid].token.safeTransfer(jackpot, jackpotAmt);
        }

        // 重置池子状态
        pools[pid].accPerShare = 0;
        pools[pid].totalStake = 0;

        emit Recycled(pid, jackpotAmt, burnAmt);
    }

    /// @notice 公开回收闲置池子（任何人可调用获得赏金）
    /// @param pid 池子ID (0=CARGO池, 1=FORT池)
    function pokeInactivePool(uint8 pid) external nonReentrant {
        require(pid <= 1, "INVALID_PID");
        require(block.number - pools[pid].lastActiveBlock > BLOCKS_30_DAY, "POOL_ACTIVE");

        uint256 bal = pools[pid].token.balanceOf(address(this));
        require(bal > 0, "NO_BALANCE");

        // 1%赏金给调用者
        uint256 bounty = bal * POKE_BOUNTY_PCT / BPS_BASE;
        pools[pid].token.safeTransfer(msg.sender, bounty);

        // 剩余按60%/40%分配
        uint256 remaining = bal - bounty;
        uint256 burnAmt = remaining * BURN_PERCENT_DEFAULT / PERCENTAGE_BASE;
        uint256 jackpotAmt = remaining - burnAmt;

        if (burnAmt > 0) {
            // 转到销毁地址，真正销毁代币
            pools[pid].token.safeTransfer(DEAD_ADDRESS, burnAmt);
        }

        if (jackpotAmt > 0) {
            pools[pid].token.safeTransfer(owner(), jackpotAmt);
        }

        // 重置池子状态
        pools[pid].accPerShare = 0;
        pools[pid].totalStake = 0;
        pools[pid].pendingDust = 0;

        emit Recycled(pid, jackpotAmt, burnAmt);
    }

    /// @notice 更新池子分红
    function _updatePool(uint8 pid) internal {
        // 这里不需要额外逻辑，分红通过depositReward直接更新
    }

    /// @notice 奖励注入时更新池子
    function _updatePoolOnReward(uint8 pid, uint256 reward) internal {
        if (pools[pid].totalStake > 0) {
            uint256 totalReward = reward + pools[pid].pendingDust;
            uint256 increment = totalReward * PRECISION / pools[pid].totalStake;
            pools[pid].accPerShare += increment;
            pools[pid].pendingDust = totalReward - increment * pools[pid].totalStake / PRECISION;
        } else {
            // 空池时将奖励累积到 pendingDust，等待下次有人质押时分配
            pools[pid].pendingDust += reward;
        }
    }

    /// @notice 计算用户待领奖励
    function _pending(uint8 pid, address user) internal view returns (uint256) {
        uint256 userAmount = userStake[pid][user];
        if (userAmount == 0) return 0;

        uint256 totalReward = userAmount * pools[pid].accPerShare / PRECISION;
        return totalReward - userDebt[pid][user];
    }

    /// @notice 查询用户待领奖励
    /// @param pid 池子ID (0=CARGO池, 1=FORT池)
    /// @param user 用户地址
    /// @return 待领奖励数量
    function pendingReward(uint8 pid, address user) external view returns (uint256) {
        return _pending(pid, user);
    }

    /// @notice 查询池子信息
    /// @param pid 池子ID (0=CARGO池, 1=FORT池)
    /// @return token 代币地址
    /// @return totalStake 总质押量
    /// @return accPerShare 累积每股分红
    /// @return lastActiveBlock 最后活跃区块
    function getPoolInfo(uint8 pid) external view returns (
        address token,
        uint256 totalStake,
        uint256 accPerShare,
        uint256 lastActiveBlock
    ) {
        Pool storage pool = pools[pid];
        return (
            address(pool.token),
            pool.totalStake,
            pool.accPerShare,
            pool.lastActiveBlock
        );
    }

    /// @notice 查询用户质押信息
    /// @param pid 池子ID (0=CARGO池, 1=FORT池)
    /// @param user 用户地址
    /// @return stakeAmount 质押数量
    /// @return debt 已领取分红
    /// @return pending 待领奖励
    function getUserInfo(uint8 pid, address user) external view returns (
        uint256 stakeAmount,
        uint256 debt,
        uint256 pending
    ) {
        return (
            userStake[pid][user],
            userDebt[pid][user],
            _pending(pid, user)
        );
    }

    /// @notice 紧急退出：玩家丢失海盗身份时可取回本金（不领取奖励）
    /// @param pid 池子ID (0=CARGO池, 1=FORT池)
    function emergencyUnstake(uint8 pid) external nonReentrant {
        uint256 amt = userStake[pid][msg.sender];
        require(amt > 0, "NO_STAKE");

        pools[pid].totalStake -= amt;
        userStake[pid][msg.sender] = 0;
        userDebt[pid][msg.sender] = 0;
        pools[pid].token.safeTransfer(msg.sender, amt);

        emit Unstaked(msg.sender, pid, amt);
    }

    /* =========  FRONT-END SPECIFIC QUERIES  ========= */

    /// @notice 获取指定池子统计信息（前端仪表盘）
    /// @param faction 阵营 (0=Cargo, 1=Fort)
    /// @return totalStaked 总质押量
    /// @return accPerShare 累积每股分红
    /// @return pendingToday 今日待分配奖励
    function poolStats(uint8 faction) external view returns (
        uint256 totalStaked,
        uint256 accPerShare,
        uint256 pendingToday
    ) {
        require(faction <= 1, "INVALID_FACTION");
        totalStaked = pools[faction].totalStake;
        accPerShare = pools[faction].accPerShare;
        pendingToday = 0; // 简化实现，实际可基于今日分红计算
    }

    /// @notice 获取用户在指定池子的详细信息
    /// @param faction 阵营 (0=Cargo, 1=Fort)
    /// @param user 用户地址
    /// @return staked 质押数量
    /// @return pending 待领奖励
    /// @return lastActive 最后活跃区块
    function userInfo(uint8 faction, address user) external view returns (
        uint256 staked,
        uint256 pending,
        uint32 lastActive
    ) {
        require(faction <= 1, "INVALID_FACTION");
        staked = userStake[faction][user];
        pending = _pending(faction, user);
        lastActive = uint32(pools[faction].lastActiveBlock);
    }

    /// @notice 获取所有池子状态概览
    function getPoolsOverview() external view returns (
        uint256 cargoTotalStake,
        uint256 fortTotalStake,
        uint256 cargoAPR,
        uint256 fortAPR
    ) {
        cargoTotalStake = pools[0].totalStake;
        fortTotalStake = pools[1].totalStake;
        cargoAPR = cargoTotalStake > 0 ? 1000 : 0;
        fortAPR = fortTotalStake > 0 ? 1000 : 0;
    }

    /// @notice 获取用户在所有池子的状态
    function getUserOverview(address user) external view returns (
        uint256 cargoStaked,
        uint256 fortStaked,
        uint256 cargoPending,
        uint256 fortPending
    ) {
        cargoStaked = userStake[0][user];
        fortStaked = userStake[1][user];
        cargoPending = _pending(0, user);
        fortPending = _pending(1, user);
    }
}