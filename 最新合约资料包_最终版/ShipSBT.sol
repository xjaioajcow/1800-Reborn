// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title ShipSBT - 船只魂绑定 NFT
/// @notice Cargo vs Fort 双阵营航海 GameFi 的船只 SBT 系统
/// @dev 继承 ERC721URIStorage 和 Ownable，实现等级系统和 CID 映射
/// @author Cargo vs Fort Team
/// @custom:version 2.0.0
/// @custom:experimental 此合约为实验性质，船只NFT具有魂绑定特性
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Ship Soul-Bound Token (SBT)
/// @notice Soul-bound NFT；支持升级但禁止任何转移或授权。
contract ShipSBT is ERC721URIStorage, Ownable, ReentrancyGuard {

    /* -------------------------------------------------------------------------- */
    /*                                   EVENTS                                   */
    /* -------------------------------------------------------------------------- */
    event ShipMinted(address indexed to, uint256 indexed tokenId, uint8 level);
    event ShipUpgraded(uint256 indexed tokenId, uint8 newLevel);

    /* -------------------------------------------------------------------------- */
    /*                                   CONFIG                                   */
    /* -------------------------------------------------------------------------- */
    uint8 public constant MAX_LEVEL = 5;
    uint8 public constant FACTION_CARGO = 0;
    uint8 public constant FACTION_FORT = 1;
    uint8 public constant FACTION_PIRATE = 2;
    address public gameCore;                 // CoreGameV2 合约地址

    // === 自定义错误 ===
    error NOT_GAME_CORE();
    error ZERO_ADDR();
    error LV_OUT_OF_RANGE(uint8 level);
    error INVALID_FACTION();
    error TOKEN_NOT_EXISTS();
    error PIRATE_OP();           // 海盗禁止执行的操作

    modifier onlyGameCore() {
        if (msg.sender != gameCore) revert NOT_GAME_CORE();
        _;
    }

    /** @dev 由 owner 设置一次即可；推荐传入 CoreGameV2 部署地址 */
    function setGameCore(address _gameCore) external onlyOwner {
        if (_gameCore == address(0)) revert ZERO_ADDR();
        gameCore = _gameCore;
    }
    // === CID 常量（按阵营区分） ===
    string constant CID_CARGO = "ipfs://bafybeidqccm4x4uazmsbltoqqsk6tkfuoply6netgqgjp2xah7vqjhywxu";
    string constant CID_FORT  = "ipfs://bafybeigezapzwbhhtc4tfirex2fs22nnnrl7kamzakznlv7iossf24movi";
    string constant CID_PIRATE = "ipfs://bafybeigl3m3yva2s4wqr6oyhywg7vzekjm5y5spfomj4yiflyxlnt2a4s4";

    // === 状态变量 ===
    uint256 public nextTokenId;
    mapping(uint256 => uint8) public levelOf;
    mapping(uint256 => uint8) public factionOf;  // 0=Cargo, 1=Fort, 2=Pirate

    // 仅为海盗质押白名单使用
    mapping(address => uint256) public pirateBalance;

    /* -------------------------------------------------------------------------- */
    /*                                 升级接口                                   */
    /* -------------------------------------------------------------------------- */
    /**
     * @notice 由 CoreGameV2 调用，将船只等级 +1
     * @param tokenId ShipSBT tokenId
     * Emits {ShipUpgraded}
     */
    function upgrade(uint256 tokenId) external nonReentrant onlyGameCore {
        if (_ownerOf(tokenId) == address(0)) revert TOKEN_NOT_EXISTS();
        require(factionOf[tokenId] != FACTION_PIRATE, "PIRATE_NO_UPGRADE");
        uint8 curLv = levelOf[tokenId];
        require(curLv < MAX_LEVEL, "MAX_LV");
        levelOf[tokenId] = curLv + 1;
        _setTokenURI(tokenId, _cidByTokenId(tokenId));
        emit ShipUpgraded(tokenId, curLv + 1);
    }

    /**
     * @notice 由 CoreGameV2 调用，销毁船只
     * @param tokenId ShipSBT tokenId
     */
    function burn(uint256 tokenId) external nonReentrant onlyGameCore {
        if (_ownerOf(tokenId) == address(0)) revert TOKEN_NOT_EXISTS();
        address owner = _ownerOf(tokenId);
        uint8 fac = factionOf[tokenId];

        delete levelOf[tokenId];    // 清理等级映射
        delete factionOf[tokenId];  // 清理阵营映射

        if (fac == FACTION_PIRATE) {
            pirateBalance[owner] -= 1;
        }

        _burn(tokenId);
    }

    /**
     * @notice 设置船只阵营
     * @param tokenId ShipSBT tokenId
     * @param faction 阵营 (0=Cargo, 1=Fort)
     */
    function setFaction(uint256 tokenId, uint8 faction) external nonReentrant onlyGameCore {
        if (_ownerOf(tokenId) == address(0)) revert TOKEN_NOT_EXISTS();
        if (faction > 1) revert INVALID_FACTION();
        factionOf[tokenId] = faction;
    }

    constructor() ERC721("Cargo Fort Ship", "CFS") Ownable(msg.sender) {
        nextTokenId = 1; // 从 1 开始编号
    }

    /// @notice 铸造船只 NFT
    /// @param to 接收者地址
    /// @param lv 船只等级 (1-5)
    /// @return tokenId 铸造的 Token ID
    function mint(address to, uint8 lv) external onlyOwner returns (uint256) {
        if (lv < 1 || lv > 5) {
            revert LV_OUT_OF_RANGE(lv);
        }

        uint256 tokenId = nextTokenId++;
        levelOf[tokenId] = lv;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, _cidByLevel(lv));

        emit ShipMinted(to, tokenId, lv);
        return tokenId;
    }

    /// @notice 由 CoreGameV2 调用铸造船只 NFT（支持阵营和海盗设置）
    /// @param to 接收者地址
    /// @param lv 船只等级 (1-5)
    /// @param faction 阵营 (0=Cargo, 1=Fort, 2=Pirate)
    /// @return tokenId 铸造的 Token ID
    /// @dev 海盗船会自动设置为 FACTION_PIRATE 并增加 pirateBalance
    function mintWithFaction(address to, uint8 lv, uint8 faction, bool /*pirateFlag*/) external onlyGameCore returns (uint256) {
        if (lv < 1 || lv > 5) {
            revert LV_OUT_OF_RANGE(lv);
        }
        require(faction <= FACTION_PIRATE, "INVALID_FACTION");

        uint256 tokenId = nextTokenId++;
        levelOf[tokenId] = lv;
        factionOf[tokenId] = faction;

        if (faction == FACTION_PIRATE) {
            pirateBalance[to] += 1;
        }

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, _cidByTokenId(tokenId));

        emit ShipMinted(to, tokenId, lv);
        return tokenId;
    }

    /* -------------------------------------------------------------------------- */
    /*                             魂绑定 - 禁止转移                              */
    /* -------------------------------------------------------------------------- */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // 仅允许「铸造」(from==0) 与「销毁」(to==0)，其余全部阻断
        require(from == address(0) || to == address(0), "SBT_NON_TRANSFERABLE");
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert("SBT_APPROVAL_DISABLED");
    }

    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert("SBT_APPROVAL_DISABLED");
    }

    /// @notice 根据阵营返回对应CID
    /// @param tokenId 船只Token ID
    /// @return cid 对应的IPFS CID
    function _cidByTokenId(uint256 tokenId) private view returns (string memory) {
        if (factionOf[tokenId] == FACTION_PIRATE) return CID_PIRATE;
        if (factionOf[tokenId] == FACTION_CARGO)  return CID_CARGO;
        /* 默认或 FACTION_FORT */
        return CID_FORT;
    }

    /// @notice 地址是否持有 ≥1 张海盗 SBT（供 PiratePool 调用）
    /// @param user 查询的用户地址
    /// @return 是否持有海盗SBT
    function hasPirate(address user) external view returns (bool) {
        return pirateBalance[user] > 0;
    }

    /// @notice 兼容旧版接口；实际已由 _cidByTokenId 取代
    function _cidByLevel(uint8) private pure returns (string memory) {
        return CID_CARGO; // 占位
    }

    /* =========  FRONT-END HELPER FUNCTIONS  ========= */

    /// @notice 获取用户拥有的船只ID列表（需要遍历所有token）
    /// @param owner 船只所有者地址
    /// @param maxTokenId 最大token ID（用于限制遍历范围）
    /// @return ids 船只ID数组
    function shipsOfOwner(address owner, uint256 maxTokenId)
        external
        view
        returns (uint256[] memory ids)
    {
        uint256 balance = balanceOf(owner);
        if (balance == 0) return new uint256[](0);

        uint256[] memory tempIds = new uint256[](balance);
        uint256 count = 0;

        // 遍历所有可能的token ID
        for (uint256 i = 1; i <= maxTokenId && count < balance; i++) {
            if (_ownerOf(i) == owner) {
                tempIds[count] = i;
                count++;
            }
        }

        // 创建精确大小的数组
        ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = tempIds[i];
        }
    }


}