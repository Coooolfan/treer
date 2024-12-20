# Treer

不只是在圣诞节种树

mediapipe + Three.js + Vue

> [!NOTE]
> 我并不深入了解 Three.js 和 mediapipe，所以这个项目的设计可能有很多问题，如果你有任何建议，欢迎提 Issue 或者 PR。
> It just WORKS!

# 截图

![alt text](/image/screenshot.jpg)

# 特色

- 自动追踪手部
- 本地处理，纯前端
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