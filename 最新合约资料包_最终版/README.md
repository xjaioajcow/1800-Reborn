# Cargo vs Fort 海盗大战游戏 - 最终版合约资料包

## 📋 合约地址 (BSC测试网)

| 合约名称 | 地址 | 功能 |
|---------|------|------|
| **DBL Token** | `0x3087caF22F461e6E0D19304dAB4D90cbAB35e0e3` | 游戏基础代币 |
| **CARGO Token** | `0x5199003dc57d970666D7B00Af92759239C59158D` | Cargo阵营代币 |
| **FORT Token** | `0x2940e363b9ca3FDdfF64eF12Aaafa0a5d6743d8b` | Fort阵营代币 |
| **CoreGameV2** | `0xcfB07c5c4D97f9768C2e9F719752C389Fd3a0Ddf` | 核心游戏逻辑 |
| **ShipSBT** | `0x188A4354D014091Dc83d5450e46C9F11b50d2CEf` | 船只NFT合约 |
| **PiratePool** | `0x7Ce6BF3A5Df8DC4E58F8200194034D114F923eef` | 海盗池质押合约 |

## 🎮 游戏功能

### ✅ 已验证功能
- **船只购买**: 支持不同等级和阵营，5%概率获得海盗船只
- **出航系统**: 消耗敌币获得友币，载货量限制正确
- **NFT升级**: 合成升级机制，两艘相同等级+阵营船只合成
- **海盗池质押**: 质押代币获得分红，需要持有海盗船只
- **FOMO机制**: Key购买竞争，轮次奖励分发
- **经济循环**: 20%进入海盗池，80%进入FOMO奖池

### 🔧 重要说明
- **出航功能**: 第一次出航会自动激活FOMO轮次，这是正常机制
- **海盗池奖励**: 用户需要主动调用`claim()`函数领取
- **出航奖励**: 立即自动到账，无需额外领取

## 📁 文件说明

| 文件名 | 说明 |
|--------|------|
| `BSC测试网合约地址_最终版.txt` | 详细的合约地址和测试结果 |
| `CoreGameV2.json` | 核心游戏合约ABI |
| `CoreGameV2.sol` | 核心游戏合约源代码 |
| `GameToken.json` | 代币合约ABI |
| `GameToken.sol` | 代币合约源代码 |
| `ShipSBT.json` | 船只NFT合约ABI |
| `ShipSBT.sol` | 船只NFT合约源代码 |
| `PiratePool.json` | 海盗池合约ABI |
| `PiratePool.sol` | 海盗池合约源代码 |

## 🚀 快速开始

### 1. 连接BSC测试网
- 网络名称: BSC Testnet
- RPC URL: https://data-seed-prebsc-1-s1.binance.org:8545/
- Chain ID: 97
- 符号: BNB
- 区块浏览器: https://testnet.bscscan.com

### 2. 基本功能调用

```javascript
// 购买船只
await coreGame.buyShip(1, 1, { value: priceBNB });

// 出航获奖
await coreGame.voyage(shipId, amount);

// 升级船只
await coreGame.upgradeShip(shipIdA, shipIdB);

// 海盗池质押
await piratePool.stake(poolId, amount);

// 领取海盗池奖励
await piratePool.claim(poolId);
```

### 3. 查询函数

```javascript
// 获取船只信息
const shipInfo = await coreGame.getShipInfo(shipId);

// 获取FOMO状态
const fomoStatus = await coreGame.getFOMOStatus();

// 获取用户船只
const shipIds = await shipSBT.shipsOfOwner(userAddress, limit);

// 获取海盗池信息
const userInfo = await piratePool.getUserInfo(poolId, userAddress);
```

## ✅ 测试状态

### 功能测试结果
- ✅ 船只购买功能: 完全正常
- ✅ 出航功能: 完全正常 (轮次激活机制)
- ✅ NFT升级功能: 完全正常
- ✅ 海盗池质押: 完全正常
- ✅ FOMO机制: 完全正常
- ✅ 代币经济: 完全正常
- ✅ 权限系统: 完全正常

### 用户问题解决状态
1. ✅ 出航奖励立即到账
2. ✅ 海盗池奖励按比例分配，用户主动领取
3. ✅ 购买额外次数功能正常
4. ✅ 出航针对船只，不是账号
5. ✅ 海盗质押只需质押代币
6. ✅ Key购买事件正常显示
7. ✅ 连击机制存在
8. ✅ 各等级船只出航功能正常
9. ✅ NFT升级机制正常
10. ✅ FOMO Key倒计时结束后奖励正常分发

## 🔗 验证链接

- [DBL Token](https://testnet.bscscan.com/address/0x3087caF22F461e6E0D19304dAB4D90cbAB35e0e3)
- [CARGO Token](https://testnet.bscscan.com/address/0x5199003dc57d970666D7B00Af92759239C59158D)
- [FORT Token](https://testnet.bscscan.com/address/0x2940e363b9ca3FDdfF64eF12Aaafa0a5d6743d8b)
- [CoreGameV2](https://testnet.bscscan.com/address/0xcfB07c5c4D97f9768C2e9F719752C389Fd3a0Ddf)
- [ShipSBT](https://testnet.bscscan.com/address/0x188A4354D014091Dc83d5450e46C9F11b50d2CEf)
- [PiratePool](https://testnet.bscscan.com/address/0x7Ce6BF3A5Df8DC4E58F8200194034D114F923eef)

## 📞 支持

如有问题，请参考 `BSC测试网合约地址_最终版.txt` 文件中的详细说明。

---

**🎮 Cargo vs Fort 海盗大战游戏 - 100%功能完整，可以安全上线！**
