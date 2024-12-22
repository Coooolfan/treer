# Treer

不只是在圣诞节种树

mediapipe + Three.js + Vue

> [!NOTE]
> 我并不深入了解 Three.js 和 mediapipe，所以这个项目的设计可能有很多问题，如果你有任何建议，欢迎提 Issue 或者 PR。
> It just WORKS!

# 截图

![screenshot](/image/screenshot.jpg)

# 特色

- 自动追踪手部
- 本地处理，纯前端
- 3D 模型渲染
- 切换摄像头
- 横竖屏适配
- 无外部依赖（打包后的项目不依赖第三方）

# 编译与部署

1. 下载项目

    ```bash
    git clone https://github.com/Coooolfan/treer.git
    cd treer
    ```

2. 安装依赖

    ```bash
    yarn
    ```

3. 启动测试服务器

    ```bash
    yarn dev
    ```

4. 打包

    ```bash
    yarn build
    ```

# 二次开发与分发

- 如果只需要修改模型，只需要替换`src\assets\christmas_tree.gltf`为你的模型即可。然后可以视情况修改`src\components\ChristmasTree.vue`中的第15行的`scale`即可。

- GPL-3.0 License

# 注意

- 仅二维追踪
- 仅支持单手
- 无法跟随手掌旋转


确定一个三维物体的状态需要6个参数（假设摄像机固定）：位置（x, y, z）、旋转（x, y, z）。虽然 mediapipe 可以提供手掌的 21 个关键点，理论上可以由此解算出模型或者摄像机的位置。但是我不会……

项目只实现了基于掌心位置的追踪，还有根据手掌周长大小来改变模型的大小。具体代码在`src\views\LandingView.vue`中的`syncObjectLocation`函数中。

# 参考

- 圣诞树模型

    "christmas tree 2" (https://skfb.ly/oO8VF) by vicente betoret ferrero is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).