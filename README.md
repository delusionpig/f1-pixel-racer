# 像素大奖赛

一个无需安装依赖的手机优先 H5 赛车小游戏原型。

## 本地运行

直接用浏览器打开 `index.html` 即可。也可以在此目录运行任意静态文件服务器。

## 操作

- 方向键 ↑ / ↓ 或 W / S：上下换线
- 鼠标或手指：按住赛道并上下拖动赛车
- 收集 5 枚金币获胜；撞到轮胎 2 次结束

## 文件

- `assets/race-car.png`：提供的赛车精灵图
- `assets/coin.png`：提供的金币素材
- `assets/tires.png`：提供的轮胎堆素材，已清除棋盘底色
- `assets/podium.png`：提供的冠军领奖台素材，已清除棋盘底色
- `assets/start-light-0.png` 至 `assets/start-light-5.png`：从提供的起步灯精灵表提取并去除棋盘底色的逐帧动画
- `assets/start-lights-spritesheet.png`：原始起步灯精灵表
- `game.js`：循环赛道、道具、碰撞、计分和起步倒计时

领奖视频区域目前是占位画面，后续可替换为实际视频素材。
