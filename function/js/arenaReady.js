import { lib, game, ui, get, ai, _status } from '../../../noname.js';
import update from '../function/update.js';

export async function arenaReady() {
  // 自动检查更新
  if (lib.config.extension_五花米线_auto_update) {
    // 静默检查（不弹提示）
    update(false).catch(e => console.warn(e));
  }
}