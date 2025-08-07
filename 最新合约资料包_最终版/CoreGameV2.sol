// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title CoreGameV2 - 双阵营航海 GameFi 核心合约
/// @notice 实现动态价格船只铸造、FOMO Key、倒计时、随机奖励系统
/// @dev 集成 ShipSBT 铸造，支持动态定价和批量购买
/// @author Cargo vs Fort Team
/// @custom:version 2.0.0
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ShipSBT.sol";
import "./RandomLib.sol";
import "./PiratePool.sol";

/// @dev 仅需铸币接口，避免循环依赖
interface IMintableToken {
    function mint(address to, uint256 amount) external;
}

contract CoreGameV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;


    uint32 public constant MAX_SHIPS = 10_000;
    uint32 public constant STEP_SHIPS = 500;
    uint256 public constant MAX_BATCH_MINT = 20;
    uint16 public constant SLOPE_BPS = 1_000;
    uint256 public constant BASE_PRICE_BNB = 0.001 ether;
    uint256 public constant BASE_PRICE_DBL = 10_000 * 1e18;


    uint256 public constant DAILY_FREE = 6;
    uint8 public constant MAX_LV = 5;
    uint32 public constant BLOCKS_30_MIN = 600;
    uint16 public constant PIRATE_ODDS_BP = 500;

    uint32 public constant BLOCKS_10_MIN = 200;
    uint32 public constant BLOCKS_26_H = 31_200;
    uint32 public constant BLOCKS_PER_DAY = 28_800;
    uint8[6] public extraCap = [0, 2, 3, 4, 5, 6];

    uint256 public constant EXTRA_RUN_COST = 5_000 * 1e18;
    uint256 public constant PIRATE_POOL_PERCENT = 20;
    uint256 public constant JACKPOT_PERCENT = 80;
    uint256 public constant WINNER_POOL_PERCENT = 55;
    uint256 public constant LAST_BUYER_PERCENT = 5;
    uint256 public constant BURN_PERCENT = 20;
    uint256 public constant ROLLOVER_PERCENT = 60;
    uint256 public constant MAX_5X_PERCENT = 25;

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant PERCENTAGE_BASE = 100;
    uint256 public constant BPS_BASE = 10_000;
    uint256 public constant RANDOM_MODULO = 10_000;
    uint256 public constant BASE_REWARD_AMOUNT = 110;


    struct FOMORound {
        uint32 roundStartBlock;
        uint32 endBlock;
        address lastBuyer;
        uint256 cargoKeys;
        uint256 fortKeys;
        uint256 cargoJackpot;
        uint256 fortJackpot;
        bool isActive;
    }


    uint256 public mintedCount;
    address public treasury;
    IERC20 public dblToken;
    ShipSBT public shipSBT;
    IERC20 public cargoToken;
    IERC20 public fortToken;
    PiratePool public piratePool;

    FOMORound public round;
    mapping(uint256 => uint256) public lastVoyageBlock;
    mapping(address => mapping(uint32 => uint16)) public dailyCount;
    mapping(uint256 => mapping(uint32 => uint8)) public extraRuns;
    mapping(uint256 => uint8) public streakCount;
    uint32 public dayCounter;
    mapping(uint32 => mapping(address => uint256)) private cargoKeysOf;
    mapping(uint32 => mapping(address => uint256)) private fortKeysOf;
    bool private settling;
    uint32 public lastBuyerBlock;
    bool public piratePoolsInit;

    uint256 public rewardPerKey;
    uint8 public rewardFaction;
    mapping(address => uint32) public lastClaimDay;


    error INSUFFICIENT_PAYMENT();
    error MAX_SUPPLY_EXCEEDED();
    error INVALID_QUANTITY();
    error INVALID_LEVEL();
    error ZERO_ADDRESS();
    error RUN_LIMIT();
    error PAY_LOW();
    error INVALID_SHIP();
    error AMT_ZERO();
    error COOLDOWN_ACTIVE();
    error NO_ROUND();
    error ROUND_ACTIVE();
    error ALREADY_INIT();
    error IN_SETTLEMENT();
    error CROSS_TIER();
    error PIRATE_CANNOT_USE();


    struct ShipInfo {
        uint256 shipId;
        uint8 level;
        uint8 faction;
        uint8 streak;
        uint16 dailyUsed;
        uint8 extraUsed;
        uint8 extraCap;
        uint256 lastVoyageBlock;
        bool canVoyage;
    }

    struct GameStatus {
        uint256 userDailyCount;
        uint256 userCargoKeys;
        uint256 userFortKeys;
        bool roundActive;
        uint32 roundEndBlock;
        uint256 cargoJackpot;
        uint256 fortJackpot;
        uint32 lastClaimDay;
        bool canClaimReward;
        uint256 currentBlockNumber;
        uint32 currentEpoch;
        uint32 dayCounter;
    }


    event ShipsPurchased(
        address indexed buyer,
        uint256 indexed qty,
        uint256 priceBNB,
        uint256 priceDBL
    );
    event VoyageExecuted(
        uint256 indexed shipId,
        address indexed user,
        uint8 indexed tier,
        uint256 reward,
        uint8 multiplier,
        uint8 streak
    );
    event KeyPurchased(
        address indexed buyer,
        uint8 indexed faction,
        uint256 indexed shipId,
        uint256 keyCount,
        uint32 newEndBlock
    );
    event ExtraRunPurchased(uint256 indexed shipId, uint8 indexed lv, uint32 epoch);
    event FinishDay(uint8 indexed winningFaction, uint256 winnerShare, uint256 rollAmount);
    event CooldownActive(uint32 indexed endBlock);
    event ShipUpgraded(
        address indexed user,
        uint256 indexed burned1,
        uint256 indexed burned2,
        uint256 newShip,
        uint8 newLevel
    );
    event PirateMinted(address indexed to, uint256 indexed pirateId);
    event Claimed(address indexed user, uint8 indexed faction, uint256 amount);


    event RoundStarted(uint32 indexed roundId, uint32 indexed startBlock);
    event RoundEnded(uint32 indexed roundId, uint8 indexed winningFaction, address indexed lastBuyer);
    event StreakUpdated(uint256 indexed shipId, uint8 indexed newStreak);
    event DailyCountUpdated(address indexed user, uint32 indexed epoch, uint256 indexed newCount);
    event JackpotUpdated(uint8 indexed faction, uint256 indexed newAmount);
    event PriceTierChanged(uint256 indexed oldCount, uint256 indexed newCount, uint256 newPriceBNB, uint256 newPriceDBL);
    event EmergencyPauseChanged(bool indexed paused);
    event RoundSettled(uint32 indexed roundId, uint8 indexed winner, uint256 indexed reward);
    event FOMOExtended(uint32 indexed roundId, uint32 indexed newEndBlock);

    /// @notice 构造函数
    /// @param _treasury 资金库地址
    /// @param _dblToken DBL 代币合约地址
    /// @param _shipSBT 船只 SBT 合约地址
    /// @param _cargoToken Cargo 代币合约地址
    /// @param _fortToken Fort 代币合约地址
    /// @param _piratePool 海盗池地址
    constructor(
        address _treasury,
        address _dblToken,
        address _shipSBT,
        address _cargoToken,
        address _fortToken,
        address _piratePool
    ) Ownable(msg.sender) {
        if (_treasury == address(0) || _dblToken == address(0) || _shipSBT == address(0) ||
            _cargoToken == address(0) || _fortToken == address(0) || _piratePool == address(0)) {
            revert ZERO_ADDRESS();
        }

        treasury = _treasury;
        dblToken = IERC20(_dblToken);
        shipSBT = ShipSBT(_shipSBT);
        cargoToken = IERC20(_cargoToken);
        fortToken = IERC20(_fortToken);
        piratePool = PiratePool(_piratePool);
        mintedCount = 0;
    }

    /// @notice 初始化海盗池（需要在设置权限后调用）
    function initializePiratePools() external onlyOwner {
        if (piratePoolsInit) revert ALREADY_INIT();
        piratePool.initPools(address(cargoToken), address(fortToken));
        piratePoolsInit = true;
    }

    /// @notice 购买船只 NFT
    function buyShip(uint8 lv, uint256 qty) external payable nonReentrant whenNotPaused {
        // 参数验证
        if (lv == 0 || lv > 5) revert INVALID_LEVEL();
        if (qty == 0 || qty > MAX_BATCH_MINT) {
            revert INVALID_QUANTITY();
        }

        uint256 newMinted = mintedCount + qty;
        if (newMinted > MAX_SHIPS) {
            revert MAX_SUPPLY_EXCEEDED();
        }

        // 防止跨阶梯购买导致价格被低估
        uint256 currentTier = mintedCount / STEP_SHIPS;
        uint256 newTier = (newMinted - 1) / STEP_SHIPS;
        if (currentTier != newTier) {
            revert CROSS_TIER();
        }

        // 计算区间价格（基于新的mintedCount）
        (uint256 totalBNB, uint256 totalDBL) = _priceForRange(mintedCount, newMinted);

        // 先更新状态防止重入
        uint256 oldCount = mintedCount;
        mintedCount = newMinted;

        // 检查是否跨越价格阶梯
        if (oldCount / STEP_SHIPS != newMinted / STEP_SHIPS) {
            (uint256 newPriceBNB, uint256 newPriceDBL) = _priceForRange(newMinted, newMinted + 1);
            emit PriceTierChanged(oldCount, newMinted, newPriceBNB, newPriceDBL);
        }

        // 验证 BNB 支付
        if (msg.value < totalBNB) {
            revert INSUFFICIENT_PAYMENT();
        }

        // 转移 DBL 代币到资金库
        dblToken.safeTransferFrom(msg.sender, treasury, totalDBL);

        // 将 BNB 转入资金库
        (bool ok, ) = treasury.call{value: totalBNB}("");
        require(ok, "TREASURY_FAIL");

        // 退还多余的 BNB
        if (msg.value > totalBNB) {
            (ok, ) = msg.sender.call{value: msg.value - totalBNB}("");
            require(ok, "REFUND_ERR");
        }

        // 最后执行铸造（可能触发重入）
        _mintShips(msg.sender, lv, qty, mintedCount);

        emit ShipsPurchased(msg.sender, qty, totalBNB, totalDBL);
    }

    /// @notice 购买船只 NFT（带锁价保护）
    /// @param lv 船只等级 (1-5)
    /// @param qty 购买数量 (1-20)
    /// @param quoteId 报价ID
    function buyShipWithQuote(uint8 lv, uint256 qty, uint256 quoteId) external payable nonReentrant whenNotPaused {
        // 参数验证
        if (lv == 0 || lv > 5) revert INVALID_LEVEL();
        if (qty == 0 || qty > MAX_BATCH_MINT) {
            revert INVALID_QUANTITY();
        }

        uint256 newMinted = mintedCount + qty;
        if (newMinted > MAX_SHIPS) {
            revert MAX_SUPPLY_EXCEEDED();
        }

        // 验证报价ID是否匹配当前状态
        uint256 expectedQuoteId = uint256(keccak256(abi.encodePacked(block.number, mintedCount, lv, qty, msg.sender)));
        require(quoteId == expectedQuoteId, "QUOTE_EXPIRED");

        // 防止跨阶梯购买导致价格被低估
        uint256 currentTier = mintedCount / STEP_SHIPS;
        uint256 newTier = (newMinted - 1) / STEP_SHIPS;
        if (currentTier != newTier) {
            revert CROSS_TIER();
        }

        // 计算锁定价格（基于报价时的mintedCount）
        (uint256 totalBNB, uint256 totalDBL) = _priceForRange(mintedCount, newMinted);

        // 先更新状态防止重入
        uint256 oldCount = mintedCount;
        mintedCount = newMinted;

        // 检查是否跨越价格阶梯
        if (oldCount / STEP_SHIPS != newMinted / STEP_SHIPS) {
            (uint256 newPriceBNB, uint256 newPriceDBL) = _priceForRange(newMinted, newMinted + 1);
            emit PriceTierChanged(oldCount, newMinted, newPriceBNB, newPriceDBL);
        }

        // 验证 BNB 支付
        if (msg.value < totalBNB) {
            revert INSUFFICIENT_PAYMENT();
        }

        // 转移 DBL 代币到资金库
        dblToken.safeTransferFrom(msg.sender, treasury, totalDBL);

        // 退还多余的 BNB
        if (msg.value > totalBNB) {
            payable(msg.sender).transfer(msg.value - totalBNB);
        }

        // 转移 BNB 到资金库
        payable(treasury).transfer(totalBNB);

        // 铸造船只
        _mintShips(msg.sender, lv, qty, mintedCount);

        emit ShipsPurchased(msg.sender, qty, totalBNB, totalDBL);
    }





    /// @notice 获取当前铸造价格
    /// @return priceBNB 当前 BNB 价格
    /// @return priceDBL 当前 DBL 价格
    function _currentPrice() internal view returns (uint256 priceBNB, uint256 priceDBL) {
        return _priceForRange(mintedCount, mintedCount + 1);
    }

    /// @notice 计算区间价格（防重入专用）
    /// @param fromCount 起始铸造数量
    /// @param toCount 结束铸造数量
    /// @return priceBNB 总 BNB 价格
    /// @return priceDBL 总 DBL 价格
    function _priceForRange(uint256 fromCount, uint256 toCount) internal pure returns (uint256 priceBNB, uint256 priceDBL) {
        // 按每艘船计算累进价格
        for (uint256 i = fromCount; i < toCount; i++) {
            uint256 stage = i / STEP_SHIPS;
            uint256 multiplierBps = BPS_BASE + stage * SLOPE_BPS;

            priceBNB += (BASE_PRICE_BNB * multiplierBps) / BPS_BASE;
            priceDBL += (BASE_PRICE_DBL * multiplierBps) / BPS_BASE;
        }
    }

    /// @notice 获取当前铸造价格（外部查询）
    /// @return priceBNB 当前 BNB 价格
    /// @return priceDBL 当前 DBL 价格
    function getCurrentPrice() external view returns (uint256 priceBNB, uint256 priceDBL) {
        return _currentPrice();
    }

    /// @notice 获取剩余可铸造数量
    /// @return remaining 剩余数量
    function getRemainingSupply() external view returns (uint256 remaining) {
        return MAX_SHIPS - mintedCount;
    }

    /// @notice 更新资金库地址（仅所有者）
    /// @param _treasury 新的资金库地址
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) {
            revert ZERO_ADDRESS();
        }
        treasury = _treasury;
    }

    /// @notice 出航函数 - 核心游戏逻辑
    /// @param shipId 船只ID
    /// @param enemyTokenAmount 敌币数量

    function voyage(uint256 shipId, uint256 enemyTokenAmount) external nonReentrant whenNotPaused {
        // 验证船只所有权
        if (shipSBT.ownerOf(shipId) != msg.sender) {
            revert INVALID_SHIP();
        }
        // 海盗不能出航
        if (_getShipFaction(shipId) == shipSBT.FACTION_PIRATE()) {
            revert PIRATE_CANNOT_USE();
        }

        uint8 shipLevel = shipSBT.levelOf(shipId);
        uint32 epoch = uint32(block.number / BLOCKS_PER_DAY);

        // 检查次数限制
        _checkRunLimit(shipId, epoch, shipLevel);

        // 处理敌币分配
        _handleEnemyTokens(shipId, enemyTokenAmount);

        // 购买Key并重置倒计时
        _buyKeyAndResetTimer(shipId, shipLevel);

        // 随机开奖
        uint8 tier = _randomReward(shipId);
        uint256 reward = _calculateReward(shipLevel, tier);

        // 发放奖励
        _distributeReward(shipId, shipLevel, reward);

        // 更新状态
        _updateStreak(shipId);
        lastVoyageBlock[shipId] = block.number;
        dailyCount[msg.sender][epoch]++;
        emit DailyCountUpdated(msg.sender, epoch, dailyCount[msg.sender][epoch]);

        emit VoyageExecuted(shipId, msg.sender, tier, reward, tier, streakCount[shipId]);
    }

    /// @notice 检查出航次数限制
    function _checkRunLimit(uint256 shipId, uint32 epoch, uint8 shipLevel) internal {
        uint16 todayRuns = dailyCount[msg.sender][epoch];
        uint8 freeLimit = uint8(DAILY_FREE + (shipLevel - 1) * 4); // Lv1=6, Lv2=10, Lv3=14, Lv4=18, Lv5=22

        if (todayRuns >= freeLimit) {
            // 需要付费
            uint8 paidUsed = extraRuns[shipId][epoch];
            uint8 paidLimit = extraCap[shipLevel];

            if (paidUsed >= paidLimit) {
                revert RUN_LIMIT();
            }

            // 扣除DBL
            uint256 cost = EXTRA_RUN_COST;
            if (dblToken.balanceOf(msg.sender) < cost) {
                revert PAY_LOW();
            }

            dblToken.safeTransferFrom(msg.sender, treasury, cost);
            extraRuns[shipId][epoch]++;

            emit ExtraRunPurchased(shipId, shipLevel, epoch);
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                              用户体验优化                                    */
    /* -------------------------------------------------------------------------- */

    /// @notice 批量查询用户船只状态
    /// @param user 用户地址
    /// @param shipIds 船只ID数组
    /// @return shipInfos 船只信息数组
    function getUserShipsInfo(address user, uint256[] calldata shipIds)
        external view returns (ShipInfo[] memory shipInfos)
    {
        shipInfos = new ShipInfo[](shipIds.length);
        uint32 currentEpoch = uint32(block.number / BLOCKS_PER_DAY);

        for (uint256 i = 0; i < shipIds.length; i++) {
            uint256 shipId = shipIds[i];
            if (shipSBT.ownerOf(shipId) != user) {
                continue; // 跳过非用户拥有的船只
            }

            shipInfos[i] = _getShipInfo(shipId, user, currentEpoch);
        }
    }

    /// @notice 获取单个船只信息（内部函数）
    function _getShipInfo(uint256 shipId, address user, uint32 currentEpoch)
        internal view returns (ShipInfo memory)
    {
        uint8 level = shipSBT.levelOf(shipId);
        return ShipInfo({
            shipId: shipId,
            level: level,
            faction: shipSBT.factionOf(shipId),
            streak: streakCount[shipId],
            dailyUsed: dailyCount[user][currentEpoch],
            extraUsed: extraRuns[shipId][currentEpoch],
            extraCap: extraCap[level],
            lastVoyageBlock: lastVoyageBlock[shipId],
            canVoyage: _canVoyageNow(shipId, user, currentEpoch)
        });
    }

    /// @notice 获取用户游戏状态概览
    /// @param user 用户地址
    /// @return gameStatus 游戏状态信息
    function getUserGameStatus(address user) external view returns (GameStatus memory gameStatus) {
        uint32 currentEpoch = uint32(block.number / BLOCKS_PER_DAY);

        gameStatus = GameStatus({
            userDailyCount: dailyCount[user][currentEpoch],
            userCargoKeys: cargoKeysOf[dayCounter][user],
            userFortKeys: fortKeysOf[dayCounter][user],
            roundActive: round.endBlock > block.number,
            roundEndBlock: round.endBlock,
            cargoJackpot: round.cargoJackpot,
            fortJackpot: round.fortJackpot,
            lastClaimDay: lastClaimDay[user],
            canClaimReward: lastClaimDay[user] < dayCounter && rewardPerKey > 0,
            currentBlockNumber: block.number,
            currentEpoch: currentEpoch,
            dayCounter: dayCounter
        });
    }

    /// @notice 检查船只是否可以立即出航
    /// @param shipId 船只ID
    /// @param user 用户地址
    /// @param epoch 当前轮次
    /// @return 是否可以出航
    function _canVoyageNow(uint256 shipId, address user, uint32 epoch) internal view returns (bool) {
        // 检查海盗限制
        if (shipSBT.factionOf(shipId) == shipSBT.FACTION_PIRATE()) {
            return false;
        }

        // 检查次数限制
        uint8 level = shipSBT.levelOf(shipId);
        uint256 dailyUsed = dailyCount[user][epoch];
        uint256 freeLimit = DAILY_FREE + (level - 1) * 4; // 6, 10, 14, 18, 22
        uint8 extraUsed = extraRuns[shipId][epoch];
        uint8 extraLimit = extraCap[level];

        return (dailyUsed < freeLimit) || (extraUsed < extraLimit);
    }

    /* -------------------------------------------------------------------------- */
    /*                         A2 – buyExtraRun( ) 独立入口                        */
    /* -------------------------------------------------------------------------- */

    /// @notice 预先购买 1 次付费出航（不立即出航）
    /// @param shipId 目标船只 ID
    function buyExtraRun(uint256 shipId) external nonReentrant {
        require(shipSBT.ownerOf(shipId) == msg.sender, "NOT_OWNER");
        uint8 lv = shipSBT.levelOf(shipId);
        require(lv >= 1 && lv <= MAX_LV, "BAD_LV");
        uint32 epoch = uint32(block.number / BLOCKS_PER_DAY);

        uint8 used = extraRuns[shipId][epoch];
        uint8 limit = extraCap[lv];
        require(used < limit, "PAID_FULL");

        uint256 cost = EXTRA_RUN_COST;
        dblToken.safeTransferFrom(msg.sender, treasury, cost);

        extraRuns[shipId][epoch] = used + 1;
        emit ExtraRunPurchased(shipId, lv, epoch);
    }



    /// @notice 预览购买船只的价格
    /// @param lv 船只等级
    /// @param qty 购买数量
    /// @return totalBNB 总BNB费用
    /// @return totalDBL 总DBL费用
    /// @return willCrossTier 是否会跨越价格阶梯
    function previewShipPrice(uint8 lv, uint256 qty) external view returns (
        uint256 totalBNB,
        uint256 totalDBL,
        bool willCrossTier
    ) {
        require(lv >= 1 && lv <= MAX_LV, "INVALID_LEVEL");
        require(qty > 0 && qty <= MAX_BATCH_MINT, "INVALID_QTY");

        uint256 newMinted = mintedCount + qty;
        uint256 currentTier = mintedCount / STEP_SHIPS;
        uint256 newTier = newMinted / STEP_SHIPS;
        willCrossTier = currentTier != newTier;

        (totalBNB, totalDBL) = _priceForRange(mintedCount, newMinted);
    }

    /// @notice 获取购买报价（用于锁价）
    /// @param lv 船只等级
    /// @param qty 购买数量
    /// @return quoteId 报价ID（基于当前区块和mintedCount）
    /// @return totalBNB 总BNB费用
    /// @return totalDBL 总DBL费用

    function quoteBuyPrice(uint8 lv, uint256 qty) external view returns (
        uint256 quoteId,
        uint256 totalBNB,
        uint256 totalDBL
    ) {
        require(lv >= 1 && lv <= MAX_LV, "INVALID_LEVEL");
        require(qty > 0 && qty <= MAX_BATCH_MINT, "INVALID_QTY");

        uint256 newMinted = mintedCount + qty;
        if (newMinted > MAX_SHIPS) {
            revert MAX_SUPPLY_EXCEEDED();
        }

        // 防止跨阶梯购买
        uint256 currentTier = mintedCount / STEP_SHIPS;
        uint256 newTier = (newMinted - 1) / STEP_SHIPS;
        if (currentTier != newTier) {
            revert CROSS_TIER();
        }

        (totalBNB, totalDBL) = _priceForRange(mintedCount, newMinted);

        // 生成报价ID：基于区块号和当前mintedCount
        quoteId = uint256(keccak256(abi.encodePacked(block.number, mintedCount, lv, qty, msg.sender)));
    }

    /// @notice 紧急暂停功能（仅owner）
    bool public emergencyPaused = false;

    modifier whenNotPaused() {
        require(!emergencyPaused, "EMERGENCY_PAUSED");
        _;
    }

    function setEmergencyPause(bool paused) external onlyOwner {
        emergencyPaused = paused;
        emit EmergencyPauseChanged(paused);
    }

    /// @notice 处理敌币分配
    function _handleEnemyTokens(uint256 shipId, uint256 amount) internal {
        if (amount == 0) {
            revert AMT_ZERO();
        }

        uint8 shipFaction = _getShipFaction(shipId);
        IERC20 enemyToken = shipFaction == 0 ? fortToken : cargoToken;

        // 验证敌币余额
        if (enemyToken.balanceOf(msg.sender) < amount) {
            revert PAY_LOW();
        }

        // 20% 到海盗池
        uint256 toPirates = (amount * PIRATE_POOL_PERCENT) / PERCENTAGE_BASE;
        enemyToken.safeTransferFrom(msg.sender, address(this), toPirates);

        // 授权并存入海盗池
        uint8 poolId = shipFaction == 0 ? 1 : 0; // Cargo船→Fort池, Fort船→Cargo池
        // 兼容旧版ERC20：检查当前授权额度，不足时先清零再设置
        uint256 currentAllowance = enemyToken.allowance(address(this), address(piratePool));
        if (currentAllowance < toPirates) {
            if (currentAllowance > 0) {
                enemyToken.approve(address(piratePool), 0);
            }
            enemyToken.approve(address(piratePool), toPirates);
        }
        piratePool.depositReward(poolId, toPirates);

        // 80% 到奖池
        uint256 toJackpot = amount - toPirates;
        enemyToken.safeTransferFrom(msg.sender, address(this), toJackpot);

        // 分配到对应阵营奖池
        if (shipFaction == 0) {
            round.cargoJackpot += toJackpot;
            emit JackpotUpdated(0, round.cargoJackpot);
        } else {
            round.fortJackpot += toJackpot;
            emit JackpotUpdated(1, round.fortJackpot);
        }
    }

    /// @notice 购买Key并重置倒计时
    function _buyKeyAndResetTimer(uint256 shipId, uint8 /*shipLevel*/) internal {
        uint8 shipFaction = _getShipFaction(shipId);

        // 如果是首次Key，启动轮次
        if (!round.isActive) {
            round.roundStartBlock = uint32(block.number);
            round.endBlock = uint32(block.number + BLOCKS_10_MIN);
            round.isActive = true;
            emit RoundStarted(dayCounter, round.roundStartBlock);
        } else {
            // 检查是否超过26小时封锁
            if (block.number <= round.roundStartBlock + BLOCKS_26_H) {
                round.endBlock = uint32(block.number + BLOCKS_10_MIN);
                emit FOMOExtended(dayCounter, round.endBlock);
            }
        }

        // 增加Key数量
        if (shipFaction == 0) {
            round.cargoKeys++;
            cargoKeysOf[dayCounter][msg.sender] += 1;
        } else {
            round.fortKeys++;
            fortKeysOf[dayCounter][msg.sender] += 1;
        }

        round.lastBuyer = msg.sender;
        lastBuyerBlock = uint32(block.number);

        uint256 totalKeys = shipFaction == 0 ? round.cargoKeys : round.fortKeys;
        emit KeyPurchased(msg.sender, shipFaction, shipId, totalKeys, round.endBlock);
    }

    /// @notice 随机开奖（含连击和日累计加成）
    function _randomReward(uint256 shipId) internal view returns (uint8) {
        uint256 rand = RandomLib.randomUint(shipId);
        uint8 shipLevel = shipSBT.levelOf(shipId);

        // 获取对应等级的概率分布 [0×, 1×, 2×, 5×]
        uint8[4] memory probs = _getRewardProbabilities(shipLevel);

        // 应用连击和日累计加成
        uint8 extra = _bonusPP(shipId, tx.origin, uint32(block.number / BLOCKS_PER_DAY));
        if (extra > 0) {
            // 把加成从 0× 转移到 5×
            uint8 shift = probs[0] >= extra ? extra : probs[0];
            probs[0] -= shift;
            probs[3] += shift;

            // 5× 封顶 25%
            if (probs[3] > MAX_5X_PERCENT) {
                uint8 excess = probs[3] - uint8(MAX_5X_PERCENT);
                probs[3] = uint8(MAX_5X_PERCENT);
                probs[0] += excess; // 多余退回 0×
            }
        }

        if (rand < probs[0]) return 0;                    // 0×
        if (rand < probs[0] + probs[1]) return 1;         // 1×
        if (rand < probs[0] + probs[1] + probs[2]) return 2; // 2×
        return 5;                                         // 5×
    }

    /// @notice 获取奖励概率分布
    function _getRewardProbabilities(uint8 level) internal pure returns (uint8[4] memory) {
        if (level == 1) return [uint8(25), 55, 18, 2];
        if (level == 2) return [uint8(20), 50, 26, 4];
        if (level == 3) return [uint8(15), 45, 33, 7];
        if (level == 4) return [uint8(12), 42, 36, 10];
        if (level == 5) return [uint8(12), 40, 36, 12];
        return [uint8(0), 0, 0, 0]; // 默认值
    }

    /// @notice 内部获取升级费用
    function _getUpgradeCost(uint8 level) internal pure returns (uint256) {
        if (level == 1) return 1_000e18;
        if (level == 2) return 2_000e18;
        if (level == 3) return 4_000e18;
        if (level == 4) return 8_000e18;
        return 0; // 不应该到达这里
    }

    /// @notice 计算奖励数量
    function _calculateReward(uint8 shipLevel, uint8 tier) internal pure returns (uint256) {
        // 基础奖励：110 × 等级倍数
        uint256[6] memory baseRewards = [
            uint256(0),                    // Lv0
            BASE_REWARD_AMOUNT,            // Lv1: 110 × 1.0 = 110
            uint256(159),                  // Lv2: 110 × 1.45 = 159.5
            uint256(209),                  // Lv3: 110 × 1.9 = 209
            uint256(258),                  // Lv4: 110 × 2.35 = 258.5
            uint256(308)                   // Lv5: 110 × 2.8 = 308
        ];

        uint256 baseReward = baseRewards[shipLevel] * 1e18;

        if (tier == 0) return 0;
        if (tier == 1) return baseReward;
        if (tier == 2) return baseReward * 2;
        if (tier == 5) return baseReward * 5;

        return baseReward;
    }

    /// @notice 分发奖励
    function _distributeReward(uint256 shipId, uint8 /*shipLevel*/, uint256 reward) internal {
        if (reward == 0) return;

        uint8 shipFaction = _getShipFaction(shipId);
        IMintableToken(address(shipFaction == 0 ? cargoToken : fortToken))
            .mint(msg.sender, reward);
    }

    /// @notice 计算额外加成 (0-8)
    function _bonusPP(uint256 shipId, address user, uint32 epoch) internal view returns (uint8) {
        uint8 bonus = 0;

        // 连击加成
        uint8 streak = streakCount[shipId];
        if (streak >= 4 && streak <= 6) {
            bonus += 2;
        } else if (streak >= 7) {
            bonus += 6;
        }

        // 日累计加成
        uint16 today = dailyCount[user][epoch];
        if (today >= 50) {
            bonus += 6;
        } else if (today >= 30) {
            bonus += 4;
        } else if (today >= 15) {
            bonus += 2;
        }

        return bonus; // 最大 8
    }

    /// @notice 获取船只阵营
    function _getShipFaction(uint256 shipId) internal view returns (uint8) {
        return shipSBT.factionOf(shipId);   // 使用 ShipSBT 作为唯一数据源
    }

    /// @notice 生成船只阵营和海盗标识
    /// @dev 5%概率海盗，95%概率普通船只（Cargo/Fort各50%）
    function _generateShipFaction(uint256 seed) private view returns (uint8 faction, bool pirateFlag) {
        uint256 r = uint256(
            keccak256(
                abi.encodePacked(blockhash(block.number - 1), seed, msg.sender)
            )
        ) % RANDOM_MODULO; // 0-9999

        if (r < PIRATE_ODDS_BP) {
            // 5% → Pirate
            return (shipSBT.FACTION_PIRATE(), true);
        }
        // 剩余95%：偶数Cargo，奇数Fort
        return (r % 2 == 0 ? shipSBT.FACTION_CARGO() : shipSBT.FACTION_FORT(), false);
    }

    /// @notice 内部铸造函数，避免stack too deep
    function _mintShips(address to, uint8 lv, uint256 qty, uint256 seedBase) private {
        for (uint256 i = 0; i < qty; i++) {
            (uint8 fac, bool pirateFlag) = _generateShipFaction(seedBase + i);
            uint256 shipId = shipSBT.mintWithFaction(to, lv, fac, pirateFlag);

            if (pirateFlag) {
                emit PirateMinted(to, shipId);
            }
        }
    }

    /// @notice 结算当日胜负并拆分奖池
    /// @dev 任何人在倒计时结束后均可调用；分账后重置round结构
    function finishDay() external nonReentrant {
        // 检查是否有活跃轮次
        if (!round.isActive) {
            revert NO_ROUND();
        }

        // 检查轮次是否结束
        if (block.number < round.endBlock) {
            revert ROUND_ACTIVE();
        }

        // 检查冷却期并发出事件
        if (block.number <= lastBuyerBlock + 3) {
            uint32 readyBlock = uint32(lastBuyerBlock + 3);
            emit CooldownActive(readyBlock);
            revert COOLDOWN_ACTIVE();
        }

        if (settling) revert IN_SETTLEMENT();

        settling = true;

        // 1. 判断胜负
        uint8 winFaction = round.cargoKeys > round.fortKeys ? 0 : 1;
        IERC20 winToken = winFaction == 0 ? cargoToken : fortToken;

        // 2. 资金拆账
        uint256 winJackpot = winFaction == 0 ? round.cargoJackpot : round.fortJackpot;
        uint256 loseJackpot = winFaction == 0 ? round.fortJackpot : round.cargoJackpot;

        uint256 toWinnerPool = (winJackpot * WINNER_POOL_PERCENT) / PERCENTAGE_BASE;
        uint256 toLastBuyer = (winJackpot * LAST_BUYER_PERCENT) / PERCENTAGE_BASE;
        uint256 burnAmount = (winJackpot * BURN_PERCENT) / PERCENTAGE_BASE;

        // 3. 分配胜方Key分红
        uint256 totalKeys = winFaction == 0 ? round.cargoKeys : round.fortKeys;
        if (totalKeys > 0) {
            rewardPerKey = toWinnerPool / totalKeys;   // 单 Key 应得
            rewardFaction = winFaction;
            // 奖金留在合约，玩家后续 claim；dust 忽略
            // winToken.safeTransfer(address(this), rewardPerKey * totalKeys);
        }

        if (toLastBuyer > 0) {
            winToken.safeTransfer(round.lastBuyer, toLastBuyer);
        }

        if (burnAmount > 0) {
            // 真正销毁
            winToken.safeTransfer(DEAD_ADDRESS, burnAmount);
        }

        // 4. 60% 失败方滚入次日
        uint256 rollAmount = (loseJackpot * ROLLOVER_PERCENT) / PERCENTAGE_BASE;

        emit FinishDay(winFaction, toWinnerPool, rollAmount);
        emit RoundEnded(dayCounter, winFaction, round.lastBuyer);
        emit RoundSettled(dayCounter, winFaction, toWinnerPool);

        // 5. 重置部分回合数据
        round.isActive = false;
        round.cargoKeys = 0;
        round.fortKeys = 0;
        round.roundStartBlock = 0;
        round.endBlock = 0;
        round.lastBuyer = address(0);

        // 设置翻滚金额到新轮次
        if (winFaction == 0) {
            round.cargoJackpot = 0;
            round.fortJackpot = rollAmount;
        } else {
            round.cargoJackpot = rollAmount;
            round.fortJackpot = 0;
        }

        // 进入下一天
        dayCounter += 1;
        settling = false;
    }

    /// @notice 玩家领取胜方 Key 分红

    function claimWinnerReward() external nonReentrant {
        require(lastClaimDay[msg.sender] < dayCounter, "ALREADY_CLAIMED");
        uint32 idx = dayCounter - 1; // 刚结算完的那天
        uint256 keys = rewardFaction == 0
            ? cargoKeysOf[idx][msg.sender]
            : fortKeysOf[idx][msg.sender];
        require(keys > 0 && rewardPerKey > 0, "NO_REWARD");

        lastClaimDay[msg.sender] = dayCounter;
        uint256 amount = keys * rewardPerKey;
        IERC20 token = rewardFaction == 0 ? cargoToken : fortToken;
        token.safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, rewardFaction, amount);
    }

    /// @notice 分配奖励给获胜者
    /// @param winToken 获胜阵营代币
    /// @param amount 分配总额
    /// @param winFaction 获胜阵营 (0=Cargo, 1=Fort)
    function _distributeToWinners(IERC20 winToken, uint256 amount, uint8 winFaction) internal {
        if (amount == 0) return;

        uint256 totalKeys = winFaction == 0 ? round.cargoKeys : round.fortKeys;
        if (totalKeys == 0) {
            // 无获胜者，资金锁定在合约中
            winToken.safeTransfer(address(this), amount);
            return;
        }

        // 简化版本：给lastBuyer全部奖励
        // TODO: 实现按Key比例分配给所有获胜者
        winToken.safeTransfer(round.lastBuyer, amount);
    }

    /// @notice 更新连击计数
    /// @param shipId 船只ID
    function _updateStreak(uint256 shipId) internal {
        uint256 lastBlock = lastVoyageBlock[shipId];

        if (lastBlock == 0 || block.number - lastBlock > BLOCKS_30_MIN) {
            // 首次出航或超过30分钟，重置连击
            streakCount[shipId] = 1;
            emit StreakUpdated(shipId, 1);
        } else {
            // 30分钟内连续出航，增加连击
            streakCount[shipId]++;
            emit StreakUpdated(shipId, streakCount[shipId]);
        }
    }

    /// @notice 查询当前轮次状态
    function getCurrentRound() external view returns (
        uint32 roundStartBlock,
        uint32 endBlock,
        address lastBuyer,
        uint256 cargoKeys,
        uint256 fortKeys,
        uint256 cargoJackpot,
        uint256 fortJackpot,
        bool isActive
    ) {
        return (
            round.roundStartBlock,
            round.endBlock,
            round.lastBuyer,
            round.cargoKeys,
            round.fortKeys,
            round.cargoJackpot,
            round.fortJackpot,
            round.isActive
        );
    }

    /// @notice 回收闲置海盗池资金 (仅所有者)
    /// @param pid 池子ID (0=CARGO池, 1=FORT池)
    /// @param jackpot 奖池地址
    /// @param burnPct 销毁百分比
    function recycleIfIdle(uint8 pid, address jackpot, uint256 burnPct) external onlyOwner {
        piratePool.recycleIfIdle(pid, jackpot, burnPct);
    }

    /* -------------------------------------------------------------------------- */
    /*                                 船只升级系统                                */
    /* -------------------------------------------------------------------------- */

    /// @notice 升级船只：两艘相同等级+阵营的船只合成为更高等级
    /// @param idA 第一艘船只ID
    /// @param idB 第二艘船只ID
    function upgradeShip(uint256 idA, uint256 idB) external nonReentrant {
        require(idA != idB, "SAME_ID");

        // 海盗不能升级
        if (shipSBT.factionOf(idA) == shipSBT.FACTION_PIRATE() || shipSBT.factionOf(idB) == shipSBT.FACTION_PIRATE()) {
            revert PIRATE_CANNOT_USE();
        }

        // 验证船只等级
        uint8 lv = shipSBT.levelOf(idA);
        require(lv == shipSBT.levelOf(idB), "LEVEL_MISMATCH");
        require(lv < MAX_LV, "MAX_LEVEL");

        // 验证所有权
        address owner = shipSBT.ownerOf(idA);
        require(owner == msg.sender && shipSBT.ownerOf(idB) == msg.sender, "NOT_OWNER");

        // 验证阵营
        uint8 fac = shipSBT.factionOf(idA);
        require(fac == shipSBT.factionOf(idB), "FACTION_MISMATCH");

        // 选择敌方代币并扣除升级费用
        IERC20 enemy = fac == 0 ? fortToken : cargoToken;
        uint256 cost = _getUpgradeCost(lv);

        // 转移敌方代币到销毁地址（100% 销毁）
        enemy.safeTransferFrom(msg.sender, DEAD_ADDRESS, cost);

        // 销毁旧船只
        shipSBT.burn(idA);
        shipSBT.burn(idB);

        // 铸造新船只并继承阵营（非海盗）
        uint256 newId = shipSBT.mintWithFaction(msg.sender, lv + 1, fac, false);

        emit ShipUpgraded(msg.sender, idA, idB, newId, lv + 1);
    }



    /// @notice 获取升级费用
    /// @param level 当前等级
    /// @return cost 升级所需的敌方代币数量
    function getUpgradeCost(uint8 level) external pure returns (uint256 cost) {
        require(level > 0 && level < MAX_LV, "INVALID_LEVEL");
        return _getUpgradeCost(level);
    }

    /* -------------------------------------------------------------------------- */
    /*                         FRONT-END TIME-HELPER API                          */
    /* -------------------------------------------------------------------------- */
    uint32 public constant AVG_BLOCK_SEC = 3;      // BSC≈3 s；如主网可调

    /**
     * @dev 返回本日回合剩余秒数；若已结束返回 0。
     * 与 storage 中 round.endBlock 对齐，无额外存储开销。
     */
    function getRemainingTime() external view returns (uint32) {
        FOMORound storage r = round;                   // 全局唯一日回合
        if (block.number >= r.endBlock) return 0;
        unchecked {
            return uint32((r.endBlock - block.number) * AVG_BLOCK_SEC);
        }
    }

    /* =========  FRONT-END SPECIFIC QUERIES  ========= */

    /// @notice 获取单个船只完整信息（前端卡片渲染）
    /// @param shipId 船只ID
    /// @return level 等级
    /// @return faction 阵营 (0=Cargo, 1=Fort, 2=Pirate)
    /// @return isPirate 是否为海盗
    /// @return freeLeft 今日免费次数剩余
    /// @return extraLeft 今日额外次数剩余
    function getShipInfo(uint256 shipId) external view returns (
        uint8 level,
        uint8 faction,
        bool isPirate,
        uint8 freeLeft,
        uint8 extraLeft
    ) {
        level = shipSBT.levelOf(shipId);
        faction = shipSBT.factionOf(shipId);
        isPirate = (faction == shipSBT.FACTION_PIRATE());

        if (!isPirate) {
            address owner = shipSBT.ownerOf(shipId);
            uint32 currentEpoch = uint32(block.number / BLOCKS_PER_DAY);

            // 计算免费次数剩余
            uint256 dailyUsed = dailyCount[owner][currentEpoch];
            uint256 freeLimit = DAILY_FREE + (level - 1) * 4; // 6, 10, 14, 18, 22
            freeLeft = dailyUsed < freeLimit ? uint8(freeLimit - dailyUsed) : 0;

            // 计算额外次数剩余
            uint8 extraUsed = extraRuns[shipId][currentEpoch];
            uint8 extraLimit = extraCap[level];
            extraLeft = extraUsed < extraLimit ? extraLimit - extraUsed : 0;
        }
    }

    /// @notice 获取今日回合总况（前端仪表盘）
    /// @return endSec 剩余秒数
    /// @return cargoKeys Cargo钥匙数
    /// @return fortKeys Fort钥匙数
    /// @return lastBuyer 最后购买者
    function getRoundInfo() external view returns (
        uint32 endSec,
        uint32 cargoKeys,
        uint32 fortKeys,
        address lastBuyer
    ) {
        FOMORound storage r = round;
        endSec = block.number >= r.endBlock ? 0 : uint32((r.endBlock - block.number) * AVG_BLOCK_SEC);
        cargoKeys = uint32(r.cargoKeys);
        fortKeys = uint32(r.fortKeys);
        lastBuyer = r.lastBuyer;
    }

    /// @notice 获取当前奖池状态
    /// @return cargoJackpot Cargo奖池金额
    /// @return fortJackpot Fort奖池金额
    function pendingJackpot() external view returns (
        uint256 cargoJackpot,
        uint256 fortJackpot
    ) {
        cargoJackpot = round.cargoJackpot;
        fortJackpot = round.fortJackpot;
    }

    /// @notice 计算玩家可领取的胜方奖励
    /// @param user 用户地址
    /// @return amount 可领取金额
    function claimableWinnerReward(address user) external view returns (uint256 amount) {
        if (!round.isActive) {
            // 轮次已结束，计算奖励
            uint8 winFaction = round.cargoJackpot > round.fortJackpot ? 0 : 1;
            uint256 userKeys = winFaction == 0 ? cargoKeysOf[dayCounter][user] : fortKeysOf[dayCounter][user];
            uint256 totalKeys = winFaction == 0 ? round.cargoKeys : round.fortKeys;

            if (totalKeys > 0) {
                uint256 winJackpot = winFaction == 0 ? round.cargoJackpot : round.fortJackpot;
                uint256 toWinnerPool = (winJackpot * WINNER_POOL_PERCENT) / PERCENTAGE_BASE;
                amount = (toWinnerPool * userKeys) / totalKeys;
            }
        }
    }

    /// @notice 获取阶梯定价预览
    /// @param nextQty 接下来要购买的数量
    /// @return bnb 总BNB价格
    /// @return dbl 总DBL价格
    function stepPrice(uint256 nextQty) external view returns (
        uint256 bnb,
        uint256 dbl
    ) {
        require(nextQty > 0 && nextQty <= MAX_BATCH_MINT, "INVALID_QTY");
        (bnb, dbl) = _priceForRange(mintedCount, mintedCount + nextQty);
    }

    /// @notice 获取等级规格表（前端Tooltip）
    /// @param lv 等级
    /// @return freeCap 免费次数上限
    /// @return cargoLoad 载货量（暂未使用）
    /// @return extraCapLimit 额外次数上限
    /// @return probTableHash 概率表哈希（暂未使用）
    function levelSpec(uint8 lv) external view returns (
        uint8 freeCap,
        uint16 cargoLoad,
        uint8 extraCapLimit,
        uint32 probTableHash
    ) {
        require(lv >= 1 && lv <= MAX_LV, "INVALID_LEVEL");
        freeCap = uint8(DAILY_FREE + (lv - 1) * 4); // 6, 10, 14, 18, 22
        cargoLoad = uint16(lv * 100); // 示例值
        extraCapLimit = extraCap[lv];
        probTableHash = uint32(lv * 1000); // 示例值
    }

    /* =========  FRONT-END AGGREGATED QUERIES  ========= */

    /// @notice 获取用户船只详细信息
    function getUserShipsDetail(address user)
        external
        view
        returns (
            uint256[] memory shipIds,
            uint8[] memory levels,
            uint8[] memory factions,
            bool[] memory canVoyage
        )
    {
        shipIds = shipSBT.shipsOfOwner(user, mintedCount);
        uint256 len = shipIds.length;

        if (len == 0) {
            return (shipIds, new uint8[](0), new uint8[](0), new bool[](0));
        }

        levels = new uint8[](len);
        factions = new uint8[](len);
        canVoyage = new bool[](len);

        uint32 currentEpoch = uint32(block.number / BLOCKS_PER_DAY);

        for (uint256 i = 0; i < len; i++) {
            uint256 tokenId = shipIds[i];
            levels[i] = shipSBT.levelOf(tokenId);
            factions[i] = shipSBT.factionOf(tokenId);
            canVoyage[i] = _canVoyageNow(tokenId, user, currentEpoch);
        }
    }

    /// @notice 获取FOMO轮次完整状态
    function getFOMOStatus() external view returns (
        bool isActive,
        uint32 remainingTime,
        uint256 cargoJackpot,
        uint256 fortJackpot,
        uint256 cargoKeys,
        uint256 fortKeys,
        address lastBuyer
    ) {
        FOMORound storage r = round;
        isActive = r.isActive;
        remainingTime = block.number >= r.endBlock ? 0 : uint32((r.endBlock - block.number) * 3);
        cargoJackpot = r.cargoJackpot;
        fortJackpot = r.fortJackpot;
        cargoKeys = r.cargoKeys;
        fortKeys = r.fortKeys;
        lastBuyer = r.lastBuyer;
    }

    /// @notice 获取游戏全局统计信息
    function getGameStats() external view returns (
        uint256 totalMinted,
        uint256 currentTier,
        uint256 nextTierAt,
        uint256 currentBNBPrice,
        uint256 currentDBLPrice
    ) {
        totalMinted = mintedCount;
        currentTier = mintedCount / STEP_SHIPS;
        nextTierAt = (currentTier + 1) * STEP_SHIPS;
        (currentBNBPrice, currentDBLPrice) = _currentPrice();
    }
}