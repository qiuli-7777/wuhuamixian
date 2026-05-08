import { initGalgame } from './galgame.js'; // 仅保留galgame依赖（视频核心）
let gl_version = 46;

export function gelinPack(lib, game, ui, get, ai, _status, datasrc) {
  // 初始化必要全局变量（仅视频相关）
  if (!window.galgame) window.galgame = {};
  if (!window.galgame.text) window.galgame.text = {};
  if (!window.galgame.func) window.galgame.func = {};
  if (!window.galgame.inits) window.galgame.inits = [];

  if (!lib.gl_version) {
    lib.onprepare.push(function() {
      game.gl_loadData();
      window.lib = lib;
      window.game = game;
      window.ui = ui;
    });
  }
  if (lib.gl_version && lib.gl_version >= gl_version) return;
  lib.gl_version = gl_version;

  game.gl_loadData = function() {
    initGalgame(lib, game, ui, get, ai, _status, datasrc); // 仅初始化视频核心模块

    // 视频播放入口（CG播放函数）
    game.gl_cg = function() {
      var next = game.createEvent('gl_cg', false);
      for (var argument of arguments) {
        if (argument == 'nopause') next.nopause = true;
        else if (argument == 'noskip') next.noskip = false;
        else if (argument == 'nofeature') next.nofeature = true;
        else if (typeof argument == 'string') next.src = argument; // 视频地址
        else if (typeof argument == 'function') next.callback = argument; // 播放结束回调
      }
      next.setContent('gl_cg');
      return next;
    };

    // 视频播放实现（触发galgame核心播放逻辑）
    lib.element.content.gl_cg = function() {
      if (!event.src) return;
      game.broadcastAll(function(src, callback, nofeature, noskip, nopause) {
        if (ui.backgroundMusic) ui.backgroundMusic.pause();
        var background = ui.create.div('.cg', ui.window);
        // 调用galgame的核心视频播放方法
        var cg = galgame.cg(lib.assetURL + 'extension/' + src, function() {
          ui.window.removeChild(this.parentNode);
          if (ui.backgroundMusic && ui.backgroundMusic.duration) ui.backgroundMusic.play();
          if (nopause !== true) game.resume();
          if (typeof callback == 'function') callback();
        }, noskip, background);
        if (nofeature) background.style.zIndex = '0';
        if (nopause !== true) game.pause();
      }, event.src, event.callback, event.nofeature, event.noskip, event.nopause);
    };
  };
}
