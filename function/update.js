import { lib, game, ui, get, ai, _status } from "../../../noname.js";
import { createProgress } from "../../../noname/library/update.js";

/**
 * 更新函数
 * @param {boolean} manual  是否手动触发（true: 显示提示和确认框）
 */
export default async (manual = false) => {
  // 1. 环境检查
  if (_status.connectMode && manual) {
    alert("联机状态下无法更新");
    return;
  }
  if (!window.navigator.onLine && manual) {
    alert("无网络连接，无法检查更新");
    return;
  }

  // 2. 防止短时间内重复检查（自动检查时使用 sessionStorage 缓存）
  if (!manual && sessionStorage.wumihuaxian_check) return;
  sessionStorage.wumihuaxian_check = true;

  // 3. 读取镜像源配置（你的配置项 id 是 update_source）
  const proxyList = [
    "",   // 直连 GitHub
    "https://gh-proxy.com/",
    "https://hk.gh-proxy.com/",
    "https://tvv.tw/",
  ];
  let proxy = proxyList[lib.config.extension_五花米线_update_source] || "";
  let remoteManifest = null;
  let success = false;

  // 4. 尝试获取远程 manifest.json（你需要改成你自己的 GitHub 仓库地址）
  for (const p of [proxy, ...proxyList.filter(x => x !== proxy)]) {
    try {
      // ↓↓↓ 这里改成你的 GitHub 仓库 raw 地址 ↓↓↓
      const url = `${p}https://raw.githubusercontent.com/你的用户名/你的仓库名/分支名/manifest.json`;
      const res = await fetch(url);
      if (res.ok) {
        remoteManifest = await res.json();
        proxy = p;
        success = true;
        break;
      }
    } catch (e) {
      console.warn(`镜像 ${p} 失败`, e);
    }
  }
  if (!success) {
    if (manual) alert("获取远程清单失败，请检查网络");
    return;
  }

  // 5. 对比本地文件哈希，收集需要更新的文件
  const needUpdate = [];
  const hex = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

  for (const [filePath, remoteHash] of Object.entries(remoteManifest.files)) {
    const localFullPath = `extension/五花米线/${filePath}`;
    const exists = await game.promises.checkFile(localFullPath);
    if (!exists) {
      needUpdate.push(filePath);
      continue;
    }
    try {
      const buf = await crypto.subtle.digest('SHA-1', await game.promises.readFile(localFullPath));
      const localHash = Array.from(new Uint8Array(buf), x => hex[x]).join('');
      if (localHash !== remoteHash) needUpdate.push(filePath);
    } catch {
      needUpdate.push(filePath);
    }
  }

  // 6. 无更新则结束
  if (needUpdate.length === 0) {
    if (manual) alert(`已是最新版本 (${remoteManifest.version})`);
    return;
  }

  // 7. 询问用户（仅手动模式弹出确认框）
  if (manual && !confirm(`发现新版本 ${remoteManifest.version}\n需更新 ${needUpdate.length} 个文件，是否继续？`)) {
    return;
  }

  // 8. 下载并写入新文件
  const prog = createProgress("更新五花米线扩展", needUpdate.length);
  game.importedPack = true;

  try {
    for (let i = 0; i < needUpdate.length; i++) {
      const file = needUpdate[i];
      prog.setFileName(`正在下载：${file}`);
      prog.setProgressValue(i + 1);

      const url = `${proxy}https://raw.githubusercontent.com/你的用户名/你的仓库名/分支名/${file}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`下载失败 ${file}`);

      const data = await res.arrayBuffer();
      const fullPath = `extension/五花米线/${file}`;
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      await game.promises.createDir(dir);
      await game.promises.writeFile(data, dir, fullPath.split('/').pop());
    }

    // 9. 更新本地的 manifest.json
    await game.promises.writeFile(
      JSON.stringify(remoteManifest, null, 2),
      "extension/五花米线",
      "manifest.json"
    );

    // 10. 清理多余文件（本地有但远程没有的）
    const clean = async (dir, prefix = '') => {
      const [subDirs, files] = await game.promises.getFileList(dir);
      let all = files.map(f => prefix ? `${prefix}/${f}` : f);
      for (const d of subDirs) {
        all = all.concat(await clean(`${dir}/${d}`, prefix ? `${prefix}/${d}` : d));
      }
      return all;
    };
    const localFiles = await clean("extension/五花米线");
    const toDelete = localFiles.filter(f => !remoteManifest.files[f] && f !== "manifest.json");
    if (toDelete.length) {
      const delProg = createProgress("清理旧文件", toDelete.length);
      for (let i = 0; i < toDelete.length; i++) {
        delProg.setProgressValue(i + 1);
        await game.promises.removeFile(`extension/五花米线/${toDelete[i]}`);
      }
      delProg.remove();
    }

    alert("更新完成！游戏即将重启");
    game.reload();
  } catch (err) {
    console.error(err);
    if (manual) alert("更新失败：" + err.message);
  } finally {
    prog.remove();
    delete game.importedPack;
  }
};