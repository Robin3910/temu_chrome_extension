# Temu Helper Chrome 插件

一个帮助管理 Temu 后台订单的 Chrome 插件。

## 功能特性

- 用户认证系统（登录/注册）
- 自动爬取 Temu 后台订单信息
- 数据本地存储与同步
- 模块化设计，易于扩展

## 安装说明

1. 克隆本仓库到本地
   ```bash
   git clone https://github.com/your-username/temu-helper.git
   ```

2. 打开 Chrome 浏览器，进入扩展程序页面
   - 在地址栏输入 `chrome://extensions/`
   - 打开右上角的"开发者模式"

3. 点击"加载已解压的扩展程序"，选择项目目录

## 使用说明

1. 点击浏览器工具栏中的插件图标
2. 首次使用需要注册账号
3. 登录后即可使用所有功能
4. 访问 Temu 后台页面时，插件会自动开始工作

## 开发说明

### 项目结构

- `src/background`: 后台脚本
- `src/content`: 内容脚本，包含爬虫逻辑  
- `src/popup`: 弹出窗口相关文件
- `src/services`: 服务层，包含认证等核心服务
- `src/utils`: 通用工具函数

### 添加新功能

1. 在适当的目录下创建新的模块
2. 在 `manifest.json` 中添加必要的权限
3. 通过 services 层统一管理数据流